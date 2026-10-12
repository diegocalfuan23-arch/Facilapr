"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, evidenciasOrden, ordenes, socios } from "@/lib/db/schema";
import { requireApr } from "@/lib/apr-session";
import { MAX_FOTO_BASE64 } from "@/lib/ordenes";

export type ResultadoOrden = { ok: true } | { ok: false; error: string };

const ABIERTAS = ["SOLICITADA", "EN_TRAMITE", "POR_CONFIRMAR"];

function refrescar() {
  revalidatePath("/panel/cortes");
  revalidatePath("/panel/ordenes");
}

/** El arranque, si es del comité del usuario. */
async function socioDelComite(aprId: string, socioId: string) {
  const socio = await db.query.socios.findFirst({
    where: and(eq(socios.id, socioId), eq(socios.aprId, aprId)),
    columns: { id: true },
  });
  return socio ?? null;
}

/** Lo que debe ese arranque: sus boletas con saldo, sin las anuladas. */
async function deudaDe(socioId: string) {
  const [f] = await db
    .select({
      deuda: sql<number>`coalesce(sum(${boletas.montoTotal} - ${boletas.montoPagado}), 0)::int`,
    })
    .from(boletas)
    .where(
      and(
        eq(boletas.socioId, socioId),
        ne(boletas.estado, "ANULADA"),
        sql`${boletas.montoPagado} < ${boletas.montoTotal}`
      )
    );
  return f?.deuda ?? 0;
}

/** Solo la directiva decide a quién se le corta el servicio. */
export async function ordenarCorte(socioId: string, detalle?: string): Promise<ResultadoOrden> {
  const { user, apr } = await requireApr();
  if (user.rol !== "ADMIN") return { ok: false, error: "Solo la directiva puede ordenar un corte." };
  if (!(await socioDelComite(apr.id, socioId))) {
    return { ok: false, error: "Ese socio no pertenece a tu comité." };
  }

  const abierta = await db.query.ordenes.findFirst({
    where: and(
      eq(ordenes.socioId, socioId),
      eq(ordenes.tipo, "CORTE"),
      inArray(ordenes.estado, ABIERTAS)
    ),
    columns: { id: true },
  });
  if (abierta) return { ok: false, error: "Ese socio ya tiene un corte en trámite." };

  await db.insert(ordenes).values({
    aprId: apr.id,
    socioId,
    tipo: "CORTE",
    estado: "EN_TRAMITE",
    origen: "COMITE",
    detalle: detalle?.trim().slice(0, 300) || "Morosidad",
    deudaAlOrdenar: await deudaDe(socioId),
    solicitadaPorId: user.id,
  });
  refrescar();
  return { ok: true };
}

/**
 * Pedir una reposición o una reparación. Si la pide la directiva queda de una
 * vez en trámite; si la pide un técnico, espera que la directiva la apruebe.
 */
export async function solicitarOrden(
  socioId: string,
  tipo: "REPOSICION" | "REPARACION",
  detalle?: string
): Promise<ResultadoOrden> {
  const { user, apr } = await requireApr();
  if (tipo !== "REPOSICION" && tipo !== "REPARACION") {
    return { ok: false, error: "Tipo de orden no válido." };
  }
  if (!(await socioDelComite(apr.id, socioId))) {
    return { ok: false, error: "Ese socio no pertenece a tu comité." };
  }

  const abierta = await db.query.ordenes.findFirst({
    where: and(eq(ordenes.socioId, socioId), eq(ordenes.tipo, tipo), inArray(ordenes.estado, ABIERTAS)),
    columns: { id: true },
  });
  if (abierta) return { ok: false, error: "Ya hay una solicitud igual en curso para ese socio." };

  const esDirectiva = user.rol === "ADMIN";
  await db.insert(ordenes).values({
    aprId: apr.id,
    socioId,
    tipo,
    estado: esDirectiva ? "EN_TRAMITE" : "SOLICITADA",
    origen: esDirectiva ? "COMITE" : "TECNICO",
    detalle: detalle?.trim().slice(0, 300) || null,
    solicitadaPorId: user.id,
  });
  refrescar();
  return { ok: true };
}

/**
 * La directiva resuelve una solicitud. Según el tipo:
 * - Reposición o reparación: aprobar la pasa a terreno (en trámite).
 * - Reclamo: aprobar es responderlo; la respuesta es obligatoria y la ve el socio.
 * - Baja: aprobar da de baja el arranque (queda inactivo).
 * - Reanudación: aprobar vuelve a activar un arranque dado de baja.
 * Rechazar cierra la solicitud; el motivo, si se escribe, también lo ve el socio.
 */
/** Lo que debe un arranque del comité: para avisar antes de darlo de baja. */
export async function deudaDeArranque(socioId: string): Promise<number> {
  const { apr } = await requireApr();
  if (!(await socioDelComite(apr.id, socioId))) return 0;
  return deudaDe(socioId);
}

