import { and, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, ordenes, repactaciones, socios } from "@/lib/db/schema";
import { seguimientoRepactacion } from "@/lib/repactaciones";
import type { EstadoOrden, TipoOrden } from "@/lib/ordenes";

export type OrdenFila = {
  id: string;
  tipo: TipoOrden;
  estado: EstadoOrden;
  origen: string;
  detalle: string | null;
  deudaAlOrdenar: number | null;
  socioId: string;
  socioNombre: string;
  socioRut: string | null;
  socioDireccion: string | null;
  socioTelefono: string | null;
  /** ISO. */
  creada: string;
  ejecutada: string | null;
  nota: string | null;
  tieneFoto: boolean;
};

export type MorosoFila = {
  socioId: string;
  nombre: string;
  rut: string | null;
  direccion: string | null;
  telefono: string | null;
  deuda: number;
  /** Días que lleva vencida su boleta más antigua. */
  diasVencida: number;
  /** Si tiene un acuerdo de pago activo y va atrasado: cuánto debería llevar pagado y no lleva. */
  acuerdoAtrasado: number | null;
};

/**
 * Los socios con un acuerdo de pago (repactación) activo, y cuánto llevan
 * atrasado en él; 0 si van al día. Quien cumple su acuerdo no se corta.
 */
export async function acuerdosActivosPorSocio(aprId: string): Promise<Map<string, number>> {
  const filas = await db
    .select({
      socioId: repactaciones.socioId,
      deudaTotal: repactaciones.deudaTotal,
      cuotas: repactaciones.cuotas,
      primerVencimiento: repactaciones.primerVencimiento,
      pagado: sql<number>`(select coalesce(sum(p."monto"), 0)::int from "Pago" p where p."repactacionId" = ${repactaciones.id})`,
    })
    .from(repactaciones)
    .where(and(eq(repactaciones.aprId, aprId), eq(repactaciones.estado, "ACTIVA")));

  return new Map(filas.map((f) => [f.socioId, seguimientoRepactacion(f, f.pagado).atraso]));
}

/** Las órdenes del comité, de la más nueva a la más antigua. */
export async function ordenesDelComite(aprId: string, estados?: EstadoOrden[]): Promise<OrdenFila[]> {
  const filas = await db
    .select({
      id: ordenes.id,
      tipo: ordenes.tipo,
      estado: ordenes.estado,
      origen: ordenes.origen,
      detalle: ordenes.detalle,
      deudaAlOrdenar: ordenes.deudaAlOrdenar,
      socioId: socios.id,
      socioNombre: socios.nombre,
      socioRut: socios.rut,
      socioDireccion: socios.direccion,
      socioTelefono: socios.telefono,
      creada: ordenes.createdAt,
      ejecutada: ordenes.ejecutadaAt,
      nota: ordenes.notaEjecucion,
      tieneFoto: sql<boolean>`exists (select 1 from "EvidenciaOrden" e where e."ordenId" = ${ordenes.id})`,
    })
    .from(ordenes)
    .innerJoin(socios, eq(ordenes.socioId, socios.id))
    .where(
      estados
        ? and(eq(ordenes.aprId, aprId), inArray(ordenes.estado, estados))
        : eq(ordenes.aprId, aprId)
    )
    .orderBy(desc(ordenes.createdAt))
    .limit(300);

  return filas.map((f) => ({
    ...f,
    tipo: f.tipo as TipoOrden,
    estado: f.estado as EstadoOrden,
    creada: f.creada.toISOString(),
    ejecutada: f.ejecutada ? f.ejecutada.toISOString() : null,
  }));
}

/**
 * Quienes están cortados ahora: los arranques cuya última orden completada,
 * entre cortes y reposiciones, fue un corte.
 */
export function cortadosActuales(todas: OrdenFila[]): OrdenFila[] {
  const ultima = new Map<string, OrdenFila>();
  // `todas` viene de la más nueva a la más antigua: la primera de cada socio manda.
  for (const o of todas) {
    if (o.estado !== "COMPLETADA" || (o.tipo !== "CORTE" && o.tipo !== "REPOSICION")) continue;
    if (!ultima.has(o.socioId)) ultima.set(o.socioId, o);
  }
  return [...ultima.values()].filter((o) => o.tipo === "CORTE");
}

/**
 * Los arranques con deuda vencida hace más que los días de gracia del comité,
 * que todavía no tienen un corte en trámite ni están cortados.
 */
export async function morososParaCorte(
  aprId: string,
  diasGracia: number,
  excluirSocioIds: Set<string>,
  /** Socios con acuerdo de pago activo que va atrasado: se listan, avisando que tienen un acuerdo. */
  acuerdosAtrasados: Map<string, number> = new Map()
): Promise<MorosoFila[]> {
  const limite = new Date(Date.now() - diasGracia * 86_400_000);
  const ahora = Date.now();

  const filas = await db
    .select({
      socioId: socios.id,
      nombre: socios.nombre,
      rut: socios.rut,
      direccion: socios.direccion,
      telefono: socios.telefono,
      deuda: sql<number>`sum(${boletas.montoTotal} - ${boletas.montoPagado})::int`,
      masAntigua: sql<Date>`min(${boletas.fechaVencimiento})`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(
      and(
        eq(socios.aprId, aprId),
        eq(socios.activo, true),
        ne(boletas.estado, "ANULADA"),
        lt(boletas.montoPagado, boletas.montoTotal),
        lt(boletas.fechaVencimiento, limite)
      )
    )
    .groupBy(socios.id, socios.nombre, socios.rut, socios.direccion, socios.telefono);

  return filas
    .filter((f) => !excluirSocioIds.has(f.socioId))
    .map((f) => ({
      socioId: f.socioId,
      nombre: f.nombre,
      rut: f.rut,
      direccion: f.direccion,
      telefono: f.telefono,
      deuda: f.deuda,
      diasVencida: Math.max(0, Math.floor((ahora - new Date(f.masAntigua).getTime()) / 86_400_000)),
      acuerdoAtrasado: acuerdosAtrasados.get(f.socioId) ?? null,
    }))
    .sort((a, b) => b.diasVencida - a.diasVencida);
}

/** Las solicitudes y órdenes de un grupo de arranques (las cuentas de un mismo socio), de la más nueva a la más antigua. */
export async function ordenesDeSocios(socioIds: string[]): Promise<(OrdenFila & { respuesta: string | null })[]> {
  if (socioIds.length === 0) return [];
  const filas = await db
    .select({
      id: ordenes.id,
      tipo: ordenes.tipo,
      estado: ordenes.estado,
      origen: ordenes.origen,
      detalle: ordenes.detalle,
      deudaAlOrdenar: ordenes.deudaAlOrdenar,
      socioId: socios.id,
      socioNombre: socios.nombre,
      socioRut: socios.rut,
      socioDireccion: socios.direccion,
      socioTelefono: socios.telefono,
      creada: ordenes.createdAt,
      ejecutada: ordenes.ejecutadaAt,
      nota: ordenes.notaEjecucion,
    })
    .from(ordenes)
    .innerJoin(socios, eq(ordenes.socioId, socios.id))
    .where(inArray(ordenes.socioId, socioIds))
    .orderBy(desc(ordenes.createdAt))
    .limit(60);

  return filas.map((f) => ({
    ...f,
    tipo: f.tipo as TipoOrden,
    estado: f.estado as EstadoOrden,
    creada: f.creada.toISOString(),
    ejecutada: f.ejecutada ? f.ejecutada.toISOString() : null,
    tieneFoto: false,
    // En reclamos y bajas, la nota es la respuesta de la directiva.
    respuesta: f.nota,
  }));
}
