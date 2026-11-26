import { NextRequest } from "next/server";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, socios } from "@/lib/db/schema";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { anioPedido, MESES_CORTOS } from "@/lib/tarifa-comun";

/** Una celda para Excel: entre comillas y sin que un texto se lea como fórmula. */
const celda = (v: string | number) => {
  const t = String(v);
  return `"${(typeof v === "string" && /^[=+\-@]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
};

/**
 * El consumo mensual de cada arranque en un año, para Excel: ?anio=2026. Va por número de arranque, sin nombres ni RUT:
 * para calcular la tarifa no se necesitan.
 */
export async function GET(req: NextRequest) {
  const { apr } = await requireFinanzas();
  if (!puede(apr.plan as Plan, "finanzas")) return new Response("No disponible en tu plan.", { status: 403 });

  const anio = anioPedido(req.nextUrl.searchParams.get("anio"), hoyEnChile());
  const filas = await db
    .select({ id: socios.id, numero: socios.numeroCliente, tipo: socios.tipo, uso: socios.uso, periodo: boletas.periodo, m3: boletas.consumoM3 })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(
      and(
        eq(socios.aprId, apr.id),
        ne(boletas.estado, "ANULADA"),
        sql`${boletas.consumoM3} is not null`,
        sql`${boletas.periodo} >= ${`${anio}-01`}`,
        sql`${boletas.periodo} <= ${`${anio}-12`}`
      )
    )
    .orderBy(asc(socios.tipo), asc(socios.numeroCliente));

  const arranques = new Map<string, { numero: string; tipo: string; uso: string; meses: (number | null)[] }>();
  for (const f of filas) {
    const a = arranques.get(f.id) ?? { numero: f.numero ?? "", tipo: f.tipo, uso: f.uso, meses: Array<number | null>(12).fill(null) };
    a.meses[Number(f.periodo.slice(5, 7)) - 1] = f.m3;
    arranques.set(f.id, a);
  }
  const ordenados = [...arranques.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.numero.localeCompare(b.numero, "es", { numeric: true }));

  const cabecera = ["N°", "Tipo", "Uso", ...MESES_CORTOS.map((m) => `${m} ${anio} (m³)`)];
  const cuerpo = ordenados.map((a) => [a.numero, a.tipo === "USUARIO" ? "Usuario" : "Socio", a.uso === "COMERCIAL" ? "Comercial" : "Residencial", ...a.meses.map((m) => m ?? "")]);
  const csv = [cabecera, ...cuerpo].map((f) => f.map(celda).join(";")).join("\r\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv;charset=utf-8",
      "content-disposition": `attachment; filename="Consumo-por-arranque-${anio}.csv"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
