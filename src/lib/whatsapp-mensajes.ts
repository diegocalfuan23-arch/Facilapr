import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  mensajesWhatsapp,
  type EstadoMensajeWhatsapp,
  type TipoMensajeWhatsapp,
} from "@/lib/db/schema";

/**
 * Registro de los mensajes de WhatsApp que Facilapr manda por la API: para no
 * repetir un envío, para saber si llegó y para contar lo que usó cada comité.
 * Si no se puede anotar, el mensaje ya salió: se deja el error en el registro
 * del servidor y no se hace fallar al que envió.
 */

export async function registrarMensaje(datos: {
  aprId: string;
  socioId: string | null;
  tipo: TipoMensajeWhatsapp;
  referenciaId?: string;
  plantilla: string;
  metaId: string;
}) {
  try {
    await db.insert(mensajesWhatsapp).values(datos);
    return true;
  } catch (e) {
    console.error("No se pudo registrar el mensaje de WhatsApp:", e instanceof Error ? e.message : "error");
    return false;
  }
}

/** Los estados que Meta avisa, en el vocabulario de Facilapr. */
const ESTADO_DE_META: Record<string, EstadoMensajeWhatsapp> = {
  sent: "ENVIADO",
  delivered: "ENTREGADO",
  read: "LEIDO",
  failed: "FALLIDO",
};

/** Desde qué estados se puede pasar a cada uno: los avisos de Meta pueden llegar desordenados y un "enviado" tardío no debe borrar un "leído". */
const DESDE: Record<EstadoMensajeWhatsapp, EstadoMensajeWhatsapp[]> = {
  ENVIADO: [],
  ENTREGADO: ["ENVIADO"],
  LEIDO: ["ENVIADO", "ENTREGADO"],
  FALLIDO: ["ENVIADO"],
};

export async function actualizarEstadoMensaje(metaId: string, estadoMeta: string, error?: string) {
  const estado = ESTADO_DE_META[estadoMeta];
  if (!estado || DESDE[estado].length === 0) return;
  await db
    .update(mensajesWhatsapp)
    .set({ estado, error: error ?? null, updatedAt: new Date() })
    .where(and(eq(mensajesWhatsapp.metaId, metaId), inArray(mensajesWhatsapp.estado, DESDE[estado])));
}
