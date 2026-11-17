import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { laborInsumos, labores, rutas } from "@/lib/db/schema";
import { claveAhora, claveFin, type EstadoLabor, type LaborFila } from "@/lib/labores-comun";

export * from "@/lib/labores-comun";

/** Las labores del comité, de la más nueva a la más antigua. Si las tablas no existen, devuelve vacío. */
export async function listarLabores(aprId: string): Promise<LaborFila[]> {
  try {
    const filas = await db.select().from(labores).where(eq(labores.aprId, aprId)).orderBy(desc(labores.fecha), desc(labores.numero)).limit(500);
    const lineas = await db.select().from(laborInsumos).where(eq(laborInsumos.aprId, aprId)).orderBy(asc(laborInsumos.insumoNombre));
    const nombresRuta = new Map((await db.select({ id: rutas.id, nombre: rutas.nombre }).from(rutas).where(eq(rutas.aprId, aprId))).map((r) => [r.id, r.nombre]));
    return filas.map((f) => ({
      id: f.id,
      numero: f.numero,
      titulo: f.titulo,
      descripcion: f.descripcion,
      tipo: f.tipo,
      lugar: f.lugar,
      estado: f.estado as EstadoLabor,
      fecha: f.fecha,
      hora: f.hora,
      fechaTermino: f.fechaTermino,
      horaFin: f.horaFin,
      responsable: f.responsable,
      rutaId: f.rutaId && nombresRuta.has(f.rutaId) ? f.rutaId : null,
      rutaNombre: f.rutaId ? (nombresRuta.get(f.rutaId) ?? null) : null,
      descontada: f.descontada,
      vencida: f.estado !== "HECHA" && (claveFin(f) ?? "9999") <= claveAhora(),
      materiales: lineas
        .filter((l) => l.laborId === f.id)
        .map((l) => ({ insumoId: l.insumoId, nombre: l.insumoNombre, unidad: l.unidad, cantidad: l.cantidad, costoUnitario: l.costoUnitario })),
    }));
  } catch (e) {
    console.error("Labores: no se pudieron leer:", e);
    return [];
  }
}
