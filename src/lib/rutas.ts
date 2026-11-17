import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rutaParadas, rutas } from "@/lib/db/schema";

/** Una ruta de terreno lista para la pantalla: sus socios ya vienen en el orden del recorrido. */
export type RutaVista = {
  id: string;
  nombre: string;
  aprobada: boolean;
  /** La creó quien mira la pantalla. */
  propia: boolean;
  socioIds: string[];
};

/**
 * Las rutas que ve cada usuario: el administrador, todas; los demás, las aprobadas y las propias aún por aprobar.
 * Si la tabla todavía no existe devuelve vacío: la pantalla sigue con la ruta de siempre.
 */
export async function rutasDelComite(aprId: string, userId: string, rol: string): Promise<RutaVista[]> {
  try {
    const filas = await db.select().from(rutas).where(eq(rutas.aprId, aprId)).orderBy(asc(rutas.nombre));
    const visibles = filas.filter((r) => rol === "ADMIN" || r.aprobada || r.creadaPorId === userId);
    if (visibles.length === 0) return [];
    const paradas = await db
      .select({ rutaId: rutaParadas.rutaId, socioId: rutaParadas.socioId, orden: rutaParadas.orden })
      .from(rutaParadas)
      .innerJoin(rutas, eq(rutas.id, rutaParadas.rutaId))
      .where(eq(rutas.aprId, aprId))
      .orderBy(asc(rutaParadas.orden));
    const porRuta = new Map<string, string[]>();
    for (const p of paradas) porRuta.set(p.rutaId, [...(porRuta.get(p.rutaId) ?? []), p.socioId]);
    return visibles.map((r) => ({ id: r.id, nombre: r.nombre, aprobada: r.aprobada, propia: r.creadaPorId === userId, socioIds: porRuta.get(r.id) ?? [] }));
  } catch (e) {
    console.error("Rutas: no se pudieron leer:", e);
    return [];
  }
}
