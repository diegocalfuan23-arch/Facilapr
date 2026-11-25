"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, socios, subsidios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { estadoQueCorresponde, normalizarPeriodo, type EstadoBoleta } from "@/lib/boletas";
import { boletasPorAplicar } from "@/lib/subsidios";
import { sumarMeses } from "@/lib/subsidios-comun";

export type ResultadoSubsidio = { ok: true } | { ok: false; error: string };

const entero = (v: FormDataEntryValue | string | null) => {
  const t = String(v ?? "").trim();
  return /^\d+$/.test(t) ? Number(t) : null;
};

/** Agrega o cambia el subsidio de un arranque (uno por arranque). */
export async function guardarSubsidio(_prev: ResultadoSubsidio | null, formData: FormData): Promise<ResultadoSubsidio> {
  const { apr } = await requireAdmin();

  const socioId = String(formData.get("socioId") ?? "").trim();
  const socio = socioId
    ? await db.query.socios.findFirst({ where: and(eq(socios.id, socioId), eq(socios.aprId, apr.id)), columns: { id: true } })
    : null;
  if (!socio) return { ok: false, error: "Elige un socio." };

  const tipo = formData.get("tipo") === "MONTO" ? ("MONTO" as const) : ("PORCENTAJE" as const);
  // En pesos se acepta escrito con puntos o con $: «5.000».
  const valor = entero(String(formData.get("valor") ?? "").replace(/[$.\s%]/g, ""));
  if (tipo === "PORCENTAJE" && (valor === null || valor < 1 || valor > 100)) return { ok: false, error: "El porcentaje va de 1 a 100." };
  if (valor === null || valor < 1 || valor > 10_000_000) return { ok: false, error: "Escribe el monto del descuento." };

  const textoTope = tipo === "PORCENTAJE" ? String(formData.get("topeM3") ?? "").trim() : "";
  const topeM3 = textoTope ? entero(textoTope) : null;
  if (textoTope && (topeM3 === null || topeM3 < 1 || topeM3 > 100)) return { ok: false, error: "El tope va de 1 a 100 m³." };

  const desde = normalizarPeriodo(String(formData.get("desde") ?? ""));
  if (!desde) return { ok: false, error: "Elige desde qué mes rige." };
  const textoHasta = String(formData.get("hasta") ?? "").trim();
  const hasta = textoHasta ? normalizarPeriodo(textoHasta) : null;
  if (textoHasta && !hasta) return { ok: false, error: "El mes de término no es válido." };
  if (hasta && hasta < desde) return { ok: false, error: "El término no puede ser anterior al inicio." };

  const decreto = String(formData.get("decreto") ?? "").trim().slice(0, 60) || null;
  const valores = { tipo, valor, topeM3, desde, hasta, decreto, updatedAt: new Date() };

  await db
    .insert(subsidios)
    .values({ socioId, ...valores })
    .onConflictDoUpdate({ target: subsidios.socioId, set: valores });

  revalidatePath("/panel/subsidios");
  return { ok: true };
}

export async function quitarSubsidio(id: string): Promise<ResultadoSubsidio> {
  const { apr } = await requireAdmin();
  const [fila] = await db
    .select({ id: subsidios.id })
    .from(subsidios)
    .innerJoin(socios, eq(socios.id, subsidios.socioId))
    .where(and(eq(subsidios.id, id), eq(socios.aprId, apr.id)))
    .limit(1);
  if (!fila) return { ok: false, error: "No encontramos ese subsidio." };

  await db.delete(subsidios).where(eq(subsidios.id, fila.id));
  revalidatePath("/panel/subsidios");
  return { ok: true };
}

/** Corre doce meses el término de un subsidio. */
export async function renovarSubsidio(id: string): Promise<ResultadoSubsidio> {
  const { apr } = await requireAdmin();
  const [fila] = await db
    .select({ id: subsidios.id, hasta: subsidios.hasta })
    .from(subsidios)
    .innerJoin(socios, eq(socios.id, subsidios.socioId))
    .where(and(eq(subsidios.id, id), eq(socios.aprId, apr.id)))
    .limit(1);
  if (!fila) return { ok: false, error: "No encontramos ese subsidio." };
  if (!fila.hasta) return { ok: false, error: "Ese subsidio no tiene fecha de término." };

  await db.update(subsidios).set({ hasta: sumarMeses(fila.hasta, 12), updatedAt: new Date() }).where(eq(subsidios.id, fila.id));
  revalidatePath("/panel/subsidios");
  return { ok: true };
}

/**
 * Pone al día las boletas de un mes que ya existían: les aplica (o les quita) el subsidio. Solo toca las que
 * se calcularon con lecturas, no tienen pagos y cuyo subsidio cambia.
 */
export async function aplicarSubsidios(periodoPedido: string): Promise<{ ok: true; cambiadas: number } | { ok: false; error: string }> {
  const { apr } = await requireAdmin();
  const periodo = normalizarPeriodo(periodoPedido);
  if (!periodo) return { ok: false, error: "El mes no es válido." };

  const filas = await boletasPorAplicar(apr.id, periodo);
  for (const b of filas) {
    await db
      .update(boletas)
      .set({ montoSubsidio: b.montoSubsidio, montoTotal: b.montoTotal, estado: estadoQueCorresponde(b.montoTotal, 0, b.vence, b.estado as EstadoBoleta), updatedAt: new Date() })
      // Si entre medio se registró un pago, esa boleta no se toca.
      .where(and(eq(boletas.id, b.id), eq(boletas.montoPagado, 0)));
  }

  revalidatePath("/panel");
  return { ok: true, cambiadas: filas.length };
}
