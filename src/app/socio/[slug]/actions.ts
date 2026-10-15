"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { and, isNotNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { aprs, socios } from "@/lib/db/schema";
import {
  huellaDeClave,
  leerInvitacionSocio,
  leerRestablecerClave,
} from "@/lib/invitacion-socio";
import { cuentaDeSocio } from "@/lib/socios-acceso";
import { pedirRestablecerClave } from "@/lib/solicitud-clave";
import {
  account as accountTable,
  session as sessionTable,
} from "@/lib/db/auth-schema";
import {
  solicitarAccesoSocio,
  crearCuentaSocio,
  correoSocioDesdeRut,
  type ResultadoSolicitud,
} from "@/lib/socios-acceso";

const solicitudSchema = z.object({
  rut: z.string().trim().min(3, "Ingresa tu RUT."),
  clave: z.string().min(8, "La clave debe tener al menos 8 caracteres."),
});

/** El slug viene de la URL, nunca del formulario: no hay que confiar en el cliente para saber a qué comité pertenece. */
export async function solicitarAcceso(
  slug: string,
  _prev: ResultadoSolicitud | null,
  formData: FormData
): Promise<ResultadoSolicitud> {
  const apr = await db.query.aprs.findFirst({
    where: eq(aprs.slug, slug),
    columns: { id: true },
  });
  if (!apr) return { ok: false, error: "Comité no encontrado." };

  const parsed = solicitudSchema.safeParse({
    rut: formData.get("rut"),
    clave: formData.get("clave"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return solicitarAccesoSocio({
    aprId: apr.id,
    rut: parsed.data.rut,
    clave: parsed.data.clave,
  });
}

/**
 * Traduce RUT + slug al correo sintético que necesita signIn.email() en el
 * cliente. No hace login por sí misma —Better Auth necesita correr en el
 * cliente para dejar la cookie de sesión— solo resuelve el dato.
 */
export async function correoParaLogin(
  slug: string,
  rut: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const apr = await db.query.aprs.findFirst({
    where: eq(aprs.slug, slug),
    columns: { id: true },
  });
  if (!apr) return { ok: false, error: "Comité no encontrado." };

  return { ok: true, email: correoSocioDesdeRut(rut, apr.id) };
}

export type ResultadoInvitacion =
  | { ok: true; email: string }
  | { ok: false; error: string };

/**
 * El socio abrió su invitación y elige su clave. El enlace es la prueba de que
 * la directiva se la mandó (llega al teléfono registrado en el padrón), así que
 * la cuenta se crea de inmediato, sin pasar por solicitud ni aprobación.
 */
export async function aceptarInvitacion(
  slug: string,
  codigo: string,
  clave: string
): Promise<ResultadoInvitacion> {
  if (clave.length < 8) {
    return { ok: false, error: "La clave debe tener al menos 8 caracteres." };
  }

  const socioId = leerInvitacionSocio(codigo);
  if (!socioId) {
    return { ok: false, error: "Este enlace no es válido o ya venció. Pídele uno nuevo a tu comité." };
  }

  const apr = await db.query.aprs.findFirst({
    where: eq(aprs.slug, slug),
    columns: { id: true },
  });
  const socio = apr
    ? await db.query.socios.findFirst({
        where: and(eq(socios.id, socioId), eq(socios.aprId, apr.id)),
        columns: { id: true, nombre: true, rut: true, aprId: true, userId: true },
      })
    : null;
  if (!socio || !socio.rut) {
    return { ok: false, error: "Este enlace no es válido. Pídele uno nuevo a tu comité." };
  }

  // Una persona con varios arranques comparte una sola cuenta (por su RUT).
  const yaTieneCuenta =
    socio.userId ||
    (await db.query.socios.findFirst({
      where: and(
        eq(socios.aprId, socio.aprId),
        eq(socios.rut, socio.rut),
        isNotNull(socios.userId)
      ),
      columns: { id: true },
    }));
  if (yaTieneCuenta) {
    return {
      ok: false,
      error: "Esta cuenta ya fue creada. Entra con tu RUT y tu clave; si la olvidaste, pídele a tu comité que la restablezca.",
    };
  }

  const { email } = await crearCuentaSocio(
    { id: socio.id, nombre: socio.nombre, rut: socio.rut, aprId: socio.aprId },
    await hashPassword(clave)
  );
  return { ok: true, email };
}

/**
 * El socio abrió el enlace que le mandó su comité y elige una clave nueva. El
 * enlace lleva una huella de la clave que tenía: si ya la cambió, la huella no
 * coincide y el enlace no sirve (un solo uso). Se cierran sus sesiones abiertas.
 */
export async function restablecerClaveConEnlace(
  slug: string,
  codigo: string,
  clave: string
): Promise<ResultadoInvitacion> {
  if (clave.length < 8) {
    return { ok: false, error: "La clave debe tener al menos 8 caracteres." };
  }

  const dato = leerRestablecerClave(codigo);
  if (!dato) {
    return { ok: false, error: "Este enlace no es válido o ya venció. Pídele uno nuevo a tu comité." };
  }

  const apr = await db.query.aprs.findFirst({
    where: eq(aprs.slug, slug),
    columns: { id: true },
  });
  const cuenta = apr ? await cuentaDeSocio(dato.socioId, apr.id) : null;
  if (!cuenta || !cuenta.socio.rut || huellaDeClave(cuenta.claveHash) !== dato.huella) {
    return { ok: false, error: "Este enlace ya se usó o dejó de servir. Pídele uno nuevo a tu comité." };
  }

  await db
    .update(accountTable)
    .set({ password: await hashPassword(clave), updatedAt: new Date() })
    .where(eq(accountTable.id, cuenta.accountId));

  // Cualquier sesión abierta con la clave anterior deja de servir.
  await db.delete(sessionTable).where(eq(sessionTable.userId, cuenta.userId));

  return { ok: true, email: correoSocioDesdeRut(cuenta.socio.rut, cuenta.socio.aprId) };
}

/**
 * «No puedo entrar»: el socio escribe su RUT y su comité recibe el aviso. La
 * respuesta es siempre la misma, sea o no socio, para no confirmar RUT ajenos.
 * El slug viene de la URL, nunca del formulario.
 */
export async function avisarNoPuedoEntrar(slug: string, rut: string): Promise<{ ok: boolean }> {
  const texto = String(rut ?? "").trim();
  if (texto.length < 7 || texto.length > 14) return { ok: false };

  const apr = await db.query.aprs.findFirst({
    where: eq(aprs.slug, slug),
    columns: { id: true },
  });
  if (!apr) return { ok: false };

  await pedirRestablecerClave({ aprId: apr.id, rut: texto });
  return { ok: true };
}
