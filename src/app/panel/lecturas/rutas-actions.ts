"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { rutaParadas, rutas, socios } from "@/lib/db/schema";
import { requireApr } from "@/lib/apr-session";

export type ResultadoRuta = { ok: true } | { ok: false; error: string };

function refrescar() {
  revalidatePath("/panel/lecturas");
  revalidatePath("/panel/lecturas/terreno");
}

/**
 * Crea una ruta o cambia una existente (nombre y socios en orden). Si la crea el administrador queda aprobada;
 * si la crea un operador queda por aprobar. Un operador solo toca sus propias rutas y mientras no estén aprobadas.
 */
export async function guardarRuta(id: string | null, nombre: string, socioIds: string[]): Promise<ResultadoRuta> {
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
  try {
    await db.transaction(async (tx) => {
      let rutaId = id;
      if (rutaId) {
        const [r] = await tx.select().from(rutas).where(and(eq(rutas.id, rutaId), eq(rutas.aprId, apr.id))).limit(1);
        if (!r) throw new Error("NO_EXISTE");
        if (!esAdmin && (r.creadaPorId !== user.id || r.aprobada)) throw new Error("SIN_PERMISO");
        await tx.update(rutas).set({ nombre: limpio, updatedAt: new Date() }).where(eq(rutas.id, rutaId));
        await tx.delete(rutaParadas).where(eq(rutaParadas.rutaId, rutaId));
      } else {
        const [nueva] = await tx
          .insert(rutas)
          .values({ aprId: apr.id, nombre: limpio, aprobada: esAdmin, aprobadaPorId: esAdmin ? user.id : null, creadaPorId: user.id })
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
