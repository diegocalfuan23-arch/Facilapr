"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { solicitudesClave } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import {
  aprobarSolicitudAcceso,
  eliminarSolicitudAcceso,
  rechazarSolicitudAcceso,
  type ResultadoAprobacion,
} from "@/lib/socios-acceso";

export async function aprobarSolicitud(
  solicitudId: string
): Promise<ResultadoAprobacion> {
  const { apr } = await requireAdmin();

  const resultado = await aprobarSolicitudAcceso(solicitudId, apr.id);

  if (resultado.ok) {
    revalidatePath("/panel/socios/solicitudes");
    revalidatePath("/panel");
  }

  return resultado;
}

export async function rechazarSolicitud(
  solicitudId: string,
  motivo: string
): Promise<ResultadoAprobacion> {
  const { apr } = await requireAdmin();

  const resultado = await rechazarSolicitudAcceso(solicitudId, apr.id, motivo);

  if (resultado.ok) {
    revalidatePath("/panel/socios/solicitudes");
    revalidatePath("/panel");
  }

  return resultado;
}

export async function eliminarSolicitud(
  solicitudId: string
): Promise<ResultadoAprobacion> {
  const { apr } = await requireAdmin();

  const resultado = await eliminarSolicitudAcceso(solicitudId, apr.id);

  if (resultado.ok) {
    revalidatePath("/panel/socios/solicitudes");
    revalidatePath("/panel");
  }

  return resultado;
}

/** Cierra una solicitud de clave nueva: ya se le mandó el enlace (ATENDIDA) o no corresponde (DESCARTADA). */
export async function resolverSolicitudClave(
  solicitudId: string,
  estado: "ATENDIDA" | "DESCARTADA"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, apr } = await requireAdmin();
  if (estado !== "ATENDIDA" && estado !== "DESCARTADA") return { ok: false, error: "Estado no válido." };

  const r = await db
    .update(solicitudesClave)
    .set({ estado, atendidaPorId: user.id, updatedAt: new Date() })
    .where(
      and(
        eq(solicitudesClave.id, solicitudId),
        eq(solicitudesClave.aprId, apr.id),
        eq(solicitudesClave.estado, "PENDIENTE")
      )
    )
    .returning({ id: solicitudesClave.id });
  if (r.length === 0) return { ok: false, error: "Esa solicitud ya no está pendiente." };

  revalidatePath("/panel/socios/solicitudes");
  revalidatePath("/panel");
  return { ok: true };
}
