"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";

/** El comité decide si sale en el buscador público de socios (facilapr.cl/socios). Necesita tener su dirección (slug). */
export async function cambiarApareceEnBuscador(aparece: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const { apr } = await requireAdmin();
  if (aparece && !apr.slug) {
    return { ok: false, error: "Primero elige la dirección de tu comité en Mi sitio." };
  }
  await db.update(aprs).set({ apareceEnBuscador: aparece, updatedAt: new Date() }).where(eq(aprs.id, apr.id));
  revalidatePath("/panel/configuracion");
  revalidatePath("/socios");
  return { ok: true };
}
