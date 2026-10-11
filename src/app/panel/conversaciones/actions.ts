"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios, mensajesSocio } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { enviarMensajeChat, type MensajeChat } from "@/lib/chat-socio";
import { puede, type Plan } from "@/lib/planes";

const mensajeSchema = z.string().trim().min(1).max(1000);

export type ResultadoEnvioChat =
  | { ok: true; mensaje: MensajeChat }
  | { ok: false; error: string };

export async function enviarMensajeDirectiva(
  socioId: string,
  contenido: string
): Promise<ResultadoEnvioChat> {
  const { user, apr } = await requireAdmin();

  if (!puede(apr.plan as Plan, "chat")) {
    return { ok: false, error: "El chat en tiempo real es del plan Estándar o superior." };
  }

  const socio = await db.query.socios.findFirst({
    where: and(eq(socios.id, socioId), eq(socios.aprId, apr.id)),
    columns: { id: true },
  });
  if (!socio) {
    return { ok: false, error: "Ese socio no pertenece a tu comité." };
  }

  const parsed = mensajeSchema.safeParse(contenido);
  if (!parsed.success) {
    return { ok: false, error: "Escribe un mensaje válido." };
  }

  const mensaje = await enviarMensajeChat({
    socioId,
    remitente: "DIRECTIVA",
    autorId: user.id,
    contenido: parsed.data,
  });

  return { ok: true, mensaje };
}

/** Marca como leídos, del lado de la directiva, todos los mensajes de un socio. */
export async function marcarLeidoDirectiva(socioId: string) {
  const { apr } = await requireAdmin();

  const socio = await db.query.socios.findFirst({
    where: and(eq(socios.id, socioId), eq(socios.aprId, apr.id)),
    columns: { id: true },
  });
  if (!socio) return;

  await db
    .update(mensajesSocio)
    .set({ leidoPorDirectiva: true })
    .where(
      and(
        eq(mensajesSocio.socioId, socioId),
        eq(mensajesSocio.leidoPorDirectiva, false)
      )
    );
}
