import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { insumos, laborInsumos } from "@/lib/db/schema";
import { anotarCambioStock } from "@/lib/inventario-historial";
import { formatoCantidad, unidadCorta } from "@/lib/inventario-comun";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** `userId` es null cuando el cambio lo hace el sistema solo (una labor que llegó a su hora). */
export type Ctx = { aprId: string; userId: string | null; auto?: boolean };

/** Un error que se le muestra tal cual a quien usa el panel (no es una falla del sistema). */
export class ErrorLabor extends Error {}

function redondear(n: number) {
  return Math.round(n * 1000) / 1000;
}

/** Devuelve al inventario lo que la labor había descontado. Si un material se borró del inventario, no hay a dónde devolverlo. */
export async function devolverStock(tx: Tx, ctx: Ctx, labor: { id: string; numero: number }) {
  const lineas = await tx.select().from(laborInsumos).where(eq(laborInsumos.laborId, labor.id));
  for (const l of lineas) {
    if (!l.insumoId) continue;
    const [m] = await tx
      .update(insumos)
      .set({ stock: sql`${insumos.stock} + ${l.cantidad}`, updatedAt: new Date() })
      .where(and(eq(insumos.id, l.insumoId), eq(insumos.aprId, ctx.aprId)))
      .returning({ stock: insumos.stock });
    if (!m) continue;
    await anotarCambioStock(tx, {
      aprId: ctx.aprId,
      insumoId: l.insumoId,
      insumoNombre: l.insumoNombre,
      unidad: l.unidad,
      cantidad: l.cantidad,
      stockResultante: redondear(m.stock),
      origen: "LABOR_DEVUELTA",
      motivo: `Labor L-${labor.numero}${ctx.auto ? " (automático)" : ""}`,
      registradoPorId: ctx.userId,
    });
  }
}

/** Descuenta del inventario lo que usa la labor. Falla, sin tocar nada, si algún material no alcanza. */
export async function descontarStock(tx: Tx, ctx: Ctx, labor: { id: string; numero: number }) {
  const lineas = await tx.select().from(laborInsumos).where(eq(laborInsumos.laborId, labor.id));
  for (const l of lineas) {
    if (!l.insumoId) throw new ErrorLabor(`«${l.insumoNombre}» ya no está en el inventario. Quítalo de la labor o vuelve a crearlo.`);
    // Se descuenta solo si alcanza, en el mismo paso: dos labores a la vez no pueden dejar el stock bajo cero.
    const [m] = await tx
      .update(insumos)
      .set({ stock: sql`${insumos.stock} - ${l.cantidad}`, updatedAt: new Date() })
      .where(and(eq(insumos.id, l.insumoId), eq(insumos.aprId, ctx.aprId), sql`${insumos.stock} >= ${l.cantidad}`))
      .returning({ stock: insumos.stock, costo: insumos.costo });
    if (!m) {
      const [actual] = await tx.select({ stock: insumos.stock }).from(insumos).where(eq(insumos.id, l.insumoId)).limit(1);
      throw new ErrorLabor(
        `No alcanza «${l.insumoNombre}»: hay ${formatoCantidad(actual?.stock ?? 0)} ${unidadCorta(l.unidad)} y la labor usa ${formatoCantidad(l.cantidad)}.`
      );
    }
    await tx.update(laborInsumos).set({ costoUnitario: m.costo }).where(eq(laborInsumos.id, l.id));
    await anotarCambioStock(tx, {
      aprId: ctx.aprId,
      insumoId: l.insumoId,
      insumoNombre: l.insumoNombre,
      unidad: l.unidad,
      cantidad: -l.cantidad,
      stockResultante: redondear(m.stock),
      origen: "LABOR",
      motivo: `Labor L-${labor.numero}${ctx.auto ? " (automático)" : ""}`,
      registradoPorId: ctx.userId,
    });
  }
}

