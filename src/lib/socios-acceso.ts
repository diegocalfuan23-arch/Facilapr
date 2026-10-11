import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { solicitudesAcceso, socios } from "@/lib/db/schema";
import { user as userTable, account as accountTable } from "@/lib/db/auth-schema";
import { normalizarRut } from "@/lib/formato";
import { createId } from "@paralleldrive/cuid2";

export type ResultadoSolicitud = { ok: true } | { ok: false; error: string };

/**
 * Pide acceso al panel de un socio. No crea ninguna cuenta de Better Auth
 * todavía —solo guarda el hash de la clave junto a la solicitud— porque
 * cualquiera que sepa un RUT (no es secreto) podría intentar esto: la
 * cuenta real nace recién cuando la directiva aprueba, nunca antes.
 */
export async function solicitarAccesoSocio({
  aprId,
  rut,
  clave,
}: {
  aprId: string;
  rut: string;
  clave: string;
}): Promise<ResultadoSolicitud> {
  const rutNormalizado = normalizarRut(rut);

  // Una persona puede tener varios arranques (varias filas con su RUT): la
  // cuenta es una sola y desde ella se ven todos.
  const delRut = await db.query.socios.findMany({
    where: and(eq(socios.aprId, aprId), eq(socios.rut, rutNormalizado)),
    columns: { id: true, userId: true },
  });
  const socio = delRut[0];

  // Mensaje genérico a propósito: no hay que confirmarle a un desconocido
  // si un RUT en particular es o no socio de este comité.
  const ERROR_GENERICO =
    "No pudimos verificar ese RUT con el padrón del comité. Si el problema persiste, contacta a tu comité.";

  if (!socio) return { ok: false, error: ERROR_GENERICO };
  if (delRut.some((s) => s.userId)) {
    return {
      ok: false,
      error: "Ese RUT ya tiene una cuenta. Si olvidaste tu clave, contacta a tu comité.",
    };
  }

  const pendiente = await db.query.solicitudesAcceso.findFirst({
    where: and(
      eq(solicitudesAcceso.socioId, socio.id),
      eq(solicitudesAcceso.estado, "PENDIENTE")
    ),
    columns: { id: true },
  });
  if (pendiente) {
    return {
      ok: false,
      error: "Ya hay una solicitud pendiente para este RUT. Espera a que tu comité la revise.",
    };
  }

  const claveHash = await hashPassword(clave);

  await db.insert(solicitudesAcceso).values({
    socioId: socio.id,
    claveHash,
  });

  return { ok: true };
}

/**
 * Crea la cuenta de un socio directamente en las tablas de Better Auth (user +
 * account), con rol SOCIO fijado desde el insert, y la vincula a su fila del
 * padrón. La usan dos caminos: aprobar una solicitud de acceso y aceptar una
 * invitación de la directiva.
 *
 * A propósito NO pasa por auth.api.signUp: ese flujo dispara el hook de
 * auth.ts pensado para el registro de un dirigente nuevo (crea/vincula un
 * Apr y el usuario nace ADMIN por defecto) — exactamente lo que no debe
 * pasarle a un socio, ni siquiera un instante.
 */
