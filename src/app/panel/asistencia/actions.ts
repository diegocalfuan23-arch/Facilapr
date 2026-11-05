"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { asistencias, trabajadores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";
import { ESTADOS_ASISTENCIA_MANUAL, type EstadoAsistencia } from "@/lib/rrhh-comun";

export type ResultadoAsistencia = { ok: true } | { ok: false; error: string };

/** Marca (o cambia) el estado de una persona en un día. Con `estado` null, quita la marca. */
export async function marcarAsistencia(
  trabajadorId: string,
  dia: string,
  estado: EstadoAsistencia | null,
  nota?: string
): Promise<ResultadoAsistencia> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: "RR.HH. está disponible desde el plan Estándar." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, error: "La fecha no es válida." };
  if (estado !== null && !ESTADOS_ASISTENCIA_MANUAL.includes(estado)) return { ok: false, error: "Ese estado no se marca a mano." };

  const [persona] = await db
    .select({ id: trabajadores.id })
    .from(trabajadores)
    .where(and(eq(trabajadores.id, trabajadorId), eq(trabajadores.aprId, apr.id)))
    .limit(1);
  if (!persona) return { ok: false, error: "No encontramos a esa persona." };

  try {
    if (estado === null) {
      await db.delete(asistencias).where(and(eq(asistencias.trabajadorId, trabajadorId), eq(asistencias.fecha, dia), eq(asistencias.aprId, apr.id)));
    } else {
      const notaLimpia = (nota ?? "").trim().slice(0, 200) || null;
      await db
        .insert(asistencias)
        .values({ aprId: apr.id, trabajadorId, fecha: dia, estado, nota: notaLimpia })
        .onConflictDoUpdate({ target: [asistencias.trabajadorId, asistencias.fecha], set: { estado, nota: notaLimpia } });
    }
  } catch (e) {
    console.error("RR.HH.: no se pudo marcar la asistencia:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar la marca. Inténtalo de nuevo.") };
  }

  revalidatePath("/panel/asistencia");
  return { ok: true };
}
