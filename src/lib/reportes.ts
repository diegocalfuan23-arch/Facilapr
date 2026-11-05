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
  const desde = `${anio}-01-01`;
  const hasta = `${anio + 1}-01-01`;

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

  const meses: MesDelAnio[] = Array.from({ length: 12 }, (_, i) => ({
    mes: `${anio}-${String(i + 1).padStart(2, "0")}`,
    ingresos: 0,
    egresos: 0,
  }));
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
    anio,
    meses,
    ingresos: ordenar(ingresos),
    egresos: ordenar(egresos),
    totalIngresos: meses.reduce((s, m) => s + m.ingresos, 0),
    totalEgresos: meses.reduce((s, m) => s + m.egresos, 0),
  };
}
