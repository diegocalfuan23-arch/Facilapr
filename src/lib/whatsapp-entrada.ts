import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, mensajesSocio, socios, whatsappConexiones } from "@/lib/db/schema";
import { enviarMensajeChat } from "@/lib/chat-socio";
import { puede, type Plan } from "@/lib/planes";
import { telefonoParaWhatsapp } from "@/lib/whatsapp-api";

type MensajeMeta = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
};

/** El texto que se guarda de un mensaje entrante. Lo que no es texto (foto, audio…) queda anotado, sin el archivo. */
function textoDe(m: MensajeMeta): string {
  if (m.type === "text" && m.text?.body) return m.text.body.slice(0, 1000);
  if (m.type === "button" && m.button?.text) return m.button.text;
  if (m.type === "interactive") return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "[Respuesta]";
  const anotado: Record<string, string> = {
    image: "📷 Imagen (aún no se puede ver aquí)",
    audio: "🎤 Audio (aún no se puede escuchar aquí)",
    voice: "🎤 Audio (aún no se puede escuchar aquí)",
    video: "🎬 Video (aún no se puede ver aquí)",
    document: "📎 Documento (aún no se puede ver aquí)",
    sticker: "Sticker",
    location: "📍 Ubicación",
    contacts: "Contacto compartido",
  };
  return anotado[m.type ?? ""] ?? "[Mensaje que Facilapr aún no puede mostrar]";
}

/**
 * Guarda los mensajes que los socios escriben al WhatsApp del comité, dentro de la misma conversación del chat. Se
 * reconoce al socio por su teléfono. Devuelve los socios a los que hay que responder (para que conteste la IA).
 */
export async function registrarMensajesEntrantes(cuerpo: string): Promise<string[]> {
  const aResponder = new Set<string>();
  try {
    const datos = JSON.parse(cuerpo) as {
      entry?: { changes?: { value?: { metadata?: { phone_number_id?: string }; messages?: MensajeMeta[] } }[] }[];
    };
    for (const entrada of datos.entry ?? []) {
      for (const cambio of entrada.changes ?? []) {
        const valor = cambio.value;
        const mensajes = valor?.messages ?? [];
        if (mensajes.length === 0 || !valor?.metadata?.phone_number_id) continue;

        const conexion = await db.query.whatsappConexiones.findFirst({
          where: eq(whatsappConexiones.phoneNumberId, valor.metadata.phone_number_id),
          columns: { aprId: true },
        });
        if (!conexion) continue;
        // Sin el chat en el plan no hay dónde mostrarlos.
        const apr = await db.query.aprs.findFirst({ where: eq(aprs.id, conexion.aprId), columns: { plan: true } });
        if (!apr || !puede(apr.plan as Plan, "chat")) continue;

        const candidatos = await db
          .select({ id: socios.id, telefono: socios.telefono })
          .from(socios)
          .where(and(eq(socios.aprId, conexion.aprId), isNotNull(socios.telefono)))
          .orderBy(asc(socios.createdAt));

        for (const m of mensajes) {
          if (!m.id || !m.from) continue;
          const socio = candidatos.find((s) => s.telefono && telefonoParaWhatsapp(s.telefono) === m.from);
          if (!socio) {
            console.info(`WhatsApp: mensaje de un número que no es de ningún socio (…${m.from.slice(-4)})`);
            continue;
          }
          try {
            await enviarMensajeChat({ socioId: socio.id, remitente: "SOCIO", autorId: null, contenido: textoDe(m), canal: "WHATSAPP", metaId: m.id });
            aResponder.add(socio.id);
          } catch (e) {
            // Meta puede avisar dos veces lo mismo: el id repetido se ignora.
            const repetido = e instanceof Error && /duplicate|unique|23505/i.test(`${e.message} ${(e as { code?: string }).code ?? ""}`);
            if (!repetido) console.error("WhatsApp: no se pudo guardar un mensaje entrante:", e instanceof Error ? e.message : "error");
          }
        }
      }
    }
  } catch (e) {
    console.error("WhatsApp webhook (entrantes):", e instanceof Error ? e.message : "error");
  }
  return [...aResponder];
}

/** Estados de lo que salió por el chat: «leído» marca el mensaje como leído; «fallido» lo deja anotado. */
export async function registrarEstadoDeChat(metaId: string, estado: string) {
  if (estado === "read") await db.update(mensajesSocio).set({ leidoPorSocio: true }).where(eq(mensajesSocio.metaId, metaId));
  else if (estado === "failed") await db.update(mensajesSocio).set({ entrega: "FALLIDA" }).where(eq(mensajesSocio.metaId, metaId));
}
