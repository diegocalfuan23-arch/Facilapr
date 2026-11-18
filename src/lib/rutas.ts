import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/auth-schema";
import { arranqueSocios, arranques, labores, paradaLabores, rutaParadas, rutas } from "@/lib/db/schema";
import type { ArranqueRuta, LaborEnRuta, RutaVista } from "@/lib/rutas-comun";

export type { ArranqueRuta, LaborEnRuta, RutaVista } from "@/lib/rutas-comun";

/**
 * Las rutas que ve cada usuario: el administrador, todas; los demás, las aprobadas y las propias aún por aprobar.
 * Si la tabla todavía no existe devuelve vacío: la pantalla sigue con la ruta de siempre.
 */
export async function rutasDelComite(aprId: string, userId: string, rol: string, incluirArchivadas = false): Promise<RutaVista[]> {
  try {
    const filas = await db.select().from(rutas).where(eq(rutas.aprId, aprId)).orderBy(asc(rutas.nombre));
    const visibles = filas.filter((r) => (incluirArchivadas || !r.archivada) && (rol === "ADMIN" || r.aprobada || r.creadaPorId === userId));
    if (visibles.length === 0) return [];
    const paradas = await db
      .select({ rutaId: rutaParadas.rutaId, socioId: rutaParadas.socioId, orden: rutaParadas.orden })
      .from(rutaParadas)
      .innerJoin(rutas, eq(rutas.id, rutaParadas.rutaId))
      .where(eq(rutas.aprId, aprId))
      .orderBy(asc(rutaParadas.orden));
    const porRuta = new Map<string, string[]>();
    for (const p of paradas) porRuta.set(p.rutaId, [...(porRuta.get(p.rutaId) ?? []), p.socioId]);
    const operadores = new Map((await operadoresDelComite(aprId)).map((o) => [o.id, o.nombre]));
    return visibles.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      aprobada: r.aprobada,
      propia: r.creadaPorId === userId,
      socioIds: porRuta.get(r.id) ?? [],
      operadorId: r.operadorId,
      operadorNombre: r.operadorId ? (operadores.get(r.operadorId) ?? null) : null,
      archivada: r.archivada,
      creada: r.createdAt.toISOString().slice(0, 10),
    }));
  } catch (e) {
    console.error("Rutas: no se pudieron leer:", e);
    return [];
  }
}

/** Los operadores del comité, para elegir quién suele recorrer una ruta. */
export async function operadoresDelComite(aprId: string): Promise<{ id: string; nombre: string }[]> {
  try {
    const filas = await db.select({ id: userTable.id, nombre: userTable.name }).from(userTable).where(and(eq(userTable.aprId, aprId), eq(userTable.rol, "OPERADOR"))).orderBy(asc(userTable.name));
    return filas.map((f) => ({ id: f.id, nombre: f.nombre ?? "Operador" }));
  } catch (e) {
    console.error("Rutas: no se pudieron leer los operadores:", e);
    return [];
  }
}

export async function arranquesParaRutas(aprId: string): Promise<ArranqueRuta[]> {
  try {
    const filas = await db.select({ id: arranques.id, nombre: arranques.nombre, lat: arranques.lat, lng: arranques.lng }).from(arranques).where(eq(arranques.aprId, aprId)).orderBy(asc(arranques.nombre));
    if (filas.length === 0) return [];
    const vinculos = await db
      .select({ arranqueId: arranqueSocios.arranqueId, socioId: arranqueSocios.socioId })
      .from(arranqueSocios)
      .innerJoin(arranques, eq(arranques.id, arranqueSocios.arranqueId))
      .where(eq(arranques.aprId, aprId));
    const porArranque = new Map<string, string[]>();
    for (const v of vinculos) porArranque.set(v.arranqueId, [...(porArranque.get(v.arranqueId) ?? []), v.socioId]);
    return filas.map((a) => ({ ...a, socioIds: porArranque.get(a.id) ?? [] })).filter((a) => a.socioIds.length > 0);
  } catch (e) {
    console.error("Rutas: no se pudieron leer los arranques:", e);
    return [];
  }
}

/** Las labores que se hacen en cada ruta (por id de ruta), con cuántas paradas tiene cada una y cuántas se hicieron. */
export async function laboresPorRuta(aprId: string): Promise<Record<string, LaborEnRuta[]>> {
  const porRuta: Record<string, LaborEnRuta[]> = {};
  try {
    const filas = await db
      .select({
        rutaId: rutaParadas.rutaId,
        id: labores.id,
        numero: labores.numero,
        titulo: labores.titulo,
        tipo: labores.tipo,
        fecha: labores.fecha,
        estado: labores.estado,
        paradas: sql<number>`count(*)::int`,
        hechas: sql<number>`coalesce(sum(case when ${paradaLabores.hecha} then 1 else 0 end), 0)::int`,
      })
      .from(paradaLabores)
      .innerJoin(rutaParadas, eq(rutaParadas.id, paradaLabores.paradaId))
      .innerJoin(labores, eq(labores.id, paradaLabores.laborId))
      .where(eq(paradaLabores.aprId, aprId))
      .groupBy(rutaParadas.rutaId, labores.id, labores.numero, labores.titulo, labores.tipo, labores.fecha, labores.estado)
      .orderBy(asc(labores.numero));
    for (const f of filas) (porRuta[f.rutaId] ??= []).push({ id: f.id, numero: f.numero, titulo: f.titulo, tipo: f.tipo, fecha: f.fecha, estado: f.estado as LaborEnRuta["estado"], paradas: f.paradas, hechas: f.hechas });
  } catch (e) {
    console.error("Rutas: no se pudieron leer sus labores:", e);
  }
  return porRuta;
}
