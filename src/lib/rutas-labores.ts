import { and, eq, inArray } from "drizzle-orm";
import { rutaParadas, paradaLabores, rutas } from "@/lib/db/schema";
import type { Tx } from "@/lib/labores-stock";

export class ErrorRutaLabor extends Error {}

/** Pone la labor en las paradas indicadas de las rutas (todas las paradas si no se dice cuáles). Lo que ya estaba no se repite. */
export async function agregarLaborARutas(tx: Tx, aprId: string, laborId: string, rutaIds: string[], socioIds?: string[]) {
  if (rutaIds.length === 0) return;
  const paradas = await tx
    .select({ id: rutaParadas.id })
    .from(rutaParadas)
    .where(and(inArray(rutaParadas.rutaId, rutaIds), socioIds ? inArray(rutaParadas.socioId, socioIds) : undefined));
  if (paradas.length === 0) return;
  await tx
    .insert(paradaLabores)
    .values(paradas.map((p) => ({ aprId, paradaId: p.id, laborId })))
    .onConflictDoNothing();
}

/** Saca la labor de todas las paradas de una ruta. */
export async function quitarLaborDeRutas(tx: Tx, laborId: string, rutaIds: string[]) {
  if (rutaIds.length === 0) return;
  await tx.delete(paradaLabores).where(and(eq(paradaLabores.laborId, laborId), inArray(paradaLabores.paradaId, tx.select({ id: rutaParadas.id }).from(rutaParadas).where(inArray(rutaParadas.rutaId, rutaIds)))));
}

/**
 * Deja la labor en exactamente estas rutas: la suma a las que faltan (con todas sus paradas) y la saca de las que se
 * desmarcaron. Solo sirven rutas aprobadas de este comité.
 */
export async function sincronizarRutasDeLabor(tx: Tx, aprId: string, laborId: string, rutaIds: string[]) {
  const ids = [...new Set(rutaIds)];
  if (ids.length > 0) {
    const validas = await tx.select({ id: rutas.id }).from(rutas).where(and(eq(rutas.aprId, aprId), eq(rutas.aprobada, true), inArray(rutas.id, ids)));
    if (validas.length !== ids.length) throw new ErrorRutaLabor("Alguna de las rutas ya no existe o no está aprobada.");
  }
  const actuales = await tx
    .selectDistinct({ rutaId: rutaParadas.rutaId })
    .from(paradaLabores)
    .innerJoin(rutaParadas, eq(rutaParadas.id, paradaLabores.paradaId))
    .where(eq(paradaLabores.laborId, laborId));
  await quitarLaborDeRutas(
    tx,
    laborId,
    actuales.map((a) => a.rutaId).filter((r) => !ids.includes(r))
  );
  await agregarLaborARutas(tx, aprId, laborId, ids);
}
