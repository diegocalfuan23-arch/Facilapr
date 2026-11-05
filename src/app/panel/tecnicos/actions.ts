"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitaciones } from "@/lib/db/schema";
import { session as sessionTable, user as userTable } from "@/lib/db/auth-schema";
import { requireAdmin } from "@/lib/apr-session";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

/** Cancela una invitación sin usar antes de que venza, para que el código quede inválido. */
export async function cancelarInvitacion(
  invitacionId: string
): Promise<ResultadoAccion> {
  const { apr } = await requireAdmin();

  await db
    .delete(invitaciones)
    .where(
      and(eq(invitaciones.id, invitacionId), eq(invitaciones.aprId, apr.id))
    );

  revalidatePath("/panel/tecnicos");
  return { ok: true };
}

/**
 * Quita el acceso a un operador que ya se registró (dejó el cargo, cambió el
 * teléfono, etc.). No borra su usuario ni sus lecturas: quedan en el historial
 * con su nombre. Se cierran sus sesiones y, mientras esté desactivado, no puede
 * entrar (ver requireApr). Se puede reactivar.
 */
export async function desactivarOperador(userId: string): Promise<ResultadoAccion> {
  const { apr } = await requireAdmin();

  const tecnico = await db.query.user.findFirst({
    where: and(
      eq(userTable.id, userId),
      eq(userTable.aprId, apr.id),
      inArray(userTable.rol, ["OPERADOR", "TESORERO"])
    ),
    columns: { id: true, rol: true },
  });
  if (!tecnico) return { ok: false, error: "No encontramos a esa persona." };

  await db
    .update(userTable)
    .set({ rol: tecnico.rol === "TESORERO" ? "DESACTIVADO_TESORERO" : "DESACTIVADO", updatedAt: new Date() })
    .where(eq(userTable.id, tecnico.id));
  await db.delete(sessionTable).where(eq(sessionTable.userId, tecnico.id));

  revalidatePath("/panel/tecnicos");
  return { ok: true };
}

export async function reactivarOperador(userId: string): Promise<ResultadoAccion> {
  const { apr } = await requireAdmin();

  const tecnico = await db.query.user.findFirst({
    where: and(
      eq(userTable.id, userId),
      eq(userTable.aprId, apr.id),
      inArray(userTable.rol, ["DESACTIVADO", "DESACTIVADO_TESORERO"])
    ),
    columns: { id: true, rol: true },
  });
  if (!tecnico) return { ok: false, error: "No encontramos a esa persona." };

  await db
    .update(userTable)
    .set({ rol: tecnico.rol === "DESACTIVADO_TESORERO" ? "TESORERO" : "OPERADOR", updatedAt: new Date() })
    .where(eq(userTable.id, tecnico.id));

  revalidatePath("/panel/tecnicos");
  return { ok: true };
}
