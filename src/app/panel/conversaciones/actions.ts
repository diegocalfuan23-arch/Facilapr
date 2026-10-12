"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
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

/**
 * Latido del panel de la directiva: avisa que hay alguien conectado y, si
 * corresponde, en qué conversación está escribiendo. La IA del chat lo mira para
 * no responder encima de una persona. Solo guarda algo si el comité usa el modo
 * «cuando no esté disponible».
 *
 * `escribiendoEn`: undefined = solo el latido; null = dejó de escribir;
 * un id = está escribiendo en esa conversación.
 */
export async function latidoPanel(escribiendoEn?: string | null) {
  const { user, apr } = await requireAdmin();
  if (apr.iaChatModo !== "SIN_RESPUESTA") return;

  try {
    if (escribiendoEn) {
      const socio = await db.query.socios.findFirst({
        where: and(eq(socios.id, escribiendoEn), eq(socios.aprId, apr.id)),
        columns: { id: true },
      });
      if (!socio) return;
    }

    await db.execute(sql`
      insert into "PresenciaComite" ("userId", "aprId", "visto", "escribiendoSocioId", "escribiendoAt")
      values (${user.id}, ${apr.id}, now(),
              ${escribiendoEn ?? null}, ${escribiendoEn ? sql`now()` : null})
      on conflict ("userId") do update set
        "aprId" = excluded."aprId",
        "visto" = now(),
        "escribiendoSocioId" = ${escribiendoEn === undefined ? sql`"PresenciaComite"."escribiendoSocioId"` : sql`excluded."escribiendoSocioId"`},
        "escribiendoAt" = ${escribiendoEn === undefined ? sql`"PresenciaComite"."escribiendoAt"` : sql`excluded."escribiendoAt"`}
    `);
  } catch {
    // Sin presencia, la IA simplemente no espera: nunca debe romper el panel.
  }
}
