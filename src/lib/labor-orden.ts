import { and, eq, inArray, sql } from "drizzle-orm";
import { labores, ordenes } from "@/lib/db/schema";
import type { Ctx, Tx } from "@/lib/labores-stock";

/**
 * Una labor puede nacer de una orden de reparación aprobada. Al terminar la labor, la orden queda dada de alta
 * (completada) y pasa al historial; si la labor se reabre, la orden vuelve a estar en trámite. El respaldo del trabajo
 * es la propia labor: quién la hizo, cuándo y qué materiales usó.
 */
export async function cerrarOrdenDeLabor(tx: Tx, ctx: Ctx, laborId: string) {
  const [l] = await tx.select({ ordenId: labores.ordenId }).from(labores).where(eq(labores.id, laborId)).limit(1);
  if (!l?.ordenId) return;
  await tx
    .update(ordenes)
    .set({ estado: "COMPLETADA", ejecutadaAt: sql`coalesce(${ordenes.ejecutadaAt}, now())`, confirmadaPorId: ctx.userId, confirmadaAt: new Date(), updatedAt: new Date() })
    .where(and(eq(ordenes.id, l.ordenId), eq(ordenes.aprId, ctx.aprId), inArray(ordenes.estado, ["EN_TRAMITE", "POR_CONFIRMAR"])));
}

/** La labor dejó de estar hecha: su orden vuelve a trámite. */
export async function reabrirOrdenDeLabor(tx: Tx, ctx: Ctx, laborId: string) {
  const [l] = await tx.select({ ordenId: labores.ordenId }).from(labores).where(eq(labores.id, laborId)).limit(1);
  if (!l?.ordenId) return;
  await tx
    .update(ordenes)
    .set({ estado: "EN_TRAMITE", confirmadaPorId: null, confirmadaAt: null, updatedAt: new Date() })
    .where(and(eq(ordenes.id, l.ordenId), eq(ordenes.aprId, ctx.aprId), eq(ordenes.estado, "COMPLETADA")));
}
