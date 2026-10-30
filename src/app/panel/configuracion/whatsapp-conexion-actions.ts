"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/apr-session";
import { conectarComite, conexionDeComitesActiva, desconectarComite } from "@/lib/whatsapp-conexion";

export type ResultadoConectar = { ok: true; numero: string | null; avisos: string[] } | { ok: false; error: string };

/**
 * El comité terminó el registro insertado de Meta: llegan el código, su cuenta y su
 * número. El comité sale de la sesión, nunca del formulario.
 */
export async function conectarWhatsapp(datos: {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}): Promise<ResultadoConectar> {
  const { apr } = await requireAdmin();
  if (!conexionDeComitesActiva()) return { ok: false, error: "La conexión de WhatsApp todavía no está disponible." };

  const code = String(datos.code ?? "").trim();
  const wabaId = String(datos.wabaId ?? "").trim();
  const phoneNumberId = String(datos.phoneNumberId ?? "").trim();
  // Los ids de Meta son numéricos: cualquier otra cosa no viene de su ventana.
  if (!code || !/^\d{5,25}$/.test(wabaId) || !/^\d{5,25}$/.test(phoneNumberId)) {
    return { ok: false, error: "Meta no devolvió los datos de tu cuenta. Vuelve a intentarlo." };
  }

  const r = await conectarComite({ aprId: apr.id, code, wabaId, phoneNumberId });
  if (!r.ok) console.error("Conexión de WhatsApp:", r.error);
  revalidatePath("/panel/configuracion");
  return r;
}

export async function desconectarWhatsapp(): Promise<{ ok: true }> {
  const { apr } = await requireAdmin();
  await desconectarComite(apr.id);
  revalidatePath("/panel/configuracion");
  return { ok: true };
}
