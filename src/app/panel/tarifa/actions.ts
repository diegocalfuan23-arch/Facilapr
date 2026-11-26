"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { produccionAgua } from "@/lib/db/schema";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { aniosDisponibles, mesCortoDe } from "@/lib/tarifa-comun";

export type ResultadoProduccion = { ok: true } | { ok: false; error: string };

/** Guarda lo producido en uno o varios meses. Un mes en blanco queda sin registro. */
export async function guardarProduccion(valores: Record<string, string>): Promise<ResultadoProduccion> {
  const { apr } = await requireFinanzas();
  if (!puede(apr.plan as Plan, "finanzas")) return { ok: false, error: "No disponible en tu plan." };

  const hoy = hoyEnChile();
  const { desde } = aniosDisponibles(hoy);
  const entradas = Object.entries(valores ?? {});
  if (entradas.length === 0 || entradas.length > 12) return { ok: false, error: "No hay nada que guardar." };

  const guardar: { periodo: string; m3: number }[] = [];
  const borrar: string[] = [];
  for (const [periodo, valor] of entradas) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo) || periodo < `${desde}-01` || periodo > hoy.slice(0, 7)) return { ok: false, error: "Ese mes no se puede anotar." };
    // Se acepta escrito con puntos de miles: «1.250».
    const limpio = String(valor).replace(/[.\s]/g, "");
    if (!limpio) borrar.push(periodo);
    else if (!/^\d+$/.test(limpio) || Number(limpio) > 10_000_000) return { ok: false, error: `Revisa ${mesCortoDe(periodo)}: van metros cúbicos enteros.` };
    else guardar.push({ periodo, m3: Number(limpio) });
  }

  for (const { periodo, m3 } of guardar) {
    await db
      .insert(produccionAgua)
      .values({ aprId: apr.id, periodo, m3 })
      .onConflictDoUpdate({ target: [produccionAgua.aprId, produccionAgua.periodo], set: { m3, updatedAt: new Date() } });
  }
  if (borrar.length > 0) await db.delete(produccionAgua).where(and(eq(produccionAgua.aprId, apr.id), inArray(produccionAgua.periodo, borrar)));

  revalidatePath("/panel/tarifa");
  return { ok: true };
}
