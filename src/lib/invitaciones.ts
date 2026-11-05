import { eq, gt, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { invitaciones, aprs } from "@/lib/db/schema";

/** Las invitaciones de operador vencen rápido: son de un solo uso y de
    entrega inmediata (WhatsApp/correo), no tiene sentido dejarlas abiertas. */
const DIAS_VALIDEZ = 7;

export type RolInvitado = "OPERADOR" | "TESORERO";

export async function crearInvitacion(aprId: string, rol: RolInvitado = "OPERADOR") {
  const expiraEn = new Date();
  expiraEn.setDate(expiraEn.getDate() + DIAS_VALIDEZ);

  const [invitacion] = await db
    .insert(invitaciones)
    .values({ aprId, rol, expiraEn })
    .returning();

  return invitacion;
}

export type InvitacionValida = { aprId: string; invitacionId: string; rol: RolInvitado };

/** Null si el código no existe, ya se usó o venció. */
export async function validarInvitacion(
  codigo: string
): Promise<InvitacionValida | null> {
  const invitacion = await db.query.invitaciones.findFirst({
    where: and(
      eq(invitaciones.codigo, codigo),
      gt(invitaciones.expiraEn, new Date())
    ),
  });

  if (!invitacion || invitacion.usadaPor) return null;

  return {
    aprId: invitacion.aprId,
    invitacionId: invitacion.id,
    rol: invitacion.rol === "TESORERO" ? "TESORERO" : "OPERADOR",
  };
}

export async function marcarInvitacionUsada(
  invitacionId: string,
  userId: string
) {
  await db
    .update(invitaciones)
    .set({ usadaPor: userId })
    .where(eq(invitaciones.id, invitacionId));
}

/**
 * Datos del comité para la pantalla de invitación: el operador ve a qué
 * APR se está uniendo, y el formulario de registro los envía tal cual para
 * que el hook de alta lo empareje con el comité existente por RUT en vez de
 * crear uno nuevo.
 */
export async function aprDeInvitacion(codigo: string) {
  const invitacion = await validarInvitacion(codigo);
  if (!invitacion) return null;

  const apr = await db.query.aprs.findFirst({
    where: eq(aprs.id, invitacion.aprId),
    columns: { nombre: true, rut: true, comuna: true },
  });

  return apr ? { ...apr, rol: invitacion.rol } : null;
}
