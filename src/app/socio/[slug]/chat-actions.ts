"use server";

import { z } from "zod";
import { after } from "next/server";
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { mensajesSocio } from "@/lib/db/schema";
import { requireSocio } from "@/lib/socio-session";
import { enviarMensajeChat, type MensajeChat } from "@/lib/chat-socio";
import { puede, type Plan } from "@/lib/planes";
import { responderConIaSiCorresponde } from "@/lib/ia-chat";
import { borrarArchivo, subirArchivoDelChat } from "@/lib/adjuntos";
import { textoDeAdjunto } from "@/lib/adjuntos-comun";

const mensajeSchema = z.string().trim().min(1).max(1000);

export type ResultadoEnvioChat =
  | { ok: true; mensaje: MensajeChat }
  | { ok: false; error: string };

export async function enviarMensajeSocio(
  slug: string,
  contenido: string
): Promise<ResultadoEnvioChat> {
  const { socio } = await requireSocio(slug);

  if (!puede(socio.apr.plan as Plan, "chat")) {
    return { ok: false, error: "Tu comité no tiene el chat activado." };
  }

  const parsed = mensajeSchema.safeParse(contenido);
  if (!parsed.success) {
    return { ok: false, error: "Escribe un mensaje válido." };
  }

  const mensaje = await enviarMensajeChat({
    socioId: socio.id,
    remitente: "SOCIO",
    autorId: null,
    contenido: parsed.data,
  });

  // La IA contesta después de responderle al socio: no lo hace esperar.
  after(() => responderConIaSiCorresponde(socio.id));

  return { ok: true, mensaje };
}

/** Cuántos archivos puede mandar un arranque en 24 horas: evita que se llene el almacenamiento. */
const ARCHIVOS_POR_DIA = 20;

/** Un archivo (con o sin texto) del socio a su comité. Campos: archivo, texto. */
export async function enviarAdjuntoSocio(slug: string, formData: FormData): Promise<ResultadoEnvioChat> {
  const { socio } = await requireSocio(slug);
  if (!puede(socio.apr.plan as Plan, "chat")) {
    return { ok: false, error: "Tu comité no tiene el chat activado." };
  }

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) return { ok: false, error: "Elige un archivo." };
  const texto = String(formData.get("texto") ?? "").trim().slice(0, 1000);

  const [hoy] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mensajesSocio)
    .where(
      and(
        eq(mensajesSocio.socioId, socio.id),
        eq(mensajesSocio.remitente, "SOCIO"),
        isNotNull(mensajesSocio.adjuntoClave),
        gt(mensajesSocio.createdAt, new Date(Date.now() - 24 * 60 * 60_000))
      )
    );
  if ((hoy?.n ?? 0) >= ARCHIVOS_POR_DIA) return { ok: false, error: "Llegaste al máximo de archivos por hoy." };

  const subido = await subirArchivoDelChat(archivo);
  if (!subido.ok) return subido;
  let mensaje: MensajeChat;
  try {
    mensaje = await enviarMensajeChat({
      socioId: socio.id,
      remitente: "SOCIO",
      autorId: null,
      contenido: texto || textoDeAdjunto(subido.archivo.nombre),
      archivo: subido.archivo,
    });
  } catch (e) {
    await borrarArchivo(subido.archivo.clave);
    throw e;
  }
  after(() => responderConIaSiCorresponde(socio.id));
  return { ok: true, mensaje };
}

/** Marca como leídos, del lado del socio, los mensajes que le mandó la directiva. */
export async function marcarLeidoSocio(slug: string) {
  const { socio } = await requireSocio(slug);

  // Si su último mensaje sigue sin respuesta (por ejemplo, la directiva se fue y ya pasó su pausa), la IA lo retoma al abrir el chat.
  after(() => responderConIaSiCorresponde(socio.id));

  await db
    .update(mensajesSocio)
    .set({ leidoPorSocio: true })
    .where(
      and(
        eq(mensajesSocio.socioId, socio.id),
        eq(mensajesSocio.leidoPorSocio, false)
      )
    );
}
