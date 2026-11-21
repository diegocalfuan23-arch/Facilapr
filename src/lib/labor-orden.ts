import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { insumos, laborInsumos, labores, ordenes, socios } from "@/lib/db/schema";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { puede, type Plan } from "@/lib/planes";
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

/**
 * Cuando una reparación pasa a terreno (la pide la directiva o la aprueba desde Solicitudes), se crea sola la labor que
 * la acompaña: con el título, el lugar y el detalle de la orden, para que solo falten la fecha, el responsable y los
 * materiales. Solo en los planes que incluyen Labores. Si no se puede crear, la orden sigue su curso y queda el botón
 * «Crear labor». Nunca lanza.
 */
export type DatosLaborReparacion = { responsable: string | null; fecha: string; materiales: { insumoId: string; cantidad: number }[] };

/** Lo que manda la pantalla (responsable, fecha, materiales), limpio y con límites. Sin datos o datos malos, devuelve undefined. */
export function limpiarDatosLabor(crudo: unknown): DatosLaborReparacion | undefined {
  if (!crudo || typeof crudo !== "object") return undefined;
  const c = crudo as { responsable?: unknown; fecha?: unknown; materiales?: unknown };
  const responsable = typeof c.responsable === "string" && c.responsable.trim() ? c.responsable.trim().slice(0, 120) : null;
  const fecha = typeof c.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha) ? c.fecha : hoyEnChile();
  const porMaterial = new Map<string, number>();
  if (Array.isArray(c.materiales)) {
    for (const m of c.materiales.slice(0, 40)) {
      const { insumoId, cantidad } = (m ?? {}) as { insumoId?: unknown; cantidad?: unknown };
      if (typeof insumoId === "string" && typeof cantidad === "number" && cantidad > 0 && cantidad <= 1_000_000) porMaterial.set(insumoId, (porMaterial.get(insumoId) ?? 0) + cantidad);
    }
  }
  return { responsable, fecha, materiales: [...porMaterial].map(([insumoId, cantidad]) => ({ insumoId, cantidad })) };
}

export async function crearLaborDeReparacion(aprId: string, plan: Plan, ordenId: string, datos?: DatosLaborReparacion) {
  try {
    if (!puede(plan, "inventario")) return;
    const [o] = await db
      .select({ detalle: ordenes.detalle, socio: socios.nombre, direccion: socios.direccion })
      .from(ordenes)
      .innerJoin(socios, eq(socios.id, ordenes.socioId))
      .where(and(eq(ordenes.id, ordenId), eq(ordenes.aprId, aprId), eq(ordenes.tipo, "REPARACION"), eq(ordenes.estado, "EN_TRAMITE")))
      .limit(1);
    if (!o) return;
    await db.transaction(async (tx) => {
      const [yaTiene] = await tx.select({ id: labores.id }).from(labores).where(eq(labores.ordenId, ordenId)).limit(1);
      if (yaTiene) return;
      const [{ m }] = await tx.select({ m: sql<number>`coalesce(max(${labores.numero}), 0)::int` }).from(labores).where(eq(labores.aprId, aprId));
      const [creada] = await tx
        .insert(labores)
        .values({
          aprId,
          numero: m + 1,
          titulo: `Reparación · ${o.socio}`.slice(0, 140),
          descripcion: o.detalle,
          tipo: "REPARACION",
          lugar: o.direccion,
          estado: "PROGRAMADA",
          fecha: datos?.fecha ?? hoyEnChile(),
          responsable: datos?.responsable ?? null,
          ordenId,
        })
        .returning({ id: labores.id });
      // Los materiales tienen que ser de este comité: los que ya no están se ignoran.
      const ids = (datos?.materiales ?? []).map((x) => x.insumoId);
      if (ids.length) {
        const delInventario = await tx.select({ id: insumos.id, nombre: insumos.nombre, unidad: insumos.unidad, costo: insumos.costo }).from(insumos).where(and(eq(insumos.aprId, aprId), inArray(insumos.id, ids)));
        const cantidades = new Map((datos?.materiales ?? []).map((x) => [x.insumoId, x.cantidad]));
        if (delInventario.length) {
          await tx.insert(laborInsumos).values(
            delInventario.map((i) => ({ laborId: creada.id, aprId, insumoId: i.id, insumoNombre: i.nombre, unidad: i.unidad, cantidad: cantidades.get(i.id) ?? 0, costoUnitario: i.costo }))
          );
        }
      }
    });
  } catch (e) {
    console.error("Órdenes: no se pudo crear la labor de la reparación:", e instanceof Error ? e.message : "error");
  }
}
