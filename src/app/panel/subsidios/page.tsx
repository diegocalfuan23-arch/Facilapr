import type { Metadata } from "next";
import { and, asc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, socios, subsidios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { normalizarPeriodo } from "@/lib/boletas";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { SubsidiosVista } from "@/components/panel/subsidios-vista";

export const metadata: Metadata = {
  title: "Subsidios",
};

export default async function SubsidiosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { apr } = await requireAdmin();
  const { mes } = await searchParams;
  const periodo = normalizarPeriodo(mes ?? "") ?? hoyEnChile().slice(0, 7);

  const [beneficiarios, padron] = await Promise.all([
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
      columns: { id: true, nombre: true, rut: true, numeroCliente: true, tipo: true },
      orderBy: [asc(socios.nombre)],
    }),
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
  const vencidasDe = new Map(vencidas.map((v) => [v.socioId, v.n]));

  return (
    <SubsidiosVista
      comite={apr.nombre}
      periodo={periodo}
      socios={padron}
      beneficiarios={beneficiarios.map((b) => ({
        ...b,
        boleta: boletaDe.get(b.socioId) ?? null,
        vencidas: vencidasDe.get(b.socioId) ?? 0,
      }))}
    />
  );
}
