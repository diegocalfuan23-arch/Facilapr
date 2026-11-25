import type { Metadata } from "next";
import { and, asc, eq, gte, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, socios, subsidios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { normalizarPeriodo, tarifasPara } from "@/lib/boletas";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { boletasPorAplicar } from "@/lib/subsidios";
import { sumarMeses } from "@/lib/subsidios-comun";
import { SubsidiosVista } from "@/components/panel/subsidios-vista";

export const metadata: Metadata = {
  title: "Subsidios",
};

export default async function SubsidiosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { apr } = await requireAdmin();
  const { mes } = await searchParams;
  const mesActual = hoyEnChile().slice(0, 7);
  const periodo = normalizarPeriodo(mes ?? "") ?? mesActual;

  const [beneficiarios, padron, promedios, pendientes] = await Promise.all([
    db
      .select({
        id: subsidios.id,
        socioId: socios.id,
        nombre: socios.nombre,
        rut: socios.rut,
        numeroCliente: socios.numeroCliente,
        tipo: subsidios.tipo,
        valor: subsidios.valor,
        topeM3: subsidios.topeM3,
        desde: subsidios.desde,
        hasta: subsidios.hasta,
        decreto: subsidios.decreto,
      })
      .from(subsidios)
      .innerJoin(socios, eq(socios.id, subsidios.socioId))
      .where(eq(socios.aprId, apr.id))
      .orderBy(asc(socios.nombre)),
    db.query.socios.findMany({
      where: and(eq(socios.aprId, apr.id), eq(socios.activo, true)),
      columns: { id: true, nombre: true, rut: true, numeroCliente: true, uso: true },
      orderBy: [asc(socios.nombre)],
    }),
    // El consumo normal de cada socio (últimos 6 meses), para mostrar cuánto bajaría su boleta.
    db
      .select({ socioId: boletas.socioId, m3: sql<number>`round(avg(${boletas.consumoM3}))::int` })
      .from(boletas)
      .innerJoin(socios, eq(socios.id, boletas.socioId))
      .where(and(eq(socios.aprId, apr.id), ne(boletas.estado, "ANULADA"), isNotNull(boletas.consumoM3), gte(boletas.periodo, sumarMeses(mesActual, -6))))
      .groupBy(boletas.socioId),
    boletasPorAplicar(apr.id, periodo),
  ]);

  const ids = beneficiarios.map((b) => b.socioId);
  const [delMes, vencidas] = ids.length
    ? await Promise.all([
        db
          .select({
            socioId: boletas.socioId,
            consumoM3: boletas.consumoM3,
            montoTotal: boletas.montoTotal,
            montoSubsidio: boletas.montoSubsidio,
          })
          .from(boletas)
          .where(and(inArray(boletas.socioId, ids), eq(boletas.periodo, periodo), ne(boletas.estado, "ANULADA"))),
        db
          .select({ socioId: boletas.socioId, n: sql<number>`count(*)::int` })
          .from(boletas)
          .where(
            and(
              inArray(boletas.socioId, ids),
              ne(boletas.estado, "ANULADA"),
              lt(boletas.fechaVencimiento, new Date()),
              sql`${boletas.montoPagado} < ${boletas.montoTotal}`
            )
          )
          .groupBy(boletas.socioId),
      ])
    : [[], []];

  const boletaDe = new Map(delMes.map((b) => [b.socioId, b]));
  const pendienteDe = new Map(pendientes.map((p) => [p.socioId, p]));
  const vencidasDe = new Map(vencidas.map((v) => [v.socioId, v.n]));
  const promedioDe = new Map(promedios.map((p) => [p.socioId, p.m3]));
  const residencial = tarifasPara(apr, "RESIDENCIAL");

  return (
    <SubsidiosVista
      comite={apr.nombre}
      periodo={periodo}
      porAplicar={pendientes.length}
      tarifa={residencial}
      socios={padron.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        rut: s.rut,
        numeroCliente: s.numeroCliente,
        promedio: promedioDe.get(s.id) ?? null,
        ...tarifasPara(apr, s.uso),
      }))}
      beneficiarios={beneficiarios.map((b) => {
        const boleta = boletaDe.get(b.socioId);
        // Con un cambio por aplicar se muestra como quedaría.
        const cambio = pendienteDe.get(b.socioId);
        return {
          ...b,
          boleta: boleta
            ? { consumoM3: boleta.consumoM3, subsidio: cambio?.montoSubsidio ?? boleta.montoSubsidio, paga: cambio?.montoTotal ?? boleta.montoTotal }
            : null,
          vencidas: vencidasDe.get(b.socioId) ?? 0,
        };
      })}
    />
  );
}
