import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { whatsappConexiones } from "@/lib/db/schema";
import { cifrar, descifrar } from "@/lib/mercadopago";
import { META_APP_ID } from "@/lib/meta-ids";

/**
 * Conexión del WhatsApp de cada comité con el registro insertado (Embedded
 * Signup) de Meta. El comité autoriza a Facilapr desde una ventana de Meta; de
 * ahí salen el código, la cuenta y el número que este módulo convierte en una
 * conexión lista para enviar: token del comité, webhook, número registrado y
 * plantillas creadas. Cada comité le paga a Meta sus propios mensajes.
 *
 * Variables: NEXT_PUBLIC_META_APP_ID y NEXT_PUBLIC_META_CONFIG_ID (opcionales: sus
 * valores por defecto son los de la app Facilapr), WHATSAPP_APP_SECRET y
 * CLAVE_CIFRADO_MP (ya existen), WHATSAPP_CONEXION_COMITES=1 para mostrar el botón.
 */

/** Mientras la app de Meta esté en revisión, el botón solo se muestra donde se prende esta variable. */
export const conexionDeComitesActiva = () => process.env.WHATSAPP_CONEXION_COMITES === "1";

const SITIO = "https://facilapr.cl";

const version = () => process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
const graph = (ruta: string) => `https://graph.facebook.com/${version()}/${ruta}`;

type Respuesta<T> = { ok: true; datos: T } | { ok: false; error: string };

async function llamar<T>(url: string, init: RequestInit = {}): Promise<Respuesta<T>> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
    const datos = (await r.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!r.ok || !datos) return { ok: false, error: datos?.error?.message ?? `Meta respondió ${r.status}.` };
    return { ok: true, datos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo contactar a Meta." };
  }
}

const autorizado = (token: string): RequestInit => ({ headers: { Authorization: `Bearer ${token}` } });

const enJson = (token: string, cuerpo: unknown): RequestInit => ({
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(cuerpo),
});

/** El código del registro insertado dura 30 segundos: se cambia por el token del comité apenas llega. */
async function intercambiarCodigo(code: string) {
  const secreto = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secreto) return { ok: false, error: "Falta WHATSAPP_APP_SECRET." } as const;
  const parametros = new URLSearchParams({ client_id: META_APP_ID, client_secret: secreto, code });
  return llamar<{ access_token: string; expires_in?: number }>(`${graph("oauth/access_token")}?${parametros}`);
}

// ---------------------------------------------------------------- plantillas

type Boton = { type: "URL"; text: string; url: string; example: string[] };

const PLANTILLAS: {
  name: string;
  texto: string;
  ejemplos: string[];
  boton?: Boton;
}[] = [
  {
    name: "boleta_disponible",
    texto:
      "Hola {{1}}, te escribe {{2}}. Tu boleta de agua de {{3}} ya está disponible por un total de {{4}}, con vencimiento el {{5}}. Descarga tu recibo en PDF aquí: {{6}}\n\nGracias por tu pago.",
    ejemplos: ["Juan", "APR Los Aromos", "octubre de 2026", "$12.500", "10 de noviembre", `${SITIO}/r/ejemplo`],
    boton: {
      type: "URL",
      text: "Ver y pagar mi cuenta",
      url: `${SITIO}/pagar/{{1}}`,
      example: [`${SITIO}/pagar/abc123`],
    },
  },
  {
    name: "comprobante_pago",
    texto:
      "Hola {{1}}, te escribe {{2}}. Registramos tu pago de {{3}} de la boleta de {{4}}. Descarga tu comprobante aquí: {{5}}\n\n¡Gracias!",
    ejemplos: ["Juan", "APR Los Aromos", "$12.500", "octubre de 2026", `${SITIO}/p/ejemplo`],
  },
  {
    name: "aviso_corte",
    texto:
      "Hola {{1}}, te escribe {{2}}. Tu cuenta de agua tiene {{3}} vencidos. Para evitar el corte del servicio, regulariza tu deuda dentro de los próximos {{4}} días. Si ya pagaste, responde este mensaje con tu comprobante y lo registramos.",
    ejemplos: ["Juan", "APR Los Aromos", "$25.000", "10"],
  },
];

