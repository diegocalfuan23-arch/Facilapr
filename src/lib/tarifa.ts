import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, pagos, produccionAgua, socios } from "@/lib/db/schema";
import { resumenRango } from "@/lib/reportes";
import { listarCategoriasMovimiento } from "@/lib/finanzas";
import { textoCategoria } from "@/lib/finanzas-comun";
import { listarActivos } from "@/lib/activos";
import type { MesTarifa } from "@/lib/tarifa-comun";

/**
 * Lo que el comité ya tiene registrado de un año y que sirve para fijar la tarifa (Reglamento de la Ley 20.998,
 * art. 65): volúmenes producidos y facturados, consumo por arranque, ingresos desglosados y costos.
 */

type Linea = { nombre: string; monto: number };

export type DatosTarifa = {
  anio: number;
  meses: MesTarifa[];
  cuentas: { socios: number; usuarios: number };
  /** Reparto del consumo en el último mes del año que tiene boletas. */
  consumo: { mes: string; arranques: number; m3: number; rangos: { nombre: string; arranques: number }[] } | null;
  /** Lo cobrado en las boletas del año. `ajustes` es lo que no explican los demás conceptos. */
  facturacion: { boletas: number; cargoFijo: number; variable: number; sinDesglose: number; ajustes: number; subsidio: number; total: number };
  ingresos: Linea[];
  egresos: Linea[];
  totalIngresos: number;
  totalEgresos: number;
  /** Bienes comprados en el año; null si el plan no incluye Activos fijos. */
  inversiones: Linea[] | null;
};

const RANGOS: { nombre: string; hasta: number }[] = [
  { nombre: "0 a 5 m³", hasta: 5 },
  { nombre: "6 a 10 m³", hasta: 10 },
  { nombre: "11 a 15 m³", hasta: 15 },
  { nombre: "16 a 20 m³", hasta: 20 },
  { nombre: "21 a 30 m³", hasta: 30 },
  { nombre: "Más de 30 m³", hasta: Infinity },
];

const COBROS: Record<string, string> = { RECONEXION: "Reconexión del servicio", REPARACION: "Reparaciones cobradas a socios" };

const entre = (anio: number) => sql`${boletas.periodo} >= ${`${anio}-01`} and ${boletas.periodo} <= ${`${anio}-12`}`;

