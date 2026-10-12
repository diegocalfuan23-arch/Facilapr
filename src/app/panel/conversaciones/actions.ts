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

/** Mensajes que la persona de la directiva escribió ella misma (no los del socio ni los de la IA). */
async function mensajePropio(mensajeId: string) {
  const { user, apr } = await requireAdmin();
  const [fila] = await db
    .select({ id: mensajesSocio.id, socioId: mensajesSocio.socioId })
    .from(mensajesSocio)
    .innerJoin(socios, eq(socios.id, mensajesSocio.socioId))
    .where(
      and(
        eq(mensajesSocio.id, mensajeId),
        eq(socios.aprId, apr.id),
        eq(mensajesSocio.remitente, "DIRECTIVA"),
        eq(mensajesSocio.autorId, user.id)
      )
    )
    .limit(1);
  return fila ?? null;
}

export async function editarMensajeDirectiva(
  mensajeId: string,
  contenido: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = mensajeSchema.safeParse(contenido);
  if (!parsed.success) return { ok: false, error: "Escribe un mensaje válido." };

  const fila = await mensajePropio(mensajeId);
  if (!fila) return { ok: false, error: "Solo puedes editar tus propios mensajes." };

  await db
    .update(mensajesSocio)
    .set({ contenido: parsed.data, editadoAt: new Date() })
    .where(eq(mensajesSocio.id, fila.id));
  return { ok: true };
}

export async function eliminarMensajeDirectiva(
  mensajeId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fila = await mensajePropio(mensajeId);
  if (!fila) return { ok: false, error: "Solo puedes eliminar tus propios mensajes." };

  await db.delete(mensajesSocio).where(eq(mensajesSocio.id, fila.id));
  return { ok: true };
}

/** Pausar o reanudar la IA solo en la conversación de un socio. */
export async function pausarIaConversacion(socioId: string, pausada: boolean) {
  const { apr } = await requireAdmin();

  const r = await db
    .update(socios)
    .set({ iaPausada: pausada, updatedAt: new Date() })
    // El filtro por aprId impide tocar un socio de otro comité.
    .where(and(eq(socios.id, socioId), eq(socios.aprId, apr.id)))
    .returning({ id: socios.id });

  return r.length > 0;
}