/** Crea las plantillas de utilidad en la cuenta del comité. Las que ya existen se saltan. */
async function crearPlantillas(wabaId: string, token: string) {
  const avisos: string[] = [];
  for (const p of PLANTILLAS) {
    const r = await llamar(
      graph(`${wabaId}/message_templates`),
      enJson(token, {
        name: p.name,
        language: "es_CL",
        category: "UTILITY",
        components: [
          { type: "BODY", text: p.texto, example: { body_text: [p.ejemplos] } },
          ...(p.boton ? [{ type: "BUTTONS", buttons: [p.boton] }] : []),
        ],
      })
    );
    if (!r.ok && !/already exists|ya existe/i.test(r.error)) avisos.push(`Plantilla ${p.name}: ${r.error}`);
  }
  return avisos;
}

// ---------------------------------------------------------------- conexión

export type ResultadoConexion = { ok: true; numero: string | null; avisos: string[] } | { ok: false; error: string };

/**
 * Convierte lo que devuelve el registro insertado en una conexión usable. Los
 * pasos que dejan el número sin poder enviar (token, webhook, registro) cortan
 * y quedan anotados; las plantillas no cortan: se pueden reintentar.
 */
export async function conectarComite(datos: {
  aprId: string;
  code: string;
  wabaId: string;
  phoneNumberId: string;
}): Promise<ResultadoConexion> {
  const { aprId, code, wabaId, phoneNumberId } = datos;

  const token = await intercambiarCodigo(code);
  if (!token.ok) return { ok: false, error: `No se pudo obtener el acceso del comité: ${token.error}` };
  const accessToken = token.datos.access_token;

  const info = await llamar<{ display_phone_number?: string; verified_name?: string }>(
    `${graph(phoneNumberId)}?fields=display_phone_number,verified_name`,
    autorizado(accessToken)
  );
  const numero = info.ok ? (info.datos.display_phone_number ?? null) : null;

  const pin = String(randomInt(100000, 1000000));
  const valores = {
    wabaId,
    phoneNumberId,
    numeroMostrado: numero,
    nombreVerificado: info.ok ? (info.datos.verified_name ?? null) : null,
    accessToken: cifrar(accessToken),
    tokenExpiraEn: token.datos.expires_in ? new Date(Date.now() + token.datos.expires_in * 1000) : null,
    pin: cifrar(pin),
    estado: "CONECTADA" as const,
    ultimoError: null,
    updatedAt: new Date(),
  };
  await db
    .insert(whatsappConexiones)
    .values({ aprId, ...valores })
    .onConflictDoUpdate({ target: whatsappConexiones.aprId, set: valores });

  const fallo = async (error: string): Promise<ResultadoConexion> => {
    await db
      .update(whatsappConexiones)
      .set({ estado: "ERROR", ultimoError: error.slice(0, 300), updatedAt: new Date() })
      .where(eq(whatsappConexiones.aprId, aprId));
    return { ok: false, error };
  };

  const suscripcion = await llamar(graph(`${wabaId}/subscribed_apps`), { method: "POST", ...autorizado(accessToken) });
  if (!suscripcion.ok) return fallo(`No se pudo suscribir el aviso de mensajes: ${suscripcion.error}`);

  const registro = await llamar(
    graph(`${phoneNumberId}/register`),
    enJson(accessToken, { messaging_product: "whatsapp", pin })
  );
  if (!registro.ok) return fallo(`No se pudo registrar el número: ${registro.error}`);

  const avisos = await crearPlantillas(wabaId, accessToken);
  return { ok: true, numero, avisos };
}

export async function desconectarComite(aprId: string) {
  await db.delete(whatsappConexiones).where(eq(whatsappConexiones.aprId, aprId));
}

/** Lo que se muestra del WhatsApp conectado de un comité; null si no tiene. */
export async function conexionDelComite(aprId: string) {
  const fila = await db.query.whatsappConexiones.findFirst({
    where: eq(whatsappConexiones.aprId, aprId),
    columns: { numeroMostrado: true, nombreVerificado: true, estado: true, ultimoError: true },
  });
  return fila ?? null;
}

/**
 * El número y el acceso con que enviar por este comité, si conectó el suyo.
 * Sin conexión (o con error) devuelve null y se usa el número de Facilapr.
 */
export async function credencialesDelComite(aprId: string) {
  const fila = await db.query.whatsappConexiones.findFirst({
    where: eq(whatsappConexiones.aprId, aprId),
    columns: { phoneNumberId: true, accessToken: true, estado: true },
  });
  if (!fila || fila.estado !== "CONECTADA") return null;
  try {
    return { phoneNumberId: fila.phoneNumberId, token: descifrar(fila.accessToken) };
  } catch {
    console.error("WhatsApp: no se pudo descifrar el acceso del comité.");
    return null;
  }
}