export async function datosTarifa(aprId: string, anio: number, hoy: string, opciones: { activos: boolean }): Promise<DatosTarifa> {
  const ultimo = anio === Number(hoy.slice(0, 4)) ? Number(hoy.slice(5, 7)) : 12;
  const mesesDelAnio = Array.from({ length: ultimo }, (_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`);
  const desde = `${anio}-01-01`;
  const hasta = `${anio + 1}-01-01`;
  const delAnio = and(eq(socios.aprId, aprId), ne(boletas.estado, "ANULADA"), entre(anio));
  const conDesglose = sql`${boletas.consumoM3} is not null and ${boletas.cargoFijo} is not null and ${boletas.valorM3} is not null`;
  const diaChile = sql<string>`to_char((${pagos.fecha} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')`;

  const [producidos, facturados, [facturado], cuentas, cobros, resumen, propias, activos] = await Promise.all([
    db
      .select({ mes: produccionAgua.periodo, m3: produccionAgua.m3 })
      .from(produccionAgua)
      .where(and(eq(produccionAgua.aprId, aprId), sql`${produccionAgua.periodo} >= ${`${anio}-01`}`, sql`${produccionAgua.periodo} <= ${`${anio}-12`}`))
      .orderBy(asc(produccionAgua.periodo))
      .catch((e) => {
        console.error("Tarifa: no se pudo leer lo producido:", e.cause?.message ?? e.message);
        return [];
      }),
    db
      .select({
        mes: boletas.periodo,
        m3: sql<number>`coalesce(sum(${boletas.consumoM3}), 0)::int`,
        arranques: sql<number>`count(${boletas.consumoM3})::int`,
      })
      .from(boletas)
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .where(delAnio)
      .groupBy(boletas.periodo),
    db
      .select({
        boletas: sql<number>`count(*)::int`,
        cargoFijo: sql<number>`coalesce(sum(${boletas.cargoFijo}) filter (where ${conDesglose}), 0)::int`,
        variable: sql<number>`coalesce(sum(${boletas.consumoM3} * ${boletas.valorM3}) filter (where ${conDesglose}), 0)::int`,
        sinDesglose: sql<number>`coalesce(sum(${boletas.montoTotal} + ${boletas.montoSubsidio}) filter (where not (${conDesglose})), 0)::int`,
        subsidio: sql<number>`coalesce(sum(${boletas.montoSubsidio}), 0)::int`,
        total: sql<number>`coalesce(sum(${boletas.montoTotal}), 0)::int`,
      })
      .from(boletas)
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .where(delAnio),
    db
      .select({ tipo: socios.tipo, n: sql<number>`count(*)::int` })
      .from(socios)
      .where(and(eq(socios.aprId, aprId), eq(socios.activo, true)))
      .groupBy(socios.tipo),
    // Los cobros que no son boletas, por concepto: Reportes los junta en una sola línea.
    db
      .select({ concepto: pagos.concepto, total: sql<number>`sum(${pagos.monto})::int` })
      .from(pagos)
      .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
      .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
      .where(and(eq(socios.aprId, aprId), ne(pagos.concepto, "BOLETA"), sql`${diaChile} >= ${desde}`, sql`${diaChile} < ${hasta}`))
      .groupBy(pagos.concepto),
    resumenRango(aprId, desde, hasta, mesesDelAnio),
    listarCategoriasMovimiento(aprId),
    opciones.activos ? listarActivos(aprId) : Promise.resolve(null),
  ]);

  const meses: MesTarifa[] = mesesDelAnio.map((mes) => {
    const f = facturados.find((x) => x.mes === mes);
    return { mes, producido: producidos.find((p) => p.mes === mes)?.m3 ?? null, facturado: f?.m3 ?? 0, arranques: f?.arranques ?? 0 };
  });

  const ultimoConConsumo = [...meses].reverse().find((m) => m.arranques > 0);
  let consumo: DatosTarifa["consumo"] = null;
  if (ultimoConConsumo) {
    const filas = await db
      .select({ m3: boletas.consumoM3 })
      .from(boletas)
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .where(and(eq(socios.aprId, aprId), ne(boletas.estado, "ANULADA"), eq(boletas.periodo, ultimoConConsumo.mes), sql`${boletas.consumoM3} is not null`));
    consumo = {
      mes: ultimoConConsumo.mes,
      arranques: filas.length,
      m3: filas.reduce((s, f) => s + (f.m3 ?? 0), 0),
      rangos: RANGOS.map((r, i) => ({
        nombre: r.nombre,
        arranques: filas.filter((f) => (f.m3 ?? 0) <= r.hasta && (i === 0 || (f.m3 ?? 0) > RANGOS[i - 1].hasta)).length,
      })),
    };
  }

  // Ingresos desglosados: ventas de agua, cuotas de incorporación, cobros por servicios y el resto.
  const esIncorporacion = (categoria: string) => categoria === "CUOTA" || /incorporaci/i.test(textoCategoria(categoria, propias));
  const sumaDe = (filas: typeof resumen.ingresos) => filas.reduce((s, c) => s + c.total, 0);
  const incorporacion = sumaDe(resumen.ingresos.filter((c) => esIncorporacion(c.categoria)));
  const ingresos: Linea[] = [
    { nombre: "Venta de agua (pagos de boletas)", monto: sumaDe(resumen.ingresos.filter((c) => c.categoria === "BOLETAS")) },
    { nombre: "Cuotas de incorporación", monto: incorporacion },
    ...cobros.map((c) => ({ nombre: COBROS[c.concepto] ?? "Otros cobros a socios", monto: c.total })),
    ...resumen.ingresos
      .filter((c) => c.categoria !== "BOLETAS" && c.categoria !== "COBROS" && !esIncorporacion(c.categoria))
      .map((c) => ({ nombre: textoCategoria(c.categoria, propias), monto: c.total })),
  ].filter((l) => l.monto !== 0);

  const f = facturado ?? { boletas: 0, cargoFijo: 0, variable: 0, sinDesglose: 0, subsidio: 0, total: 0 };

  return {
    anio,
    meses,
    cuentas: {
      socios: cuentas.find((c) => c.tipo === "SOCIO")?.n ?? 0,
      usuarios: cuentas.find((c) => c.tipo === "USUARIO")?.n ?? 0,
    },
    consumo,
    facturacion: { ...f, ajustes: f.total + f.subsidio - f.cargoFijo - f.variable - f.sinDesglose },
    ingresos,
    egresos: resumen.egresos.map((c) => ({ nombre: textoCategoria(c.categoria, propias), monto: c.total })),
    totalIngresos: resumen.totalIngresos,
    totalEgresos: resumen.totalEgresos,
    inversiones: activos
      ? activos.filter((a) => a.fechaAdquisicion >= desde && a.fechaAdquisicion < hasta).map((a) => ({ nombre: a.nombre, monto: a.costo }))
      : null,
  };
}
