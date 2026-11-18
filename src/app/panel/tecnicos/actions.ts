"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitaciones } from "@/lib/db/schema";
import { session as sessionTable, user as userTable } from "@/lib/db/auth-schema";
import { requireAdmin } from "@/lib/apr-session";
import { LIMITE_TECNICOS, NOMBRE_PLAN, puede, type Plan } from "@/lib/planes";

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

/** Le da 7 días más a una invitación sin usar (por ejemplo, una que ya venció). */
export async function renovarInvitacion(invitacionId: string): Promise<ResultadoAccion> {
  const { apr } = await requireAdmin();
  const expiraEn = new Date();
  expiraEn.setDate(expiraEn.getDate() + 7);
  await db
    .update(invitaciones)
    .set({ expiraEn })
    .where(and(eq(invitaciones.id, invitacionId), eq(invitaciones.aprId, apr.id), isNull(invitaciones.usadaPor)));
  revalidatePath("/panel/tecnicos");
  return { ok: true };
}

/** Cambia a una persona activa entre operador y tesorero. El tesorero solo existe en los planes con Finanzas. */
export async function cambiarRolEquipo(userId: string, rol: "OPERADOR" | "TESORERO"): Promise<ResultadoAccion> {
  const { apr } = await requireAdmin();
  const plan = apr.plan as Plan;
  if (rol === "TESORERO" && !puede(plan, "finanzas")) return { ok: false, error: "Las finanzas están disponibles desde el plan Estándar." };

  const persona = await db.query.user.findFirst({
    where: and(eq(userTable.id, userId), eq(userTable.aprId, apr.id), inArray(userTable.rol, ["OPERADOR", "TESORERO"])),
    columns: { id: true, rol: true },
  });
  if (!persona) return { ok: false, error: "No encontramos a esa persona." };
  if (persona.rol === rol) return { ok: true };

  const limite = LIMITE_TECNICOS[plan];
  if (rol === "OPERADOR" && Number.isFinite(limite)) {
    const [{ n }] = await db.select({ n: count() }).from(userTable).where(and(eq(userTable.aprId, apr.id), eq(userTable.rol, "OPERADOR")));
    if (n >= limite) return { ok: false, error: `Tu plan ${NOMBRE_PLAN[plan]} permite ${limite} ${limite === 1 ? "operador" : "operadores"}.` };
  }

  await db.update(userTable).set({ rol, updatedAt: new Date() }).where(eq(userTable.id, persona.id));
  // Se cierra su sesión: al volver a entrar ve lo que corresponde a su nuevo rol.
  await db.delete(sessionTable).where(eq(sessionTable.userId, persona.id));
  revalidatePath("/panel/tecnicos");
  return { ok: true };
}
