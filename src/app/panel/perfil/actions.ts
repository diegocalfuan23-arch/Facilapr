"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/auth-schema";
import { requireApr } from "@/lib/apr-session";
import { CARGOS } from "@/lib/cargos";

export type ResultadoPerfil = { ok: true } | { ok: false; error: string };

/** El nombre y el cargo de quien tiene la sesión abierta. Nada de esto toca los datos del comité. */
export async function guardarPerfil(datos: { nombre: string; cargo: string }): Promise<ResultadoPerfil> {
  const { user } = await requireApr();

  const nombre = String(datos.nombre ?? "").trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 80) {
    return { ok: false, error: "Escribe tu nombre (entre 2 y 80 caracteres)." };
  }

  // El cargo lo declara quien registró el comité; un técnico no tiene uno que elegir.
  const cambios: { name: string; cargo?: string; updatedAt: Date } = { name: nombre, updatedAt: new Date() };
  if (user.rol === "ADMIN") {
    if (!CARGOS.some((c) => c.value === datos.cargo)) {
      return { ok: false, error: "Elige el cargo que ocupas en el comité." };
    }
    cambios.cargo = datos.cargo;
  }

  await db.update(userTable).set(cambios).where(eq(userTable.id, user.id));
  revalidatePath("/panel", "layout");
  return { ok: true };
}

/** Cambia la contraseña de quien tiene la sesión abierta: pide la actual y cierra sus otras sesiones. */
export async function cambiarClave(datos: {
  actual: string;
  nueva: string;
  repetida: string;
}): Promise<ResultadoPerfil> {
  await requireApr();

  if (!datos.actual) return { ok: false, error: "Escribe tu contraseña actual." };
  if (datos.nueva.length < 8) {
    return { ok: false, error: "La contraseña nueva debe tener al menos 8 caracteres." };
  }
  if (datos.nueva !== datos.repetida) {
    return { ok: false, error: "Las dos contraseñas nuevas no coinciden." };
  }
  if (datos.nueva === datos.actual) {
    return { ok: false, error: "La contraseña nueva tiene que ser distinta de la actual." };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: datos.actual,
        newPassword: datos.nueva,
        // Si alguien más tenía la sesión abierta, deja de servir.
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch (error) {
    const codigo = (error as { body?: { code?: string } })?.body?.code;
    if (codigo === "INVALID_PASSWORD") {
      return { ok: false, error: "Tu contraseña actual no es correcta." };
    }
    return { ok: false, error: "No pudimos cambiar la contraseña. Intenta de nuevo." };
  }
}
