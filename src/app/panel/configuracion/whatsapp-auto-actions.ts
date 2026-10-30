"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";

/** El comité decide si el comprobante sale solo por WhatsApp cada vez que registra un pago de boleta. */
export async function cambiarComprobanteAuto(activo: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const { apr } = await requireAdmin();
  await db.update(aprs).set({ whatsappComprobanteAuto: activo, updatedAt: new Date() }).where(eq(aprs.id, apr.id));
  revalidatePath("/panel/configuracion");
  return { ok: true };
}