export async function resolverSolicitud(
  ordenId: string,
  aprobar: boolean,
  respuesta?: string,
  /** La directiva sabe que el arranque tiene deuda y igual lo da de baja. */
  confirmaDeuda = false
): Promise<ResultadoOrden> {
  const { user, apr } = await requireApr();
  if (user.rol !== "ADMIN") return { ok: false, error: "Solo la directiva puede resolver solicitudes." };

  const orden = await db.query.ordenes.findFirst({
    where: and(eq(ordenes.id, ordenId), eq(ordenes.aprId, apr.id), eq(ordenes.estado, "SOLICITADA")),
    columns: { id: true, tipo: true, socioId: true },
  });
  if (!orden) return { ok: false, error: "Esa solicitud ya no está pendiente." };

  const texto = respuesta?.trim().slice(0, 500) || null;
  if (aprobar && orden.tipo === "RECLAMO" && !texto) {
    return { ok: false, error: "Escribe la respuesta al reclamo." };
  }

  // Dar de baja no borra la deuda: si la hay, la directiva tiene que haberlo visto y confirmado.
  if (aprobar && orden.tipo === "BAJA" && !confirmaDeuda && (await deudaDe(orden.socioId)) > 0) {
    return { ok: false, error: "Este arranque tiene deuda. Confirma que quieres darlo de baja igual." };
  }

  const aTerreno = aprobar && (orden.tipo === "REPOSICION" || orden.tipo === "REPARACION");
  const estado = !aprobar ? "RECHAZADA" : aTerreno ? "EN_TRAMITE" : "COMPLETADA";

  await db
    .update(ordenes)
    .set({
      estado,
      notaEjecucion: texto,
      confirmadaPorId: estado === "EN_TRAMITE" ? null : user.id,
      confirmadaAt: estado === "EN_TRAMITE" ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ordenes.id, ordenId));

  // La baja aprobada deja el arranque inactivo; la reanudación aprobada lo vuelve a activar.
  if (aprobar && (orden.tipo === "BAJA" || orden.tipo === "REANUDACION")) {
    await db
      .update(socios)
      .set({ activo: orden.tipo === "REANUDACION", updatedAt: new Date() })
      .where(and(eq(socios.id, orden.socioId), eq(socios.aprId, apr.id)));
    revalidatePath("/panel/socios");
  }

  refrescar();
  return { ok: true };
}

/**
 * Quien fue a terreno (el técnico, o el presidente si lo hace él) sube la foto
 * como evidencia. La orden queda por dar de alta.
 */
export async function registrarEjecucion(
  ordenId: string,
  foto: { mime: string; base64: string },
  nota?: string
): Promise<ResultadoOrden> {
  const { user, apr } = await requireApr();

  if (!/^image\/(jpeg|png|webp)$/.test(foto.mime)) {
    return { ok: false, error: "La evidencia debe ser una foto (JPG, PNG o WebP)." };
  }
  if (!foto.base64 || foto.base64.length > MAX_FOTO_BASE64) {
    return { ok: false, error: "La foto es muy pesada. Saca otra o acércate un poco menos." };
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(foto.base64)) {
    return { ok: false, error: "La foto no es válida." };
  }

  const orden = await db.query.ordenes.findFirst({
    where: and(eq(ordenes.id, ordenId), eq(ordenes.aprId, apr.id)),
    columns: { id: true, estado: true },
  });
  if (!orden) return { ok: false, error: "No encontramos esa orden." };
  if (orden.estado !== "EN_TRAMITE") return { ok: false, error: "Esa orden no está en trámite." };

  await db.insert(evidenciasOrden).values({ ordenId, mime: foto.mime, datos: foto.base64 });
  await db
    .update(ordenes)
    .set({
      estado: "POR_CONFIRMAR",
      ejecutadaPorId: user.id,
      ejecutadaAt: new Date(),
      notaEjecucion: nota?.trim().slice(0, 300) || null,
      updatedAt: new Date(),
    })
    .where(eq(ordenes.id, ordenId));
  refrescar();
  return { ok: true };
}

/** La directiva revisa la evidencia y da de alta la orden: el corte (o la reposición) queda vigente. */
export async function darDeAlta(ordenId: string): Promise<ResultadoOrden> {
  const { user, apr } = await requireApr();
  if (user.rol !== "ADMIN") return { ok: false, error: "Solo la directiva da de alta una orden." };

  const r = await db
    .update(ordenes)
    .set({ estado: "COMPLETADA", confirmadaPorId: user.id, confirmadaAt: new Date(), updatedAt: new Date() })
    .where(and(eq(ordenes.id, ordenId), eq(ordenes.aprId, apr.id), eq(ordenes.estado, "POR_CONFIRMAR")))
    .returning({ id: ordenes.id });
  if (r.length === 0) return { ok: false, error: "Esa orden no está esperando el alta." };
  refrescar();
  return { ok: true };
}

/** La evidencia no sirve (foto borrosa, medidor equivocado): la orden vuelve a trámite para repetirla. */
export async function pedirOtraEvidencia(ordenId: string): Promise<ResultadoOrden> {
  const { user, apr } = await requireApr();
  if (user.rol !== "ADMIN") return { ok: false, error: "Solo la directiva puede pedir otra evidencia." };

  const r = await db
    .update(ordenes)
    .set({ estado: "EN_TRAMITE", updatedAt: new Date() })
    .where(and(eq(ordenes.id, ordenId), eq(ordenes.aprId, apr.id), eq(ordenes.estado, "POR_CONFIRMAR")))
    .returning({ id: ordenes.id });
  if (r.length === 0) return { ok: false, error: "Esa orden no está esperando el alta." };
  refrescar();
  return { ok: true };
}

export async function cancelarOrden(ordenId: string): Promise<ResultadoOrden> {
  const { user, apr } = await requireApr();
  if (user.rol !== "ADMIN") return { ok: false, error: "Solo la directiva puede cancelar una orden." };

  const r = await db
    .update(ordenes)
    .set({ estado: "CANCELADA", updatedAt: new Date() })
    .where(and(eq(ordenes.id, ordenId), eq(ordenes.aprId, apr.id), inArray(ordenes.estado, ABIERTAS)))
    .returning({ id: ordenes.id });
  if (r.length === 0) return { ok: false, error: "Esa orden ya está cerrada." };
  refrescar();
  return { ok: true };
}
