import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, movimientos, pagos, socios } from "@/lib/db/schema";

/** Lo que entró y salió en un mes. */
export type MesDelAnio = { mes: string; ingresos: number; egresos: number };

/** Cuánto sumó una categoría en el año (el código tal cual se guarda: «p:<id>», una antigua, BOLETAS…). */
export type CategoriaDelAnio = { categoria: string; total: number };

export type ResumenAnual = {
  anio: number;
  /** Siempre los 12 meses, aunque no tengan movimientos. */
  meses: MesDelAnio[];
  ingresos: CategoriaDelAnio[];
  egresos: CategoriaDelAnio[];
  totalIngresos: number;
  totalEgresos: number;
};

/**
 * Lo que entró y salió en un año, mes a mes y por categoría. Los pagos de socios salen de la
 * tabla Pago (con el mes en hora de Chile, para que un pago de las 23:30 no caiga en otro mes) y
 * lo demás de Movimiento; el saldo inicial y los cierres de caja no cuentan.
 */
export async function resumenAnual(aprId: string, anio: number): Promise<ResumenAnual> {
  const meses = Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`);
  const r = await resumenRango(aprId, `${anio}-01-01`, `${anio + 1}-01-01`, meses);
  return { anio, ...r };
}

/**
 * Lo mismo para cualquier rango de meses completos (un trimestre, un semestre…): `desde` es el primer día y `hasta` el
 * primer día que ya no entra. `meses` son los AAAA-MM que abarca, aunque no tengan movimientos.
 */
export async function resumenRango(aprId: string, desde: string, hasta: string, mesesDelRango: string[]): Promise<Omit<ResumenAnual, "anio">> {

  const mesDeMovimiento = sql<string>`to_char(${movimientos.fecha}, 'YYYY-MM')`;
  const deMovimientos = await db
    .select({
      mes: mesDeMovimiento,
      tipo: movimientos.tipo,
      categoria: movimientos.categoria,
      total: sql<number>`sum(${movimientos.monto})::int`,
    })
    .from(movimientos)
    .where(
      and(
        eq(movimientos.aprId, aprId),
        // Solo ingresos y egresos: el saldo inicial y los cierres de caja son marcas, no plata que se movió.
        inArray(movimientos.tipo, ["INGRESO", "EGRESO"]),
        sql`${movimientos.fecha} >= ${desde}`,
        sql`${movimientos.fecha} < ${hasta}`
      )
    )
    .groupBy(mesDeMovimiento, movimientos.tipo, movimientos.categoria)
    .catch((e) => {
      console.error("Reportes: no se pudieron leer los movimientos:", e);
      return [];
    });

  const diaChile = sql<string>`to_char((${pagos.fecha} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')`;
  const mesChile = sql<string>`to_char((${pagos.fecha} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago', 'YYYY-MM')`;
  const deSocios = await db
    .select({ mes: mesChile, concepto: pagos.concepto, total: sql<number>`sum(${pagos.monto})::int` })
    .from(pagos)
    .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
    .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
    .where(and(eq(socios.aprId, aprId), sql`${diaChile} >= ${desde}`, sql`${diaChile} < ${hasta}`))
    .groupBy(mesChile, pagos.concepto);

  const meses: MesDelAnio[] = mesesDelRango.map((mes) => ({ mes, ingresos: 0, egresos: 0 }));
  const porMes = new Map(meses.map((m) => [m.mes, m]));
  const ingresos = new Map<string, number>();
  const egresos = new Map<string, number>();
  const sumar = (mapa: Map<string, number>, clave: string, valor: number) => mapa.set(clave, (mapa.get(clave) ?? 0) + valor);

  for (const f of deMovimientos) {
    const m = porMes.get(f.mes);
    if (!m) continue;
    if (f.tipo === "INGRESO") {
      m.ingresos += f.total;
      sumar(ingresos, f.categoria, f.total);
    } else {
      m.egresos += f.total;
      sumar(egresos, f.categoria, f.total);
    }
  }
  for (const f of deSocios) {
    const m = porMes.get(f.mes);
    if (!m) continue;
    m.ingresos += f.total;
    sumar(ingresos, f.concepto === "BOLETA" ? "BOLETAS" : "COBROS", f.total);
  }

  const ordenar = (mapa: Map<string, number>): CategoriaDelAnio[] =>
    [...mapa.entries()].map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total);

  return {
    meses,
    ingresos: ordenar(ingresos),
    egresos: ordenar(egresos),
    totalIngresos: meses.reduce((s, m) => s + m.ingresos, 0),
    totalEgresos: meses.reduce((s, m) => s + m.egresos, 0),
  };
}

/**
 * Lo que entró y salió cada día de un rango (AAAA-MM-DD → ingresos y egresos), con las mismas fuentes que el resumen: los
 * pagos de socios (día en hora de Chile) y los movimientos de Caja (sin el saldo inicial ni los cierres).
 */
export async function ingresosEgresosPorDia(aprId: string, desde: string, hasta: string): Promise<Map<string, { ing: number; egr: number }>> {
  const dia = sql<string>`to_char(${movimientos.fecha}, 'YYYY-MM-DD')`;
  const deMovimientos = await db
    .select({ dia, tipo: movimientos.tipo, total: sql<number>`sum(${movimientos.monto})::int` })
    .from(movimientos)
    .where(and(eq(movimientos.aprId, aprId), inArray(movimientos.tipo, ["INGRESO", "EGRESO"]), sql`${movimientos.fecha} >= ${desde}`, sql`${movimientos.fecha} < ${hasta}`))
    .groupBy(dia, movimientos.tipo)
    .catch(() => []);

  const diaChile = sql<string>`to_char((${pagos.fecha} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')`;
  const deSocios = await db
    .select({ dia: diaChile, total: sql<number>`sum(${pagos.monto})::int` })
    .from(pagos)
    .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
    .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
    .where(and(eq(socios.aprId, aprId), sql`${diaChile} >= ${desde}`, sql`${diaChile} < ${hasta}`))
    .groupBy(diaChile);

  const porDia = new Map<string, { ing: number; egr: number }>();
  const celda = (d: string) => porDia.get(d) ?? porDia.set(d, { ing: 0, egr: 0 }).get(d)!;
  for (const f of deMovimientos) {
    if (f.tipo === "INGRESO") celda(f.dia).ing += f.total;
    else celda(f.dia).egr += f.total;
  }
  for (const f of deSocios) celda(f.dia).ing += f.total;
  return porDia;
}
