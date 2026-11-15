import { and, asc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, compras, comprasItems, incidentes, labores, movimientos, proveedores, socios } from "@/lib/db/schema";
import { resumenRango, type ResumenAnual } from "@/lib/reportes";
import { bolsillosAl, listarCategoriasMovimiento } from "@/lib/finanzas";
import { diaVecino, textoCategoria } from "@/lib/finanzas-comun";
import { listarActivos } from "@/lib/activos";
import { valorActual } from "@/lib/activos-comun";
import { rangoDe, type PeriodoRendicion } from "@/lib/rendicion-periodo";

export type GastoGrande = { fecha: string; concepto: string; categoria: string; monto: number; contraparte: string | null };

/** Una compra del período: a quién y qué se compró. */
export type CompraRendida = {
  fecha: string;
  numero: number;
  proveedor: string;
  rut: string | null;
  /** «Factura 1234», «Boleta 88»… o vacío si no se anotó. */
  documento: string;
  estado: string;
  total: number;
  items: { descripcion: string; cantidad: number; costoUnitario: number }[];
};

export type ComprasRendidas = {
  /** Cada proveedor con lo que se le compró, de más a menos. */
  porProveedor: { nombre: string; rut: string | null; compras: number; total: number }[];
  detalle: CompraRendida[];
  total: number;
  /** Lo de estas compras que aún no se paga. */
  porPagar: number;
};

export type DatosRendicion = {
  periodo: PeriodoRendicion;
  /** «2.º trimestre 2026», «Año 2026», «Marzo 2026». */
  etiqueta: string;
  /** El primer día del período. */
  desde: string;
  /** El último día que cubre la rendición: el fin del período, o hoy si aún no termina. */
  hasta: string;
  /** El período aún no termina: se rinde hasta hoy. */
  enCurso: boolean;
  resumen: Omit<ResumenAnual, "anio">;
  /** Cuánta plata había al empezar y al terminar el período (efectivo + banco). Null si el comité no registró su saldo inicial. */
  saldoInicio: number | null;
  saldoCierre: number | null;
  ingresos: { nombre: string; monto: number }[];
  egresos: { nombre: string; monto: number }[];
  gastosGrandes: GastoGrande[];
  compras: ComprasRendidas;
  cobranza: { boletas: number; emitido: number; pagado: number; sociosConDeuda: number; deudaTotal: number };
  activos: { n: number; valorTotal: number; comprados: number; costoComprados: number } | null;
  labores: { hechas: number; programadas: number } | null;
  incidentes: { resueltos: number; abiertos: number } | null;
};

/** Las compras del período (sin las anuladas), con a quién y qué se compró. */
async function comprasDelPeriodo(aprId: string, desde: string, tope: string): Promise<ComprasRendidas> {
  const filas = await db
    .select({
      id: compras.id,
      numero: compras.numero,
      fecha: compras.fecha,
      estado: compras.estado,
      documento: compras.documento,
      folio: compras.folio,
      total: compras.total,
      proveedorNombre: compras.proveedorNombre,
      nombreProveedor: proveedores.nombre,
      rutProveedor: proveedores.rut,
    })
    .from(compras)
    .leftJoin(proveedores, eq(compras.proveedorId, proveedores.id))
    .where(and(eq(compras.aprId, aprId), ne(compras.estado, "ANULADA"), gte(compras.fecha, desde), lt(compras.fecha, tope)))
    .orderBy(asc(compras.fecha), asc(compras.numero))
    .catch(() => []);

  const items =
    filas.length > 0
      ? await db
          .select({ compraId: comprasItems.compraId, descripcion: comprasItems.descripcion, cantidad: comprasItems.cantidad, costoUnitario: comprasItems.costoUnitario })
          .from(comprasItems)
          .where(
            inArray(
              comprasItems.compraId,
              filas.map((f) => f.id)
            )
          )
          .catch(() => [])
      : [];
  const itemsDe = new Map<string, CompraRendida["items"]>();
  for (const it of items) itemsDe.set(it.compraId, [...(itemsDe.get(it.compraId) ?? []), { descripcion: it.descripcion, cantidad: it.cantidad, costoUnitario: it.costoUnitario }]);

  const textoDocumento = (documento: string | null, folio: string | null) => {
    const tipo = documento === "FACTURA" ? "Factura" : documento === "BOLETA" ? "Boleta" : documento ? "Documento" : "";
    return [tipo, folio].filter(Boolean).join(" ");
  };

  const detalle: CompraRendida[] = filas.map((f) => ({
    fecha: f.fecha,
    numero: f.numero,
    // Se prefiere el nombre actual del proveedor; si se borró, queda el que se guardó con la compra.
    proveedor: f.nombreProveedor ?? f.proveedorNombre ?? "Sin proveedor",
    rut: f.rutProveedor,
    documento: textoDocumento(f.documento, f.folio),
    estado: f.estado,
    total: f.total,
    items: itemsDe.get(f.id) ?? [],
  }));

  const porNombre = new Map<string, { nombre: string; rut: string | null; compras: number; total: number }>();
  for (const c of detalle) {
    const clave = `${c.rut ?? ""}|${c.proveedor.toLowerCase()}`;
    const actual = porNombre.get(clave) ?? { nombre: c.proveedor, rut: c.rut, compras: 0, total: 0 };
    actual.compras += 1;
    actual.total += c.total;
    porNombre.set(clave, actual);
  }

  return {
    porProveedor: [...porNombre.values()].sort((a, b) => b.total - a.total),
    detalle,
    total: detalle.reduce((s, c) => s + c.total, 0),
    porPagar: detalle.filter((c) => c.estado !== "PAGADA").reduce((s, c) => s + c.total, 0),
  };
}

