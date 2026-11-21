import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { laborInsumos, labores, ordenes, paradaLabores, rutaParadas, rutas, socios } from "@/lib/db/schema";
import { claveAhora, claveFin, type EstadoLabor, type LaborFila, type RutaDeLabor, type SocioDeLabor } from "@/lib/labores-comun";

export * from "@/lib/labores-comun";

/** Las labores del comité, de la más nueva a la más antigua. Si las tablas no existen, devuelve vacío. */
export async function listarLabores(aprId: string): Promise<LaborFila[]> {
  try {
    const filas = await db.select().from(labores).where(eq(labores.aprId, aprId)).orderBy(desc(labores.fecha), desc(labores.numero)).limit(500);
    const lineas = await db.select().from(laborInsumos).where(eq(laborInsumos.aprId, aprId)).orderBy(asc(laborInsumos.insumoNombre));
    const rutasPorLabor = await rutasDeLabores(aprId);
    const sociosPorLabor = await sociosDeLabores(aprId);
    const idsOrden = filas.flatMap((f) => (f.ordenId ? [f.ordenId] : []));
    const sociosDeOrden = new Map(
      idsOrden.length ? (await db.select({ id: ordenes.id, socio: socios.nombre }).from(ordenes).innerJoin(socios, eq(socios.id, ordenes.socioId)).where(inArray(ordenes.id, idsOrden))).map((o) => [o.id, o.socio] as const) : []
    );
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
      rutas: rutasPorLabor.get(f.id) ?? [],
      socios: sociosPorLabor.get(f.id) ?? [],
      ordenSocio: f.ordenId ? (sociosDeOrden.get(f.ordenId) ?? null) : null,
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

/** Los socios donde se hace cada labor (por ruta, en el orden del recorrido) y si ya se hizo en cada uno. */
async function sociosDeLabores(aprId: string): Promise<Map<string, SocioDeLabor[]>> {
  const porLabor = new Map<string, SocioDeLabor[]>();
  try {
    const filas = await db
      .select({
        laborId: paradaLabores.laborId,
        paradaId: paradaLabores.paradaId,
        rutaId: rutaParadas.rutaId,
        socioId: socios.id,
        nombre: socios.nombre,
        numeroCliente: socios.numeroCliente,
        hecha: paradaLabores.hecha,
      })
      .from(paradaLabores)
      .innerJoin(rutaParadas, eq(rutaParadas.id, paradaLabores.paradaId))
      .innerJoin(socios, eq(socios.id, rutaParadas.socioId))
      .where(eq(paradaLabores.aprId, aprId))
      .orderBy(asc(rutaParadas.rutaId), asc(rutaParadas.orden));
    for (const f of filas) porLabor.set(f.laborId, [...(porLabor.get(f.laborId) ?? []), { paradaId: f.paradaId, rutaId: f.rutaId, socioId: f.socioId, nombre: f.nombre, numeroCliente: f.numeroCliente, hecha: f.hecha }]);
  } catch (e) {
    console.error("Labores: no se pudieron leer sus socios:", e);
  }
  return porLabor;
}

/** En qué rutas está cada labor. Si las tablas de rutas todavía no existen, nada tiene ruta y las labores se ven igual. */
async function rutasDeLabores(aprId: string): Promise<Map<string, RutaDeLabor[]>> {
  const porLabor = new Map<string, RutaDeLabor[]>();
  try {
    const filas = await db
      .select({
        laborId: paradaLabores.laborId,
        rutaId: rutas.id,
        nombre: rutas.nombre,
        paradas: sql<number>`count(*)::int`,
        hechas: sql<number>`coalesce(sum(case when ${paradaLabores.hecha} then 1 else 0 end), 0)::int`,
      })
      .from(paradaLabores)
      .innerJoin(rutaParadas, eq(rutaParadas.id, paradaLabores.paradaId))
      .innerJoin(rutas, eq(rutas.id, rutaParadas.rutaId))
      .where(eq(paradaLabores.aprId, aprId))
      .groupBy(paradaLabores.laborId, rutas.id, rutas.nombre)
      .orderBy(asc(rutas.nombre));
    for (const f of filas) porLabor.set(f.laborId, [...(porLabor.get(f.laborId) ?? []), { id: f.rutaId, nombre: f.nombre, paradas: f.paradas, hechas: f.hechas }]);
  } catch (e) {
    console.error("Labores: no se pudieron leer sus rutas:", e);
  }
  return porLabor;
}
