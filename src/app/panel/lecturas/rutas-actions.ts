"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/auth-schema";
import { labores, paradaLabores, rutaParadas, rutas, socios } from "@/lib/db/schema";
import { agregarLaborARutas, quitarLaborDeRutas } from "@/lib/rutas-labores";
import { puede, type Plan } from "@/lib/planes";
import { requireApr } from "@/lib/apr-session";

export type ResultadoRuta = { ok: true } | { ok: false; error: string };

function refrescar() {
  revalidatePath("/panel/rutas");
  revalidatePath("/panel/lecturas");
  revalidatePath("/panel/lecturas/terreno");
  revalidatePath("/panel/labores");
}

/**
 * Crea una ruta o cambia una existente (nombre y socios en orden). Si la crea el administrador queda aprobada;
 * si la crea un operador queda por aprobar. Un operador solo toca sus propias rutas y mientras no estén aprobadas.
 */
export async function guardarRuta(id: string | null, nombre: string, socioIds: string[], operadorId?: string | null): Promise<ResultadoRuta> {
  const { user, apr } = await requireApr();
  const limpio = nombre.trim().slice(0, 60);
  if (!limpio) return { ok: false, error: "Ponle un nombre a la ruta." };
  const ids = [...new Set(socioIds)];
  if (ids.length === 0) return { ok: false, error: "Elige al menos un socio." };
  if (ids.length > 2000) return { ok: false, error: "La ruta es demasiado larga." };

  // Todos los socios deben ser de este comité.
  const validos = await db.select({ id: socios.id }).from(socios).where(and(eq(socios.aprId, apr.id), inArray(socios.id, ids)));
  if (validos.length !== ids.length) return { ok: false, error: "Alguno de los socios ya no existe. Recarga la pantalla." };

  const esAdmin = user.rol === "ADMIN";
  // El operador habitual lo elige solo el administrador; `undefined` deja el que ya tenía.
  let operador: string | null | undefined = undefined;
  if (esAdmin && operadorId !== undefined) {
    if (operadorId) {
      const [o] = await db.select({ id: userTable.id }).from(userTable).where(and(eq(userTable.id, operadorId), eq(userTable.aprId, apr.id), eq(userTable.rol, "OPERADOR"))).limit(1);
      if (!o) return { ok: false, error: "Ese operador ya no existe. Recarga la pantalla." };
      operador = o.id;
    } else operador = null;
  }
  try {
    await db.transaction(async (tx) => {
      let rutaId = id;
      if (rutaId) {
        const [r] = await tx.select().from(rutas).where(and(eq(rutas.id, rutaId), eq(rutas.aprId, apr.id))).limit(1);
        if (!r) throw new Error("NO_EXISTE");
        if (!esAdmin && (r.creadaPorId !== user.id || r.aprobada)) throw new Error("SIN_PERMISO");
        await tx.update(rutas).set({ nombre: limpio, ...(operador !== undefined ? { operadorId: operador } : {}), updatedAt: new Date() }).where(eq(rutas.id, rutaId));
        // Las paradas que siguen se conservan (con las labores que tienen asignadas): solo se mueve su orden.
        const actuales = await tx.select({ id: rutaParadas.id, socioId: rutaParadas.socioId, orden: rutaParadas.orden }).from(rutaParadas).where(eq(rutaParadas.rutaId, rutaId));
        const porSocio = new Map(actuales.map((a) => [a.socioId, a]));
        const sobran = actuales.filter((a) => !ids.includes(a.socioId)).map((a) => a.id);
        if (sobran.length) await tx.delete(rutaParadas).where(inArray(rutaParadas.id, sobran));
        for (const [i, socioId] of ids.entries()) {
          const a = porSocio.get(socioId);
          if (a && a.orden !== i) await tx.update(rutaParadas).set({ orden: i }).where(eq(rutaParadas.id, a.id));
        }
        const nuevas = ids.flatMap((socioId, i) => (porSocio.has(socioId) ? [] : [{ rutaId: rutaId as string, socioId, orden: i }]));
        if (nuevas.length) await tx.insert(rutaParadas).values(nuevas);
        return;
      } else {
        const [nueva] = await tx
          .insert(rutas)
          .values({ aprId: apr.id, nombre: limpio, aprobada: esAdmin, aprobadaPorId: esAdmin ? user.id : null, creadaPorId: user.id, operadorId: operador ?? null })
          .returning({ id: rutas.id });
        rutaId = nueva.id;
      }
      await tx.insert(rutaParadas).values(ids.map((socioId, i) => ({ rutaId: rutaId as string, socioId, orden: i })));
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_EXISTE") return { ok: false, error: "Esa ruta ya no existe." };
    if (e instanceof Error && e.message === "SIN_PERMISO") return { ok: false, error: "Esta ruta ya está aprobada: pídele al administrador que la cambie." };
    console.error("Rutas: no se pudo guardar:", e);
    return { ok: false, error: "No pudimos guardar la ruta. Inténtalo de nuevo en un momento." };
  }
  refrescar();
  return { ok: true };
}

/** El administrador autoriza una ruta propuesta por un operador. */
export async function aprobarRuta(id: string): Promise<ResultadoRuta> {
  const { user, apr } = await requireApr();
  if (user.rol !== "ADMIN") return { ok: false, error: "Solo el administrador puede aprobar rutas." };
  await db.update(rutas).set({ aprobada: true, aprobadaPorId: user.id, updatedAt: new Date() }).where(and(eq(rutas.id, id), eq(rutas.aprId, apr.id)));
  refrescar();
  return { ok: true };
}

/** Archiva una ruta (deja de ofrecerse en terreno y en Labores) o la restaura. Solo el administrador. */
export async function archivarRuta(id: string, archivar: boolean): Promise<ResultadoRuta> {
  const { user, apr } = await requireApr();
  if (user.rol !== "ADMIN") return { ok: false, error: "Solo el administrador puede archivar rutas." };
  await db.update(rutas).set({ archivada: archivar, updatedAt: new Date() }).where(and(eq(rutas.id, id), eq(rutas.aprId, apr.id), eq(rutas.aprobada, true)));
  refrescar();
  return { ok: true };
}

/** Borra una ruta. El administrador, cualquiera; un operador, solo las suyas que aún no se aprobaron. */
export async function eliminarRuta(id: string): Promise<ResultadoRuta> {
  const { user, apr } = await requireApr();
  const [r] = await db.select().from(rutas).where(and(eq(rutas.id, id), eq(rutas.aprId, apr.id))).limit(1);
  if (!r) return { ok: true };
  if (user.rol !== "ADMIN" && (r.creadaPorId !== user.id || r.aprobada)) return { ok: false, error: "No puedes borrar esta ruta." };
  await db.delete(rutas).where(eq(rutas.id, id));
  refrescar();
  return { ok: true };
}

/** Pone una labor que ya existe en todas las paradas de una ruta. Solo el administrador. */
export async function asignarLaborARuta(laborId: string, rutaId: string): Promise<ResultadoRuta> {
  const { user, apr } = await requireApr();
  if (user.rol !== "ADMIN") return { ok: false, error: "Solo el administrador puede asignar labores." };
  if (!puede(apr.plan as Plan, "inventario")) return { ok: false, error: "Labores está disponible desde el plan Estándar." };
  const [labor] = await db.select({ id: labores.id }).from(labores).where(and(eq(labores.id, laborId), eq(labores.aprId, apr.id))).limit(1);
  const [ruta] = await db.select({ id: rutas.id }).from(rutas).where(and(eq(rutas.id, rutaId), eq(rutas.aprId, apr.id), eq(rutas.aprobada, true), eq(rutas.archivada, false))).limit(1);
  if (!labor || !ruta) return { ok: false, error: "La labor o la ruta ya no existe." };
  try {
    await db.transaction((tx) => agregarLaborARutas(tx, apr.id, laborId, [rutaId]));
  } catch (e) {
    console.error("Rutas: no se pudo asignar la labor:", e);
    return { ok: false, error: "No pudimos asignar la labor. Inténtalo de nuevo en un momento." };
  }
  refrescar();
  return { ok: true };
}

/** Saca una labor de una ruta (de todas sus paradas). */
export async function quitarLaborDeRuta(laborId: string, rutaId: string): Promise<ResultadoRuta> {
  const { user, apr } = await requireApr();
  if (user.rol !== "ADMIN") return { ok: false, error: "Solo el administrador puede quitar labores de una ruta." };
  const [ruta] = await db.select({ id: rutas.id }).from(rutas).where(and(eq(rutas.id, rutaId), eq(rutas.aprId, apr.id))).limit(1);
  if (!ruta) return { ok: true };
  try {
    await db.transaction((tx) => quitarLaborDeRutas(tx, laborId, [rutaId]));
  } catch (e) {
    console.error("Rutas: no se pudo quitar la labor:", e);
    return { ok: false, error: "No pudimos quitar la labor. Inténtalo de nuevo en un momento." };
  }
  refrescar();
  return { ok: true };
}

/**
 * Marca (o desmarca) que una labor ya se hizo en un socio de una ruta. Lo puede hacer quien recorre la ruta: el
 * administrador o el operador. Una labor ya hecha no se toca, y marcar el primer socio de una labor programada la pasa a En curso.
 */
export async function marcarSocioDeLabor(laborId: string, paradaId: string, hecha: boolean): Promise<ResultadoRuta> {
  const { apr } = await requireApr();
  if (!puede(apr.plan as Plan, "inventario")) return { ok: false, error: "Labores está disponible desde el plan Estándar." };
  const [fila] = await db
    .select({ id: paradaLabores.id, estado: labores.estado })
    .from(paradaLabores)
    .innerJoin(labores, eq(labores.id, paradaLabores.laborId))
    .where(and(eq(paradaLabores.aprId, apr.id), eq(paradaLabores.laborId, laborId), eq(paradaLabores.paradaId, paradaId)))
    .limit(1);
  if (!fila) return { ok: false, error: "Ese socio ya no está en la labor. Recarga la pantalla." };
  if (fila.estado === "HECHA") return { ok: false, error: "La labor ya está hecha." };
  try {
    await db.transaction(async (tx) => {
      await tx.update(paradaLabores).set({ hecha, hechaAt: hecha ? new Date() : null }).where(eq(paradaLabores.id, fila.id));
      if (hecha && fila.estado === "PROGRAMADA") await tx.update(labores).set({ estado: "EN_CURSO", updatedAt: new Date() }).where(eq(labores.id, laborId));
    });
  } catch (e) {
    console.error("Rutas: no se pudo marcar el socio de la labor:", e);
    return { ok: false, error: "No pudimos guardarlo. Inténtalo de nuevo en un momento." };
  }
  revalidatePath("/panel/mis-labores");
  refrescar();
  return { ok: true };
}
