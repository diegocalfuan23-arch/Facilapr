"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { comunicados } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { MENSAJE_COMUNICADO_MAX, TITULO_COMUNICADO_MAX } from "@/lib/comunicados-comun";

export type ResultadoComunicado = { ok: true } | { ok: false; error: string };

/** Publica un comunicado: queda en «Avisos del comité» de la cuenta en línea de los socios. Solo la directiva. */
export async function publicarComunicado(titulo: string, mensaje: string): Promise<ResultadoComunicado> {
  const { user, apr } = await requireAdmin();

  const t = String(titulo ?? "").trim();
  const m = String(mensaje ?? "").trim();
  if (!t) return { ok: false, error: "Escribe un título." };
  if (!m) return { ok: false, error: "Escribe el mensaje." };
  if (t.length > TITULO_COMUNICADO_MAX) return { ok: false, error: `El título no puede pasar de ${TITULO_COMUNICADO_MAX} letras.` };
  if (m.length > MENSAJE_COMUNICADO_MAX) return { ok: false, error: `El mensaje no puede pasar de ${MENSAJE_COMUNICADO_MAX} letras.` };

  try {
    // Un tope por día: evita llenar la cuenta de los socios de avisos por un doble clic o un error.
    const [hoy] = await db
      .select({ n: count() })
      .from(comunicados)
      .where(and(eq(comunicados.aprId, apr.id), gte(comunicados.createdAt, new Date(Date.now() - 86_400_000))));
    if ((hoy?.n ?? 0) >= 10) return { ok: false, error: "Ya publicaste 10 comunicados en las últimas 24 horas. Borra alguno o espera." };

    await db.insert(comunicados).values({ aprId: apr.id, titulo: t, mensaje: m, autorId: user.id });
  } catch (e) {
    console.error("Comunicados: no se pudo publicar:", e);
    return { ok: false, error: "No pudimos publicar el comunicado. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel");
  return { ok: true };
}

/** Borra un comunicado del comité (por ejemplo, uno publicado por error). */
export async function borrarComunicado(id: string): Promise<ResultadoComunicado> {
  const { apr } = await requireAdmin();

  try {
    const borrados = await db
      .delete(comunicados)
      .where(and(eq(comunicados.id, id), eq(comunicados.aprId, apr.id)))
      .returning({ id: comunicados.id });
    if (borrados.length === 0) return { ok: false, error: "No encontramos ese comunicado." };
  } catch (e) {
    console.error("Comunicados: no se pudo borrar:", e);
    return { ok: false, error: "No pudimos borrar el comunicado. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel");
  return { ok: true };
}
