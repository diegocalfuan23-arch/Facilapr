import { createHmac, timingSafeEqual } from "node:crypto";
import { and, inArray, like } from "drizzle-orm";
import { UTApi, UTFile } from "uploadthing/server";
import { db } from "@/lib/db";
import { mensajesSocio } from "@/lib/db/schema";
import { ADJUNTO_MAX_BYTES, type Adjunto } from "@/lib/adjuntos-comun";
import { urlRecibo } from "@/lib/recibo-enlace";
import { urlComprobante } from "@/lib/comprobante-enlace";

/**
 * Los archivos del chat. Se guardan en UploadThing y en la base queda solo su clave, con el nombre, el tipo y el
 * tamaño. Nadie recibe la dirección del almacenamiento: se abren por `/a/<código firmado>`.
 *
 * La clave dice de dónde sale el archivo:
 *   ut:<clave>            un archivo subido
 *   recibo:<boletaId>     el PDF de una boleta (se genera al abrirlo)
 *   comprobante:<pagoId>  el PDF de un comprobante de pago (se genera al abrirlo)
 */

export type ArchivoGuardado = { clave: string; nombre: string; tipo: string; tamano: number | null };

export const almacenamientoListo = () => Boolean(process.env.UPLOADTHING_TOKEN?.trim());

