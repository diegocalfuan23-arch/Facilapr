import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { activosFijos, incidentes } from "@/lib/db/schema";
import { valorActual } from "@/lib/activos-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import type { ActivoAfectable, EstadoIncidente, IncidenteFila, PrioridadIncidente } from "@/lib/incidentes-comun";

export * from "@/lib/incidentes-comun";

/** Los bienes de Activos que todavía están en el comité (no dados de baja), con lo que valen hoy. */
export async function activosAfectables(aprId: string): Promise<ActivoAfectable[]> {
  try {
    const filas = await db
      .select({ id: activosFijos.id, nombre: activosFijos.nombre, costo: activosFijos.costo, vidaUtilAnios: activosFijos.vidaUtilAnios, fechaAdquisicion: activosFijos.fechaAdquisicion })
      .from(activosFijos)
      .where(and(eq(activosFijos.aprId, aprId), ne(activosFijos.estado, "BAJA")))
      .orderBy(asc(activosFijos.nombre));
    const hoy = hoyEnChile();
    return filas.map((a) => ({ id: a.id, nombre: a.nombre, valorLibro: valorActual(a, hoy).valorLibro }));
  } catch (e) {
    console.error("Incidentes: no se pudieron leer los activos:", e);
    return [];
  }
}

/** Los incidentes del comité, del más nuevo al más antiguo. Si la tabla no existe, devuelve vacío. */
export async function listarIncidentes(aprId: string): Promise<IncidenteFila[]> {
  try {
    const filas = await db
      .select({ i: incidentes, activoNombre: activosFijos.nombre })
      .from(incidentes)
      .leftJoin(activosFijos, eq(activosFijos.id, incidentes.activoId))
      .where(eq(incidentes.aprId, aprId))
      .orderBy(desc(incidentes.fecha), desc(incidentes.numero))
      .limit(500);
    return filas.map(({ i: f, activoNombre }) => ({
      activoId: f.activoId,
      activoNombre,
      valorPerdido: f.valorPerdido,
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
