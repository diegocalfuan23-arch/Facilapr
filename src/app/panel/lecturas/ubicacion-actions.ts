"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";
import { requireApr } from "@/lib/apr-session";

export type ResultadoUbicacion = { ok: true } | { ok: false; error: string };

/**
 * Guarda dónde queda un socio (el punto donde se paró quien marcó, con el GPS del teléfono). La puede marcar cualquiera
 * de la directiva o el operador. Una marca nueva reemplaza a la anterior y deja quién la hizo y cuándo.
 */
export async function marcarUbicacion(socioId: string, lat: number, lng: number, precision: number): Promise<ResultadoUbicacion> {
  const { user, apr } = await requireApr();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, error: "La ubicación no es válida." };
  const metros = Number.isFinite(precision) ? Math.min(Math.max(Math.round(precision), 0), 100_000) : 100_000;

  const [actualizado] = await db
    .update(socios)
    .set({ lat, lng, ubicacionPrecision: metros, ubicacionPorId: user.id, ubicacionAt: new Date() })
    .where(and(eq(socios.id, socioId), eq(socios.aprId, apr.id)))
    .returning({ id: socios.id });
  if (!actualizado) return { ok: false, error: "No encontramos a ese socio." };

  revalidatePath("/panel/lecturas");
  revalidatePath("/panel/lecturas/terreno");
  revalidatePath("/panel/rutas");
  return { ok: true };
}
