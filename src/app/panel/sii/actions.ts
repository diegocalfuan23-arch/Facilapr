"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { siiConfigs, siiFolios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { normalizarRut, rutValido } from "@/lib/formato";
import { cifradoListo, cifrarSii, revisarCertificado, siiHabilitado } from "@/lib/sii/seguridad";
import { leerCaf, nombreTipoBoleta, TIPOS_BOLETA } from "@/lib/sii/folios";
import { emitirPeriodo, type ResultadoEmision } from "@/lib/sii/emision";

export type ResultadoSii = { ok: true } | { ok: false; error: string };

const MAXIMO_ARCHIVO = 100_000;

/** Solo la directiva de un comité con el módulo activado, y con el cifrado configurado. */
async function comite() {
  const sesion = await requireAdmin();
  if (!siiHabilitado(sesion.apr.slug)) return { ok: false as const, error: "Las boletas al SII no están activadas para tu comité." };
  if (!cifradoListo()) return { ok: false as const, error: "Falta configurar el cifrado en el servidor." };
  return { ok: true as const, ...sesion };
}

const texto = (formData: FormData, campo: string, maximo: number) => String(formData.get(campo) ?? "").trim().slice(0, maximo);

async function guardarConfig(aprId: string, valores: Partial<typeof siiConfigs.$inferInsert>) {
  const datos = { ...valores, updatedAt: new Date() };
  await db
    .insert(siiConfigs)
    .values({ aprId, ...datos })
    .onConflictDoUpdate({ target: siiConfigs.aprId, set: datos });
  revalidatePath("/panel/sii");
}

/** Los datos del comité como emisor, tal como figuran en el SII. */
export async function guardarEmisor(_prev: ResultadoSii | null, formData: FormData): Promise<ResultadoSii> {
  const c = await comite();
  if (!c.ok) return c;

  const rut = normalizarRut(texto(formData, "rutEmisor", 20));
  if (!rutValido(rut)) return { ok: false, error: "El RUT del comité no es válido." };
  const razonSocial = texto(formData, "razonSocial", 100);
  const giro = texto(formData, "giro", 80);
  const direccion = texto(formData, "direccion", 70);
  const comuna = texto(formData, "comuna", 20);
  if (!razonSocial || !giro || !direccion || !comuna) return { ok: false, error: "Completa razón social, giro, dirección y comuna." };
  const tipoBoleta = Number(formData.get("tipoBoleta"));
  if (!TIPOS_BOLETA.some((t) => t.tipo === tipoBoleta)) return { ok: false, error: "Elige el tipo de boleta." };
  const numero = texto(formData, "resolucionNumero", 10);
  if (numero && !/^\d+$/.test(numero)) return { ok: false, error: "El número de resolución lleva solo cifras." };
  const fecha = texto(formData, "resolucionFecha", 10);
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "La fecha de resolución no es válida." };

  await guardarConfig(c.apr.id, {
    rutEmisor: rut,
    razonSocial,
    giro,
    direccion,
    comuna,
    tipoBoleta,
    resolucionNumero: numero ? Number(numero) : null,
    resolucionFecha: fecha || null,
  });
  return { ok: true };
}

