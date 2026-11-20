import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mensajesSocio, socios } from "@/lib/db/schema";
import { enviarTexto } from "@/lib/whatsapp-api";
import { credencialesDelComite } from "@/lib/whatsapp-conexion";

/** Meta deja escribir un texto libre hasta 24 horas después del último mensaje de la persona. */
const VENTANA_MS = 24 * 60 * 60_000;

export type EntregaWhatsapp = { metaId?: string; entrega: null | "FALLIDA" | "FUERA_DE_VENTANA" };

/**
 * Cuando lo que se escribe en el chat responde a un mensaje que el socio mandó por WhatsApp, también sale por WhatsApp,
 * desde el número del comité. Si el último mensaje del socio fue por el portal, no hace nada. Nunca lanza.
 */
export async function entregarPorWhatsappSiCorresponde(socioId: string, texto: string): Promise<EntregaWhatsapp> {
  try {
    const ultimo = await db.query.mensajesSocio.findFirst({
      where: and(eq(mensajesSocio.socioId, socioId), eq(mensajesSocio.remitente, "SOCIO")),
      orderBy: [desc(mensajesSocio.createdAt)],
      columns: { canal: true, createdAt: true },
    });
    if (!ultimo || ultimo.canal !== "WHATSAPP") return { entrega: null };
    if (Date.now() - ultimo.createdAt.getTime() > VENTANA_MS) return { entrega: "FUERA_DE_VENTANA" };

    const socio = await db.query.socios.findFirst({ where: eq(socios.id, socioId), columns: { aprId: true, telefono: true } });
    if (!socio?.telefono) return { entrega: "FALLIDA" };
    const credenciales = await credencialesDelComite(socio.aprId);
    if (!credenciales) return { entrega: "FALLIDA" };

    const r = await enviarTexto(socio.telefono, texto, credenciales);
    if (!r.ok) {
      console.error("WhatsApp: no se pudo enviar la respuesta del chat:", r.error);
      return { entrega: "FALLIDA" };
    }
    return { metaId: r.id, entrega: null };
  } catch (e) {
    console.error("WhatsApp: error al enviar la respuesta del chat:", e instanceof Error ? e.message : "error");
    return { entrega: "FALLIDA" };
  }
}