export async function crearCuentaSocio(
  socio: { id: string; nombre: string; rut: string; aprId: string },
  claveHash: string
): Promise<{ userId: string; email: string }> {
  const userId = createId();
  const email = correoSocioDesdeRut(socio.rut, socio.aprId);

  await db.insert(userTable).values({
    id: userId,
    name: socio.nombre,
    email,
    // El correo es interno, el socio nunca lo ve ni tiene que verificarlo.
    emailVerified: true,
    // apr/rutComite/comuna existen para el registro de un dirigente nuevo,
    // que declara esos datos para crear su comité. Un socio ya pertenece a
    // un Apr existente (aprId abajo) y no declara nada de eso: quedan vacíos
    // a propósito, no es un dato faltante.
    apr: "",
    rutComite: "",
    comuna: "",
    cargo: "socio",
    aprId: socio.aprId,
    rol: "SOCIO",
  });

  await db.insert(accountTable).values({
    id: createId(),
    userId,
    providerId: "credential",
    accountId: userId,
    password: claveHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.update(socios).set({ userId }).where(eq(socios.id, socio.id));

  return { userId, email };
}

export type ResultadoAprobacion = { ok: true } | { ok: false; error: string };

/**
 * Aprueba una solicitud: crea la cuenta directamente en las tablas de
 * Better Auth (user + account), replicando lo que hace internamente su
 * propio signUp, pero con rol SOCIO fijado desde el insert.
 *
 * A propósito NO pasa por auth.api.signUp: ese flujo dispara el hook de
 * auth.ts pensado para el registro de un dirigente nuevo (crea/vincula un
 * Apr y el usuario nace ADMIN por defecto) — exactamente lo que no debe
 * pasarle a un socio, ni siquiera un instante.
 */
export async function aprobarSolicitudAcceso(
  solicitudId: string,
  aprId: string
): Promise<ResultadoAprobacion> {
  const solicitud = await db.query.solicitudesAcceso.findFirst({
    where: eq(solicitudesAcceso.id, solicitudId),
    with: { socio: { columns: { id: true, aprId: true, nombre: true, rut: true, userId: true } } },
  });

  if (!solicitud || solicitud.socio.aprId !== aprId) {
    return { ok: false, error: "Solicitud no encontrada." };
  }
  if (solicitud.estado !== "PENDIENTE") {
    return { ok: false, error: "Esta solicitud ya fue resuelta." };
  }
  if (solicitud.socio.userId) {
    return { ok: false, error: "Este socio ya tiene una cuenta." };
  }

  // Sin RUT no hay solicitud de acceso (se pide con el RUT): no debería llegar.
  if (!solicitud.socio.rut) {
    return { ok: false, error: "Este socio no tiene RUT en el padrón." };
  }

  await crearCuentaSocio(
    {
      id: solicitud.socio.id,
      nombre: solicitud.socio.nombre,
      rut: solicitud.socio.rut,
      aprId: solicitud.socio.aprId,
    },
    solicitud.claveHash
  );

  await db
    .update(solicitudesAcceso)
    .set({ estado: "APROBADA", updatedAt: new Date() })
    .where(eq(solicitudesAcceso.id, solicitudId));

  return { ok: true };
}

export async function rechazarSolicitudAcceso(
  solicitudId: string,
  aprId: string,
  motivo: string
): Promise<ResultadoAprobacion> {
  const solicitud = await db.query.solicitudesAcceso.findFirst({
    where: eq(solicitudesAcceso.id, solicitudId),
    with: { socio: { columns: { aprId: true } } },
  });

  if (!solicitud || solicitud.socio.aprId !== aprId) {
    return { ok: false, error: "Solicitud no encontrada." };
  }
  if (solicitud.estado !== "PENDIENTE") {
    return { ok: false, error: "Esta solicitud ya fue resuelta." };
  }

  await db
    .update(solicitudesAcceso)
    .set({ estado: "RECHAZADA", motivoRechazo: motivo, updatedAt: new Date() })
    .where(eq(solicitudesAcceso.id, solicitudId));

  return { ok: true };
}

/**
 * Borra el registro de una solicitud (pendiente, aprobada o rechazada). Solo
 * quita la fila: la cuenta de un socio ya aprobado vive en user/account y no
 * se toca. Si estaba pendiente, el socio puede volver a pedir acceso.
 */
export async function eliminarSolicitudAcceso(
  solicitudId: string,
  aprId: string
): Promise<ResultadoAprobacion> {
  const solicitud = await db.query.solicitudesAcceso.findFirst({
    where: eq(solicitudesAcceso.id, solicitudId),
    with: { socio: { columns: { aprId: true } } },
  });

  if (!solicitud || solicitud.socio.aprId !== aprId) {
    return { ok: false, error: "Solicitud no encontrada." };
  }

  await db.delete(solicitudesAcceso).where(eq(solicitudesAcceso.id, solicitudId));
  return { ok: true };
}

/** RUT normalizado -> correo sintético, para el login. */
export function correoSocioDesdeRut(rut: string, aprId: string): string {
  return `${normalizarRut(rut).toLowerCase()}@${aprId}.socio.local`;
}