/** Junta lo que ya está registrado en la app en una sola mirada para rendir cuentas de un período a la asamblea. */
export async function datosRendicion(
  aprId: string,
  periodo: PeriodoRendicion,
  hoy: string,
  opciones: { activos: boolean; labores: boolean; incidentes: boolean }
): Promise<DatosRendicion> {
  const { desde, tope, mesInicio, mesTope, meses, etiqueta } = rangoDe(periodo);
  const ultimoDia = diaVecino(tope, -1);
  // Un período en curso se rinde hasta hoy: no tiene sentido prometer cuentas de días que no han pasado.
  const enCurso = hoy < ultimoDia;
  const hasta = enCurso ? hoy : ultimoDia;
  const finExclusivo = enCurso ? diaVecino(hoy, 1) : tope;
  // Las movimientos y las compras se cuentan hasta el fin del período (o de hoy): lo posterior no existe aún.
  const topeDatos = enCurso ? finExclusivo : tope;

  const [resumen, propias, inicio, cierre, comprasRendidas] = await Promise.all([
    resumenRango(aprId, desde, tope, meses),
    listarCategoriasMovimiento(aprId),
    bolsillosAl(aprId, desde).catch(() => null),
    bolsillosAl(aprId, finExclusivo).catch(() => null),
    comprasDelPeriodo(aprId, desde, topeDatos),
  ]);

  const grandes = await db
    .select({ fecha: movimientos.fecha, concepto: movimientos.concepto, categoria: movimientos.categoria, monto: movimientos.monto, contraparte: movimientos.contraparte })
    .from(movimientos)
    .where(and(eq(movimientos.aprId, aprId), eq(movimientos.tipo, "EGRESO"), sql`${movimientos.fecha} >= ${desde}`, sql`${movimientos.fecha} < ${tope}`))
    .orderBy(sql`${movimientos.monto} desc`)
    .limit(8)
    .catch(() => []);

  // Cobranza: lo que se emitió en el período y lo que se pagó de eso, y la deuda de hoy (toda, no solo la del período).
  const [emitidas] = await db
    .select({
      n: sql<number>`count(*)::int`,
      emitido: sql<number>`coalesce(sum(${boletas.montoTotal}), 0)::int`,
      pagado: sql<number>`coalesce(sum(least(${boletas.montoPagado}, ${boletas.montoTotal})), 0)::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(socios.aprId, aprId), ne(boletas.estado, "ANULADA"), sql`${boletas.periodo} >= ${mesInicio}`, sql`${boletas.periodo} < ${mesTope}`));
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
    periodo,
    etiqueta,
    desde,
    hasta,
    enCurso,
    resumen,
    saldoInicio: inicio ? inicio.efectivo + inicio.banco : null,
    saldoCierre: cierre ? cierre.efectivo + cierre.banco : null,
    ingresos: resumen.ingresos.map((c) => ({ nombre: textoCategoria(c.categoria, propias), monto: c.total })),
    egresos: resumen.egresos.map((c) => ({ nombre: textoCategoria(c.categoria, propias), monto: c.total })),
    gastosGrandes: grandes.map((g) => ({ ...g, categoria: textoCategoria(g.categoria, propias) })),
    compras: comprasRendidas,
    cobranza: { boletas: emitidas?.n ?? 0, emitido: emitidas?.emitido ?? 0, pagado: emitidas?.pagado ?? 0, sociosConDeuda: deuda?.socios ?? 0, deudaTotal: deuda?.total ?? 0 },
    activos,
    labores: laboresDatos,
    incidentes: incidentesDatos,
  };
}
