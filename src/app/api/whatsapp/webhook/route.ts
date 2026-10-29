import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Aviso de WhatsApp (Meta): mensajes entrantes y estado de los enviados
 * (enviado, entregado, leído, fallido).
 *
 * Variables de entorno (en Vercel; nunca en el código):
 *  - WHATSAPP_VERIFY_TOKEN: texto largo al azar; se escribe igual en Meta al registrar el webhook.
 *  - WHATSAPP_APP_SECRET: la clave secreta de la app (Configuración de la app → Básica); firma cada aviso.
 *
 * Por ahora solo confirma la recepción: todavía no se guarda nada.
 */

/** Meta pregunta una vez, al registrar el webhook, si somos nosotros. */
export function GET(req: Request) {
  const url = new URL(req.url);
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
  if (
    esperado &&
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === esperado
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("prohibido", { status: 403 });
}

function firmaValida(cuerpo: string, firma: string | null) {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto || !firma?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", secreto).update(cuerpo).digest();
  const recibida = Buffer.from(firma.slice("sha256=".length), "hex");
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

/**
 * Deja en el registro del servidor cómo va cada mensaje enviado (sent, delivered,
 * read, failed) y el motivo si falló, sin guardar el teléfono. Es solo para
 * diagnosticar; el registro en la base viene después.
 */
function registrarEstados(cuerpo: string) {
  try {
    const datos = JSON.parse(cuerpo) as {
      entry?: { changes?: { value?: { statuses?: { id?: string; status?: string; errors?: { code?: number; title?: string }[] }[] } }[] }[];
    };
    for (const entrada of datos.entry ?? []) {
      for (const cambio of entrada.changes ?? []) {
        for (const e of cambio.value?.statuses ?? []) {
          const motivo = e.errors?.map((x) => `${x.code} ${x.title}`).join("; ");
          console.info(`WhatsApp estado ${e.status}: ${e.id}${motivo ? ` (${motivo})` : ""}`);
        }
      }
    }
  } catch {
    // Un aviso que no se puede leer no debe hacer fallar la respuesta a Meta.
  }
}

export async function POST(req: Request) {
  const cuerpo = await req.text();
  if (!firmaValida(cuerpo, req.headers.get("x-hub-signature-256"))) {
    return new Response("firma inválida", { status: 401 });
  }
  registrarEstados(cuerpo);
  return new Response("ok");
}
