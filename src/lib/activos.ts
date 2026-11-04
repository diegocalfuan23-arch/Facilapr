import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { activosFijos } from "@/lib/db/schema";
import type { ActivoFila, EstadoActivo } from "@/lib/activos-comun";

export * from "@/lib/activos-comun";

/** Los activos fijos del comité, los dados de baja al final. Si la tabla no existe, devuelve vacío. */
export async function listarActivos(aprId: string): Promise<ActivoFila[]> {
  try {
    const filas = await db
      .select()
      .from(activosFijos)
      .where(eq(activosFijos.aprId, aprId))
      .orderBy(asc(activosFijos.estado), desc(activosFijos.fechaAdquisicion))
      .limit(1000);
    return filas.map((f) => ({
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
    }));
  } catch (e) {
    console.error("Activos: no se pudieron leer:", e);
    return [];
  }
}
