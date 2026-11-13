import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, incidentes, labores, movimientos, socios } from "@/lib/db/schema";
import { resumenAnual, type ResumenAnual } from "@/lib/reportes";
import { bolsillosAl, listarCategoriasMovimiento } from "@/lib/finanzas";
import { diaVecino, textoCategoria } from "@/lib/finanzas-comun";
import { listarActivos } from "@/lib/activos";
import { valorActual } from "@/lib/activos-comun";

export type GastoGrande = { fecha: string; concepto: string; categoria: string; monto: number; contraparte: string | null };

export type DatosRendicion = {
  anio: number;
  /** El último día que cubre la rendición: el 31 de diciembre, o hoy si el año aún no termina. */
  hasta: string;
  resumen: ResumenAnual;
  /** Cuánta plata había al empezar y al terminar el período (efectivo + banco). Null si el comité no registró su saldo inicial. */
  saldoInicio: number | null;
  saldoCierre: number | null;
  ingresos: { nombre: string; monto: number }[];
  egresos: { nombre: string; monto: number }[];
  gastosGrandes: GastoGrande[];
  cobranza: { boletas: number; emitido: number; pagado: number; sociosConDeuda: number; deudaTotal: number };
  activos: { n: number; valorTotal: number; comprados: number; costoComprados: number } | null;
  labores: { hechas: number; programadas: number } | null;
  incidentes: { resueltos: number; abiertos: number } | null;
};

/** Junta lo que ya está registrado en la app en una sola mirada para rendir cuentas de un año a la asamblea. */
export async function datosRendicion(aprId: string, anio: number, hoy: string, opciones: { activos: boolean; labores: boolean; incidentes: boolean }): Promise<DatosRendicion> {
  const desde = `${anio}-01-01`;
  const tope = `${anio + 1}-01-01`;
  // Un año en curso se rinde hasta hoy: no tiene sentido prometer cuentas de días que no han pasado.
  const hasta = hoy < `${anio}-12-31` ? hoy : `${anio}-12-31`;
  const finExclusivo = hoy < `${anio}-12-31` ? diaVecino(hoy, 1) : tope;

  const [resumen, propias, inicio, cierre] = await Promise.all([
    resumenAnual(aprId, anio),
    listarCategoriasMovimiento(aprId),
    bolsillosAl(aprId, desde).catch(() => null),
    bolsillosAl(aprId, finExclusivo).catch(() => null),
  ]);

  const grandes = await db
    .select({ fecha: movimientos.fecha, concepto: movimientos.concepto, categoria: movimientos.categoria, monto: movimientos.monto, contraparte: movimientos.contraparte })
    .from(movimientos)
    .where(and(eq(movimientos.aprId, aprId), eq(movimientos.tipo, "EGRESO"), sql`${movimientos.fecha} >= ${desde}`, sql`${movimientos.fecha} < ${tope}`))
    .orderBy(sql`${movimientos.monto} desc`)
    .limit(8)
    .catch(() => []);

  // Cobranza: lo que se emitió en el año y lo que se pagó de eso, y la deuda de hoy (toda, no solo la del año).
  const [emitidas] = await db
    .select({
      n: sql<number>`count(*)::int`,
      emitido: sql<number>`coalesce(sum(${boletas.montoTotal}), 0)::int`,
      pagado: sql<number>`coalesce(sum(least(${boletas.montoPagado}, ${boletas.montoTotal})), 0)::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(socios.aprId, aprId), ne(boletas.estado, "ANULADA"), sql`${boletas.periodo} like ${`${anio}-%`}`));
  const [deuda] = await db
    .select({
      socios: sql<number>`count(distinct ${boletas.socioId})::int`,
      total: sql<number>`coalesce(sum(${boletas.montoTotal} - ${boletas.montoPagado}), 0)::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(socios.aprId, aprId), inArray(boletas.estado, ["PENDIENTE", "VENCIDA"]), sql`${boletas.montoTotal} > ${boletas.montoPagado}`));

  let activos: DatosRendicion["activos"] = null;
  if (opciones.activos) {
    const lista = (await listarActivos(aprId)).filter((a) => a.estado !== "BAJA");
    const comprados = lista.filter((a) => a.fechaAdquisicion >= desde && a.fechaAdquisicion < tope);
    activos = {
      n: lista.length,
      valorTotal: lista.reduce((s, a) => s + valorActual(a, hasta).valorLibro, 0),
      comprados: comprados.length,
      costoComprados: comprados.reduce((s, a) => s + a.costo, 0),
    };
  }

  let laboresDatos: DatosRendicion["labores"] = null;
  if (opciones.labores) {
    const [l] = await db
      .select({
        hechas: sql<number>`count(*) filter (where ${labores.estado} = 'HECHA')::int`,
        programadas: sql<number>`count(*) filter (where ${labores.estado} <> 'HECHA')::int`,
      })
      .from(labores)
      .where(and(eq(labores.aprId, aprId), sql`${labores.fecha} >= ${desde}`, sql`${labores.fecha} < ${tope}`))
      .catch(() => [{ hechas: 0, programadas: 0 }]);
    laboresDatos = l;
  }

  let incidentesDatos: DatosRendicion["incidentes"] = null;
  if (opciones.incidentes) {
    const [i] = await db
      .select({
        resueltos: sql<number>`count(*) filter (where ${incidentes.estado} = 'RESUELTO')::int`,
        abiertos: sql<number>`count(*) filter (where ${incidentes.estado} <> 'RESUELTO')::int`,
      })
      .from(incidentes)
      .where(and(eq(incidentes.aprId, aprId), sql`${incidentes.fecha} >= ${desde}`, sql`${incidentes.fecha} < ${tope}`))
      .catch(() => [{ resueltos: 0, abiertos: 0 }]);
    incidentesDatos = i;
  }

  return {
    anio,
    hasta,
    resumen,
    saldoInicio: inicio ? inicio.efectivo + inicio.banco : null,
    saldoCierre: cierre ? cierre.efectivo + cierre.banco : null,
    ingresos: resumen.ingresos.map((c) => ({ nombre: textoCategoria(c.categoria, propias), monto: c.total })),
    egresos: resumen.egresos.map((c) => ({ nombre: textoCategoria(c.categoria, propias), monto: c.total })),
    gastosGrandes: grandes.map((g) => ({ ...g, categoria: textoCategoria(g.categoria, propias) })),
    cobranza: { boletas: emitidas?.n ?? 0, emitido: emitidas?.emitido ?? 0, pagado: emitidas?.pagado ?? 0, sociosConDeuda: deuda?.socios ?? 0, deudaTotal: deuda?.total ?? 0 },
    activos,
    labores: laboresDatos,
    incidentes: incidentesDatos,
  };
}
