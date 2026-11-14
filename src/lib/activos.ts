import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { activoDocumentos, activosFijos } from "@/lib/db/schema";
import type { ActivoFila, DocumentoActivo, EstadoActivo } from "@/lib/activos-comun";

export * from "@/lib/activos-comun";

function aFila(f: typeof activosFijos.$inferSelect, documentos: DocumentoActivo[] = []): ActivoFila {
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
    documentos,
  };
}

/** Los adjuntos de los bienes del comité, por bien. Nunca lee el contenido de los archivos. Si la tabla no existe, devuelve vacío. */
async function documentosDe(aprId: string): Promise<Map<string, DocumentoActivo[]>> {
  const porBien = new Map<string, DocumentoActivo[]>();
  try {
    const filas = await db
      .select({ id: activoDocumentos.id, activoId: activoDocumentos.activoId, nombre: activoDocumentos.nombre, tipo: activoDocumentos.tipo, tamano: activoDocumentos.tamano })
      .from(activoDocumentos)
      .where(eq(activoDocumentos.aprId, aprId))
      .orderBy(asc(activoDocumentos.createdAt));
    for (const f of filas) porBien.set(f.activoId, [...(porBien.get(f.activoId) ?? []), { id: f.id, nombre: f.nombre, tipo: f.tipo, tamano: f.tamano }]);
  } catch (e) {
    console.error("Activos: no se pudieron leer los documentos:", e);
  }
  return porBien;
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
    const documentos = await documentosDe(aprId);
    return filas.map((f) => aFila(f, documentos.get(f.id) ?? []));
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
    if (!fila) return null;
    return aFila(fila, (await documentosDe(aprId)).get(fila.id) ?? []);
  } catch (e) {
    console.error("Activos: no se pudo leer el bien:", e);
    return null;
  }
}
