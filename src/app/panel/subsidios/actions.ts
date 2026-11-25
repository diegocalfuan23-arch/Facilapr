"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, socios, subsidios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { estadoQueCorresponde, montoDeSubsidio, normalizarPeriodo, subsidioVigente, type EstadoBoleta } from "@/lib/boletas";
import { subsidiosDelApr } from "@/lib/subsidios";

export type ResultadoSubsidio = { ok: true } | { ok: false; error: string };

const entero = (v: FormDataEntryValue | null) => {
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

  const porcentaje = entero(formData.get("porcentaje"));
  if (porcentaje === null || porcentaje < 1 || porcentaje > 100) return { ok: false, error: "El porcentaje va de 1 a 100." };
  const topeM3 = entero(formData.get("topeM3"));
  if (topeM3 === null || topeM3 < 1 || topeM3 > 100) return { ok: false, error: "El tope va de 1 a 100 m³." };

  const desde = normalizarPeriodo(String(formData.get("desde") ?? ""));
  if (!desde) return { ok: false, error: "Elige desde qué mes rige." };
  const textoHasta = String(formData.get("hasta") ?? "").trim();
  const hasta = textoHasta ? normalizarPeriodo(textoHasta) : null;
  if (textoHasta && !hasta) return { ok: false, error: "El mes de término no es válido." };
  if (hasta && hasta < desde) return { ok: false, error: "El término no puede ser anterior al inicio." };

  const decreto = String(formData.get("decreto") ?? "").trim().slice(0, 60) || null;
  const valores = { porcentaje, topeM3, desde, hasta, decreto, updatedAt: new Date() };

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

/**
 * Pone al día las boletas de un mes que ya existían: les aplica (o les quita) el subsidio. Solo toca las que
 * se calcularon con lecturas, no tienen pagos y cuyo subsidio cambia.
 */
export async function aplicarSubsidios(periodoPedido: string): Promise<{ ok: true; cambiadas: number } | { ok: false; error: string }> {
  const { apr } = await requireAdmin();
  const periodo = normalizarPeriodo(periodoPedido);
  if (!periodo) return { ok: false, error: "El mes no es válido." };

  const porSocio = await subsidiosDelApr(apr.id);
  const filas = await db
    .select({
      id: boletas.id,
      socioId: boletas.socioId,
      cargoFijo: boletas.cargoFijo,
      valorM3: boletas.valorM3,
      consumoM3: boletas.consumoM3,
      montoSubsidio: boletas.montoSubsidio,
      estado: boletas.estado,
      vence: boletas.fechaVencimiento,
    })
    .from(boletas)
    .innerJoin(socios, eq(socios.id, boletas.socioId))
    .where(
      and(
        eq(socios.aprId, apr.id),
        eq(boletas.periodo, periodo),
        eq(boletas.montoPagado, 0),
        ne(boletas.estado, "ANULADA"),
        isNotNull(boletas.cargoFijo),
        isNotNull(boletas.valorM3),
        isNotNull(boletas.consumoM3)
      )
    );

  let cambiadas = 0;
  for (const b of filas) {
    const regla = subsidioVigente(porSocio.get(b.socioId), periodo);
    const montoSubsidio = montoDeSubsidio(b.cargoFijo!, b.valorM3!, b.consumoM3!, regla);
    if (montoSubsidio === b.montoSubsidio) continue;
    const montoTotal = b.cargoFijo! + b.consumoM3! * b.valorM3! - montoSubsidio;
    await db
      .update(boletas)
      .set({ montoSubsidio, montoTotal, estado: estadoQueCorresponde(montoTotal, 0, b.vence, b.estado as EstadoBoleta), updatedAt: new Date() })
      // Si entre medio se registró un pago, esa boleta no se toca.
      .where(and(eq(boletas.id, b.id), eq(boletas.montoPagado, 0)));
    cambiadas++;
  }

  revalidatePath("/panel");
  return { ok: true, cambiadas };
}