const FIRMAS: { tipo: string; es: (b: Buffer) => boolean }[] = [
  { tipo: "application/pdf", es: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { tipo: "image/png", es: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { tipo: "image/jpeg", es: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { tipo: "image/webp", es: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];

/** Word y Excel son archivos zip: se reconocen por su comienzo y su extensión. */
const OFICINA: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function nombreLimpio(nombre: string, porDefecto = "Archivo") {
  return nombre.replace(/[\\/\r\n"]+/g, " ").trim().slice(-120) || porDefecto;
}

/** Revisa un archivo subido desde la app y lo guarda. No se confía en el tipo que declara el navegador. */
export async function subirArchivoDelChat(
  archivo: File
): Promise<{ ok: true; archivo: ArchivoGuardado } | { ok: false; error: string }> {
  if (!almacenamientoListo()) return { ok: false, error: "Adjuntar archivos todavía no está configurado." };
  if (archivo.size === 0) return { ok: false, error: "Ese archivo está vacío." };
  if (archivo.size > ADJUNTO_MAX_BYTES) return { ok: false, error: "El archivo pesa más de 3 MB." };

  const bytes = Buffer.from(await archivo.arrayBuffer());
  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "";
  const tipo =
    FIRMAS.find((f) => f.es(bytes))?.tipo ??
    (bytes.subarray(0, 4).toString("latin1") === "PK\u0003\u0004" ? OFICINA[extension] : undefined);
  if (!tipo) return { ok: false, error: "Solo se pueden adjuntar PDF, imágenes, Word o Excel." };

  const guardado = await guardarArchivo(nombreLimpio(archivo.name), tipo, bytes);
  return guardado ? { ok: true, archivo: guardado } : { ok: false, error: "No pudimos guardar el archivo. Inténtalo de nuevo." };
}

/** Guarda unos bytes ya revisados. Null si no se pudo. */
export async function guardarArchivo(nombre: string, tipo: string, bytes: Buffer): Promise<ArchivoGuardado | null> {
  try {
    const r = await new UTApi().uploadFiles(new UTFile([new Uint8Array(bytes)], nombre, { type: tipo }));
    if (!r.data) {
      console.error("Adjuntos: no se pudo subir el archivo:", r.error?.message);
      return null;
    }
    return { clave: `ut:${r.data.key}`, nombre, tipo, tamano: bytes.length };
  } catch (e) {
    console.error("Adjuntos: error al subir el archivo:", e instanceof Error ? e.message : "error");
    return null;
  }
}

/** Lo que se guarda de lo que un socio manda por WhatsApp, con su extensión. */
const ENTRANTES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  [OFICINA.docx]: "docx",
  [OFICINA.xlsx]: "xlsx",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
};

/** Guarda un archivo que llegó por WhatsApp. Null si es de un tipo que no se acepta o no se pudo guardar. */
export async function guardarEntrante(bytes: Buffer, mime: string, nombre: string | undefined, porDefecto: string) {
  const tipo = mime.split(";")[0].trim().toLowerCase();
  const extension = ENTRANTES[tipo];
  if (!extension || !almacenamientoListo()) return null;
  // En PDF e imágenes el contenido tiene que ser lo que dice ser.
  const firma = FIRMAS.find((f) => f.tipo === tipo);
  if (firma && !firma.es(bytes)) return null;
  return guardarArchivo(nombreLimpio(nombre ?? "", `${porDefecto}.${extension}`), tipo, bytes);
}

/** Los archivos subidos en las conversaciones de unos socios: se leen antes de borrarlos, para borrar también los archivos. */
export async function clavesDeSocios(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  try {
    const filas = await db
      .select({ clave: mensajesSocio.adjuntoClave })
      .from(mensajesSocio)
      .where(and(inArray(mensajesSocio.socioId, ids), like(mensajesSocio.adjuntoClave, "ut:%")));
    return filas.flatMap((f) => (f.clave ? [f.clave] : []));
  } catch (e) {
    console.error("Adjuntos: no se pudieron listar los archivos:", e instanceof Error ? e.message : "error");
    return [];
  }
}

export async function borrarArchivos(claves: string[]) {
  for (const clave of claves) await borrarArchivo(clave);
}

/** La dirección en el almacenamiento de un archivo subido. Solo para el servidor. */
export async function direccionEnAlmacen(clave: string): Promise<string | null> {
  if (!clave.startsWith("ut:") || !almacenamientoListo()) return null;
  const r = await new UTApi().getFileUrls(clave.slice(3));
  return r.data[0]?.url ?? null;
}

export async function borrarArchivo(clave: string | null) {
  if (!clave?.startsWith("ut:") || !almacenamientoListo()) return;
  await new UTApi().deleteFiles(clave.slice(3)).catch((e) => console.error("Adjuntos: no se pudo borrar:", e));
}

const LARGO_FIRMA = 22;

function firma(mensajeId: string) {
  const secreto = process.env.BETTER_AUTH_SECRET;
  if (!secreto) throw new Error("Falta BETTER_AUTH_SECRET.");
  return createHmac("sha256", secreto).update(`adjunto:${mensajeId}`).digest("base64url").slice(0, LARGO_FIRMA);
}

/** El id del mensaje si el código es auténtico; null si fue alterado. */
export function mensajeIdDeCodigo(codigo: string): string | null {
  const punto = codigo.lastIndexOf(".");
  if (punto <= 0) return null;
  const id = codigo.slice(0, punto);
  const recibida = Buffer.from(codigo.slice(punto + 1));
  const esperada = Buffer.from(firma(id));
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada) ? id : null;
}

/** El adjunto de un mensaje como lo ve el chat; null si no tiene. */
export function adjuntoDeFila(f: {
  id: string;
  adjuntoClave: string | null;
  adjuntoNombre: string | null;
  adjuntoTipo: string | null;
  adjuntoTamano: number | null;
}): Adjunto | null {
  const clave = f.adjuntoClave;
  if (!clave) return null;
  const url = clave.startsWith("recibo:")
    ? urlRecibo(clave.slice("recibo:".length))
    : clave.startsWith("comprobante:")
      ? urlComprobante(clave.slice("comprobante:".length))
      : `/a/${f.id}.${firma(f.id)}`;
  return { nombre: f.adjuntoNombre ?? "Archivo", tipo: f.adjuntoTipo ?? "application/octet-stream", tamano: f.adjuntoTamano, url };
}

/** La dirección completa, para que Meta pueda descargar el archivo. */
export function direccionCompleta(url: string) {
  if (!url.startsWith("/")) return url;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "https://facilapr.cl";
  return `${base.replace(/\/$/, "")}${url}`;
}
