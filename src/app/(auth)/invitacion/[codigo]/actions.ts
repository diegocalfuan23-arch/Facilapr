"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/auth-schema";
import { validarInvitacion, marcarInvitacionUsada } from "@/lib/invitaciones";

export type ResultadoUnirse = { ok: true } | { ok: false; error: string };

/**
 * Se llama justo después de que Better Auth crea la cuenta. El formulario de
 * invitación ya mandó el RUT del APR real como additionalField, así que el
 * hook de registro (auth.ts) encontró ese comité por RUT y no creó uno
 * nuevo: aquí solo falta darle el rol de la invitación (operador o tesorero) y consumir el
 * código, ya no hay que tocar aprId.
 */
export async function unirseConInvitacion(
  codigo: string,
  userId: string
): Promise<ResultadoUnirse> {
  const invitacion = await validarInvitacion(codigo);
  if (!invitacion) {
    return { ok: false, error: "Esta invitación ya no es válida." };
  }

  await db
    .update(userTable)
    .set({ rol: invitacion.rol })
    .where(eq(userTable.id, userId));

  await marcarInvitacionUsada(invitacion.invitacionId, userId);

  return { ok: true };
}
