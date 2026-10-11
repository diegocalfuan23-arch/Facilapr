"use server";

import { z } from "zod";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mensajesSocio } from "@/lib/db/schema";
import { requireSocio } from "@/lib/socio-session";
import { enviarMensajeChat, type MensajeChat } from "@/lib/chat-socio";
import { puede, type Plan } from "@/lib/planes";
import { responderConIaSiCorresponde } from "@/lib/ia-chat";

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

/** Marca como leídos, del lado del socio, los mensajes que le mandó la directiva. */
export async function marcarLeidoSocio(slug: string) {
  const { socio } = await requireSocio(slug);

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