/** Guarda cifrado el certificado digital del representante, con su autorización. */
export async function guardarCertificado(_prev: ResultadoSii | null, formData: FormData): Promise<ResultadoSii> {
  const c = await comite();
  if (!c.ok) return c;

  const rut = normalizarRut(texto(formData, "representanteRut", 20));
  const nombre = texto(formData, "representanteNombre", 100);
  if (!nombre || !rutValido(rut)) return { ok: false, error: "Escribe el nombre y el RUT del dueño del certificado." };
  if (formData.get("autorizo") !== "on") return { ok: false, error: "Falta la autorización." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elige el archivo del certificado." };
  if (archivo.size > MAXIMO_ARCHIVO) return { ok: false, error: "Ese archivo es demasiado grande para ser un certificado." };
  const claveCertificado = String(formData.get("clave") ?? "");
  if (!claveCertificado) return { ok: false, error: "Escribe la clave del certificado." };

  const bytes = Buffer.from(await archivo.arrayBuffer());
  const revision = revisarCertificado(bytes, claveCertificado);
  if (!revision.ok) return revision;

  await guardarConfig(c.apr.id, {
    certificado: cifrarSii(bytes.toString("base64")),
    certificadoClave: cifrarSii(claveCertificado),
    certificadoNombre: archivo.name.slice(-120),
    representanteNombre: nombre,
    representanteRut: rut,
    autorizadoAt: new Date(),
    autorizadoPorId: c.user.id,
  });
  return { ok: true };
}

export async function quitarCertificado(): Promise<ResultadoSii> {
  const c = await comite();
  if (!c.ok) return c;
  await guardarConfig(c.apr.id, {
    certificado: null,
    certificadoClave: null,
    certificadoNombre: null,
    representanteNombre: null,
    representanteRut: null,
    autorizadoAt: null,
    autorizadoPorId: null,
  });
  return { ok: true };
}

/** Numera, firma y guarda las boletas de un mes que aún no tienen documento. No las envía. */
export async function emitirBoletas(periodo: string): Promise<ResultadoEmision> {
  const c = await comite();
  if (!c.ok) return c;
  if (!/^\d{4}-\d{2}$/.test(periodo)) return { ok: false, error: "El mes no es válido." };
  const resultado = await emitirPeriodo(c.apr.id, periodo);
  revalidatePath("/panel/sii");
  return resultado;
}

/** Carga un tramo de folios (CAF) del comité. */
export async function subirFolios(_prev: ResultadoSii | null, formData: FormData): Promise<ResultadoSii> {
  const c = await comite();
  if (!c.ok) return c;

  const config = await db.query.siiConfigs.findFirst({ where: eq(siiConfigs.aprId, c.apr.id), columns: { rutEmisor: true } });
  if (!config?.rutEmisor) return { ok: false, error: "Guarda primero los datos del emisor." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elige el archivo de folios." };
  if (archivo.size > MAXIMO_ARCHIVO) return { ok: false, error: "Ese archivo es demasiado grande para ser de folios." };
  // El SII entrega estos archivos en ISO-8859-1: se guardan sus bytes tal cual.
  const bytes = Buffer.from(await archivo.arrayBuffer());
  const caf = leerCaf(bytes.toString("latin1"));
  if (!caf) return { ok: false, error: "Ese archivo no es un archivo de folios (CAF) del SII." };
  if (!TIPOS_BOLETA.some((t) => t.tipo === caf.tipo)) return { ok: false, error: "Esos folios no son de boletas electrónicas (39 o 41)." };
  if (normalizarRut(caf.rut) !== config.rutEmisor) return { ok: false, error: `Esos folios son de otro RUT (${caf.rut}).` };

  // Un folio no puede estar en dos tramos: se emitiría dos veces.
  const cruzado = await db.query.siiFolios.findFirst({
    where: and(eq(siiFolios.aprId, c.apr.id), eq(siiFolios.tipo, caf.tipo), lte(siiFolios.desde, caf.hasta), gte(siiFolios.hasta, caf.desde)),
    columns: { desde: true, hasta: true },
  });
  if (cruzado) return { ok: false, error: `Ya cargaste folios que se cruzan con esos (${nombreTipoBoleta(caf.tipo)} ${cruzado.desde} a ${cruzado.hasta}).` };

  await db.insert(siiFolios).values({
    aprId: c.apr.id,
    tipo: caf.tipo,
    desde: caf.desde,
    hasta: caf.hasta,
    siguiente: caf.desde,
    fechaAutorizacion: caf.fecha,
    caf: cifrarSii(bytes.toString("base64")),
    archivoNombre: archivo.name.slice(-120),
  });
  revalidatePath("/panel/sii");
  return { ok: true };
}

/** Quita un tramo que no se ha usado. Uno usado se conserva: sus folios ya están en documentos emitidos. */
export async function quitarFolios(id: string): Promise<ResultadoSii> {
  const c = await comite();
  if (!c.ok) return c;
  const fila = await db.query.siiFolios.findFirst({ where: and(eq(siiFolios.id, id), eq(siiFolios.aprId, c.apr.id)), columns: { desde: true, siguiente: true } });
  if (!fila) return { ok: false, error: "No encontramos esos folios." };
  if (fila.siguiente !== fila.desde) return { ok: false, error: "Ya se usaron folios de ese archivo: no se puede quitar." };
  await db.delete(siiFolios).where(eq(siiFolios.id, id));
  revalidatePath("/panel/sii");
  return { ok: true };
}
