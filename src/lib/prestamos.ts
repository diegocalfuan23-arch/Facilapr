import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { prestamoDescuentos, prestamos, trabajadores } from "@/lib/db/schema";
import type { EstadoPrestamo, PrestamoFila, TipoPrestamo } from "@/lib/prestamos-comun";

export * from "@/lib/prestamos-comun";

/** Los anticipos y préstamos del comité, con lo ya descontado. Si las tablas no existen, devuelve vacío. */
export async function listarPrestamos(aprId: string): Promise<PrestamoFila[]> {
  try {
    const filas = await db
      .select({
        id: prestamos.id,
        trabajadorId: prestamos.trabajadorId,
        trabajador: trabajadores.nombre,
        tipo: prestamos.tipo,
        monto: prestamos.monto,
        cuotas: prestamos.cuotas,
        cuotaMonto: prestamos.cuotaMonto,
        primerPeriodo: prestamos.primerPeriodo,
        fecha: prestamos.fecha,
        estado: prestamos.estado,
        nota: prestamos.nota,
        movimientoId: prestamos.movimientoId,
      })
      .from(prestamos)
      .innerJoin(trabajadores, eq(trabajadores.id, prestamos.trabajadorId))
      .where(eq(prestamos.aprId, aprId))
      .orderBy(desc(prestamos.fecha), desc(prestamos.createdAt))
      .limit(500);
    if (filas.length === 0) return [];

    const hechos = await db
      .select({ prestamoId: prestamoDescuentos.prestamoId, periodo: prestamoDescuentos.periodo, monto: prestamoDescuentos.monto })
      .from(prestamoDescuentos)
      .where(
        inArray(
          prestamoDescuentos.prestamoId,
          filas.map((f) => f.id)
        )
      )
      .orderBy(asc(prestamoDescuentos.periodo));
    const porPrestamo = new Map<string, { periodo: string; monto: number }[]>();
    for (const h of hechos) porPrestamo.set(h.prestamoId, [...(porPrestamo.get(h.prestamoId) ?? []), { periodo: h.periodo, monto: h.monto }]);

    return filas.map((f) => {
      const descuentos = porPrestamo.get(f.id) ?? [];
      const descontado = descuentos.reduce((s, d) => s + d.monto, 0);
      return {
        id: f.id,
        trabajadorId: f.trabajadorId,
        trabajador: f.trabajador,
        tipo: f.tipo as TipoPrestamo,
        monto: f.monto,
        cuotas: f.cuotas,
        cuotaMonto: f.cuotaMonto,
        primerPeriodo: f.primerPeriodo,
        fecha: f.fecha,
        estado: f.estado as EstadoPrestamo,
        nota: f.nota,
        descontado,
        cuotasDescontadas: descuentos.length,
        descuentos,
        saldo: Math.max(0, f.monto - descontado),
        costoEnCaja: f.movimientoId !== null,
      };
    });
  } catch (e) {
    console.error("Préstamos: no se pudieron leer:", e);
    return [];
  }
}
