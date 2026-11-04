"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { LOGO_MAX_BYTES, LOGO_MAX_LADO, PREFIJO_LOGO } from "@/lib/logo";

/**
 * El logo del comité, que sale en sus recibos y comprobantes. El navegador ya lo
 * achicó a un PNG chico; aquí se vuelve a comprobar todo, porque el servidor no
 * puede fiarse de lo que le llega: que de verdad sea un PNG, que pese poco y que
 * no sea enorme. Se guarda como imagen incrustada (data URL) en el propio comité:
 * pesa unos pocos KB y evita montar un almacenamiento de archivos aparte.
 */

export type ResultadoLogo = { ok: true } | { ok: false; error: string };

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export async function guardarLogo(dataUrl: string): Promise<ResultadoLogo> {
  const { apr } = await requireAdmin();

  if (typeof dataUrl !== "string" || !dataUrl.startsWith(PREFIJO_LOGO)) {
    return { ok: false, error: "El logo debe ser una imagen PNG." };
  }

  const bytes = Buffer.from(dataUrl.slice(PREFIJO_LOGO.length), "base64");
  if (bytes.length > LOGO_MAX_BYTES) {
    return { ok: false, error: "El logo pesa demasiado. Prueba con una imagen más simple." };
  }
  if (bytes.length < 33 || FIRMA_PNG.some((b, i) => bytes[i] !== b)) {
    return { ok: false, error: "El archivo no es una imagen PNG válida." };
  }

  // El ancho y el alto vienen en el primer bloque del PNG (IHDR).
  const ancho = bytes.readUInt32BE(16);
  const alto = bytes.readUInt32BE(20);
  if (ancho === 0 || alto === 0 || ancho > LOGO_MAX_LADO || alto > LOGO_MAX_LADO) {
    return { ok: false, error: "La imagen es demasiado grande." };
  }

  await db
    .update(aprs)
    .set({ logoUrl: dataUrl, updatedAt: new Date() })
    .where(eq(aprs.id, apr.id));

  revalidatePath("/panel/configuracion");
  return { ok: true };
}

export async function quitarLogo(): Promise<ResultadoLogo> {
  const { apr } = await requireAdmin();

  await db
    .update(aprs)
    .set({ logoUrl: null, updatedAt: new Date() })
    .where(eq(aprs.id, apr.id));

  revalidatePath("/panel/configuracion");
  return { ok: true };
}
