import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { incidentes } from "@/lib/db/schema";
import type { EstadoIncidente, IncidenteFila, PrioridadIncidente } from "@/lib/incidentes-comun";

export * from "@/lib/incidentes-comun";

/** Los incidentes del comité, del más nuevo al más antiguo. Si la tabla no existe, devuelve vacío. */
export async function listarIncidentes(aprId: string): Promise<IncidenteFila[]> {
  try {
    const filas = await db
      .select()
      .from(incidentes)
      .where(eq(incidentes.aprId, aprId))
      .orderBy(desc(incidentes.fecha), desc(incidentes.numero))
      .limit(500);
    return filas.map((f) => ({
      id: f.id,
      numero: f.numero,
      titulo: f.titulo,
      descripcion: f.descripcion,
      tipo: f.tipo,
      lugar: f.lugar,
      prioridad: f.prioridad as PrioridadIncidente,
      estado: f.estado as EstadoIncidente,
      fecha: f.fecha,
      fechaResolucion: f.fechaResolucion,
      responsable: f.responsable,
      solucion: f.solucion,
      costo: f.costo,
      costoEnCaja: f.movimientoId !== null,
    }));
  } catch (e) {
    console.error("Incidentes: no se pudieron leer:", e);
    return [];
  }
}
