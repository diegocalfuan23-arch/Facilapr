import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { activosFijos } from "@/lib/db/schema";
import type { ActivoFila, EstadoActivo } from "@/lib/activos-comun";

export * from "@/lib/activos-comun";

function aFila(f: typeof activosFijos.$inferSelect): ActivoFila {
  return {
    id: f.id,
    nombre: f.nombre,
    codigo: f.codigo,
    categoria: f.categoria,
    ubicacion: f.ubicacion,
    fechaAdquisicion: f.fechaAdquisicion,
    costo: f.costo,
    vidaUtilAnios: f.vidaUtilAnios,
    estado: f.estado as EstadoActivo,
    responsable: f.responsable,
    notas: f.notas,
    costoEnCaja: f.movimientoId !== null,
    proximaMantencion: f.proximaMantencion,
    reparacionDesde: f.reparacionDesde,
    reparacionMotivo: f.reparacionMotivo,
  };
}

/** Los activos fijos del comité, los dados de baja al final. Si la tabla no existe, devuelve vacío. */
export async function listarActivos(aprId: string): Promise<ActivoFila[]> {
  try {
    const filas = await db
      .select()
      .from(activosFijos)
      .where(eq(activosFijos.aprId, aprId))
      .orderBy(asc(activosFijos.estado), desc(activosFijos.fechaAdquisicion))
      .limit(1000);
    return filas.map(aFila);
  } catch (e) {
    console.error("Activos: no se pudieron leer:", e);
    return [];
  }
}

/** Un activo del comité por su id (el filtro por comité impide leer el de otro). Null si no existe. */
export async function activoPorId(aprId: string, id: string): Promise<ActivoFila | null> {
  try {
    const [fila] = await db
      .select()
      .from(activosFijos)
      .where(and(eq(activosFijos.id, id), eq(activosFijos.aprId, aprId)))
      .limit(1);
    return fila ? aFila(fila) : null;
  } catch (e) {
    console.error("Activos: no se pudo leer el bien:", e);
    return null;
  }
}
