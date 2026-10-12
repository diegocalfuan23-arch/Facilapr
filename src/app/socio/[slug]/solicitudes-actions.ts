"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { ordenes } from "@/lib/db/schema";
import { cuentasDelSocio, requireSocio } from "@/lib/socio-session";
import { basePortal } from "@/lib/portal-socio";
import { TIPOS_SOCIO, type TipoOrden } from "@/lib/ordenes";

export type ResultadoSolicitud = { ok: true } | { ok: false; error: string };

const ABIERTAS = ["SOLICITADA", "EN_TRAMITE", "POR_CONFIRMAR"];

/**
 * Lo que el socio pide desde su portal: un reclamo, que le repongan o le
 * reparen el servicio, o darlo de baja. Siempre queda como solicitud hasta que
 * la directiva la revisa. Solo puede pedir sobre sus propios arranques.
 */
export async function crearSolicitudSocio(
  slug: string,
  socioId: string,
  tipo: TipoOrden,
  detalle: string
): Promise<ResultadoSolicitud> {
  const { user, socio } = await requireSocio(slug);

  if (!TIPOS_SOCIO.includes(tipo)) return { ok: false, error: "Elige qué quieres pedir." };

  const cuentas = await cuentasDelSocio(socio);
  if (!cuentas.some((c) => c.id === socioId)) {
    return { ok: false, error: "Ese arranque no es tuyo." };
  }

  const texto = detalle.trim().slice(0, 500);
  if ((tipo === "RECLAMO" || tipo === "REPARACION") && texto.length < 5) {
    return { ok: false, error: "Cuéntanos qué pasó, aunque sea en una frase corta." };
  }

  // Una reposición solo tiene sentido si el servicio está cortado.
  if (tipo === "REPOSICION") {
    const ultima = await db.query.ordenes.findFirst({
      where: and(
        eq(ordenes.socioId, socioId),
        eq(ordenes.estado, "COMPLETADA"),
        inArray(ordenes.tipo, ["CORTE", "REPOSICION"])
      ),
      orderBy: [desc(ordenes.confirmadaAt)],
      columns: { tipo: true },
    });
    if (ultima?.tipo !== "CORTE") {
      return { ok: false, error: "Tu servicio no figura cortado. Si algo falla, pide una reparación." };
    }
  }

  const abierta = await db.query.ordenes.findFirst({
    where: and(eq(ordenes.socioId, socioId), eq(ordenes.tipo, tipo), inArray(ordenes.estado, ABIERTAS)),
    columns: { id: true },
  });
  if (abierta && tipo !== "RECLAMO") {
    return { ok: false, error: "Ya tienes una solicitud de ese tipo en curso." };
  }

  await db.insert(ordenes).values({
    aprId: socio.aprId,
    socioId,
    tipo,
    estado: "SOLICITADA",
    origen: "SOCIO",
    detalle: texto || null,
    solicitadaPorId: user.id,
  });

  revalidatePath(`${await basePortal(slug)}/solicitudes`);
  revalidatePath("/panel/cortes");
  return { ok: true };
}
