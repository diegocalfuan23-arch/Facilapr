import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { movimientosStock } from "@/lib/db/schema";
import { user as usuarios } from "@/lib/db/auth-schema";
import type { MovimientoStockFila, OrigenStock } from "@/lib/inventario-comun";

/** Lo que hace falta para dejar anotado un cambio de stock. */
export type CambioStock = {
  aprId: string;
  insumoId: string | null;
  insumoNombre: string;
  unidad: string;
  /** Positivo si el stock subió, negativo si bajó. */
  cantidad: number;
  stockResultante: number;
  origen: OrigenStock;
  motivo?: string | null;
  registradoPorId?: string | null;
};

/**
 * Deja anotado un cambio de stock en el historial. Va dentro de su propio punto de control
 * (savepoint): si la tabla del historial todavía no existe o algo falla, solo se pierde esta
 * línea y el cambio de stock que se estaba haciendo sigue adelante.
 */
export async function anotarCambioStock(ejecutor: Pick<typeof db, "transaction">, cambio: CambioStock) {
  if (cambio.cantidad === 0) return;
  try {
    await ejecutor.transaction(async (t) => {
      await t.insert(movimientosStock).values({
        aprId: cambio.aprId,
        insumoId: cambio.insumoId,
        insumoNombre: cambio.insumoNombre,
        unidad: cambio.unidad,
        cantidad: cambio.cantidad,
        stockResultante: cambio.stockResultante,
        origen: cambio.origen,
        motivo: cambio.motivo?.trim() || null,
        registradoPorId: cambio.registradoPorId ?? null,
      });
    });
  } catch (e) {
    console.error("Inventario: no se pudo anotar el cambio de stock en el historial:", e);
  }
}

/** Los últimos cambios de stock del comité, del más reciente al más antiguo. Si la tabla no existe, devuelve vacío. */
export async function listarHistorial(aprId: string): Promise<MovimientoStockFila[]> {
  const filas = await db
    .select({
      id: movimientosStock.id,
      insumo: movimientosStock.insumoNombre,
      unidad: movimientosStock.unidad,
      cantidad: movimientosStock.cantidad,
      stockResultante: movimientosStock.stockResultante,
      origen: movimientosStock.origen,
      motivo: movimientosStock.motivo,
      quien: usuarios.name,
      fecha: movimientosStock.createdAt,
    })
    .from(movimientosStock)
    .leftJoin(usuarios, eq(usuarios.id, movimientosStock.registradoPorId))
    .where(eq(movimientosStock.aprId, aprId))
    .orderBy(desc(movimientosStock.createdAt))
    .limit(300)
    .catch((e) => {
      console.error("Inventario: no se pudo leer el historial:", e);
      return [];
    });

  return filas.map((f) => ({ ...f, origen: f.origen as OrigenStock, fecha: f.fecha.toISOString() }));
}
