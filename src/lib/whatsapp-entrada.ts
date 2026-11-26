import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, mensajesSocio, socios, whatsappConexiones } from "@/lib/db/schema";
import { enviarMensajeChat } from "@/lib/chat-socio";
import { puede, type Plan } from "@/lib/planes";
import { descargarArchivoDeMeta, telefonoParaWhatsapp } from "@/lib/whatsapp-api";
import { credencialesDelComite } from "@/lib/whatsapp-conexion";
import { almacenamientoListo, borrarArchivo, guardarEntrante, type ArchivoGuardado } from "@/lib/adjuntos";
import { textoDeAdjunto } from "@/lib/adjuntos-comun";

type MensajeMeta = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: Archivo;
  audio?: Archivo;
  video?: Archivo;
  document?: Archivo;
};

type Archivo = { id?: string; caption?: string; filename?: string };

/** El archivo de un mensaje entrante, ya guardado, con el texto que lo acompaña. Null si no trae uno o no se pudo guardar. */
async function archivoDe(m: MensajeMeta, aprId: string): Promise<{ archivo: ArchivoGuardado; texto: string } | null> {
  const clase = m.type === "image" || m.type === "audio" || m.type === "video" || m.type === "document" ? m.type : null;
  const dato = clase ? m[clase] : undefined;
  if (!clase || !dato?.id || !almacenamientoListo()) return null;
  const credenciales = await credencialesDelComite(aprId);
  if (!credenciales) return null;
  const bajado = await descargarArchivoDeMeta(dato.id, credenciales);
  if (!bajado) return null;
  const porDefecto = { image: "Foto", audio: "Audio", video: "Video", document: "Documento" }[clase];
  const archivo = await guardarEntrante(bajado.bytes, bajado.tipo, dato.filename, porDefecto);
  return archivo ? { archivo, texto: dato.caption?.slice(0, 1000) || textoDeAdjunto(archivo.nombre) } : null;
}

/** El texto que se guarda de un mensaje entrante sin archivo (o cuyo archivo no se pudo guardar: queda anotado). */
function textoDe(m: MensajeMeta): string {
  if (m.type === "text" && m.text?.body) return m.text.body.slice(0, 1000);
  if (m.type === "button" && m.button?.text) return m.button.text;
  if (m.type === "interactive") return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "[Respuesta]";
  const anotado: Record<string, string> = {
    image: "📷 Imagen (no se pudo guardar)",
    audio: "🎤 Audio (no se pudo guardar)",
    voice: "🎤 Audio (no se pudo guardar)",
    video: "🎬 Video (no se pudo guardar)",
    document: "📎 Documento (no se pudo guardar)",
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
          // Si Meta repite el aviso, no se vuelve a bajar ni a guardar.
          const yaEsta = await db.query.mensajesSocio.findFirst({ where: eq(mensajesSocio.metaId, m.id), columns: { id: true } });
          if (yaEsta) continue;
          const conArchivo = await archivoDe(m, conexion.aprId);
          try {
            await enviarMensajeChat({ socioId: socio.id, remitente: "SOCIO", autorId: null, contenido: conArchivo?.texto ?? textoDe(m), canal: "WHATSAPP", metaId: m.id, archivo: conArchivo?.archivo });
            aResponder.add(socio.id);
          } catch (e) {
            await borrarArchivo(conArchivo?.archivo.clave ?? null);
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
