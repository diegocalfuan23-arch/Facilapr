import type { Metadata } from "next";
import Link from "next/link";
import { and, countDistinct, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { AlertTriangle, ArrowRight, Banknote, FlaskConical, ReceiptText, ShieldCheck, TriangleAlert, UserCheck, Users, Wallet, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { boletas, socios, solicitudesAcceso } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { libroDelMes, mesValido, mesVecino, resumenPeriodo } from "@/lib/finanzas";
import { ResumenBarras } from "@/components/panel/resumen-barras";
import { formatearPeriodo } from "@/lib/boletas";
import { DEMO, type DatosDashboard } from "@/lib/demo-dashboard";
import { iniciales, tiempoRelativo } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Resumen",
};

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const fechaCorta = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
});

type Rango = "semana" | "mes" | "año";

const RANGOS: { id: Rango; label: string; dias: number }[] = [
  { id: "semana", label: "Semanal", dias: 7 },
  { id: "mes", label: "Mensual", dias: 30 },
  { id: "año", label: "Anual", dias: 365 },
];

/** Los últimos N períodos en formato "AAAA-MM", del más viejo al más nuevo. */
function ultimosPeriodos(n: number): string[] {
  const hoy = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; demo?: string }>;
}) {
  // requireAdmin lleva al tesorero a su Caja.
  const { apr } = await requireAdmin();
  const { rango: rangoParam, demo: demoParam } = await searchParams;

  const demo = demoParam === "1";
  // Una sola lectura del reloj para toda la página: si cada fila leyera la
  // suya, dos boletas del mismo vencimiento podrían mostrar estados distintos.
  const ahora = new Date();
  const rango = RANGOS.find((r) => r.id === rangoParam) ?? RANGOS[1];
  const desde = new Date(ahora.getTime() - rango.dias * 86_400_000);
  // El período anterior de igual largo, para calcular la variación.
  const desdeAnterior = new Date(ahora.getTime() - rango.dias * 2 * 86_400_000);

  const noAnulada = sql`${boletas.estado} <> 'ANULADA'`;
  const impaga = sql`${boletas.montoPagado} < ${boletas.montoTotal}`;
  const vencida = sql`${boletas.fechaVencimiento} < now()`;

  const [padron] = await db
    .select({
      total: sql<number>`count(*)::int`,
      activos: sql<number>`count(*) filter (where ${socios.activo})::int`,
      nuevos: sql<number>`count(*) filter (where ${socios.createdAt} >= ${desde})::int`,
    })
    .from(socios)
    .where(eq(socios.aprId, apr.id));

  // Un moroso es un SOCIO con boletas impagas ya vencidas, no una boleta:
  // quien debe tres meses es un moroso, no tres.
  const [morosidad] = await db
    .select({
      socios: countDistinct(boletas.socioId),
      monto: sql<number>`coalesce(sum(${boletas.montoTotal} - ${boletas.montoPagado}), 0)::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(socios.aprId, apr.id), noAnulada, impaga, vencida));

  const [facturacion] = await db
    .select({
      emitidas: sql<number>`count(*)::int`,
      recaudado: sql<number>`coalesce(sum(${boletas.montoPagado}), 0)::int`,
      facturado: sql<number>`coalesce(sum(${boletas.montoTotal}), 0)::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(socios.aprId, apr.id), noAnulada));

  // Recaudación del rango actual y del anterior, para la variación.
  const [recienteActual] = await db
    .select({
      recaudado: sql<number>`coalesce(sum(${boletas.montoPagado}), 0)::int`,
      emitidas: sql<number>`count(*)::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(
      and(eq(socios.aprId, apr.id), noAnulada, gte(boletas.fechaEmision, desde))
    );

  const [recienteAnterior] = await db
    .select({
      recaudado: sql<number>`coalesce(sum(${boletas.montoPagado}), 0)::int`,
      emitidas: sql<number>`count(*)::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(
      and(
        eq(socios.aprId, apr.id),
        noAnulada,
        gte(boletas.fechaEmision, desdeAnterior),
        sql`${boletas.fechaEmision} < ${desde}`
      )
    );

  // Lo que está por cobrar: las boletas con saldo, cuántas ya vencieron y cuándo vence la próxima.
  const [porCobrar] = await db
    .select({
      n: sql<number>`count(*)::int`,
      monto: sql<number>`coalesce(sum(${boletas.montoTotal} - ${boletas.montoPagado}), 0)::int`,
      vencidas: sql<number>`count(*) filter (where ${boletas.fechaVencimiento} < now())::int`,
      proxima: sql<string | null>`min(${boletas.fechaVencimiento}) filter (where ${boletas.fechaVencimiento} >= now())`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(socios.aprId, apr.id), noAnulada, impaga));

  // Con Finanzas (Estándar y Grande), la Caja del mes reemplaza dos tarjetas de cobranza.
  const conCaja = !demo && puede(apr.plan as Plan, "finanzas");
  const caja = conCaja
    ? await (async () => {
        const mes = mesValido(undefined);
        const desdeMes = `${mes}-01`;
        const hastaMes = `${mesVecino(mes, 1)}-01`;
        return resumenPeriodo(apr.id, desdeMes, hastaMes, await libroDelMes(apr.id, mes)).catch(() => null);
      })()
    : null;

  /** Sin base con la que comparar, no inventamos un porcentaje. */
  const variacion = (actual: number, anterior: number) =>
    anterior === 0 ? null : ((actual - anterior) / anterior) * 100;

  // Estado de las boletas por período, para el gráfico apilado.
  const periodos = ultimosPeriodos(8);
  const porPeriodo = await db
    .select({
      periodo: boletas.periodo,
      pagadas: sql<number>`count(*) filter (where ${boletas.montoPagado} >= ${boletas.montoTotal})::int`,
      pendientes: sql<number>`count(*) filter (where ${boletas.montoPagado} < ${boletas.montoTotal} and ${boletas.fechaVencimiento} >= now())::int`,
      vencidas: sql<number>`count(*) filter (where ${boletas.montoPagado} < ${boletas.montoTotal} and ${boletas.fechaVencimiento} < now())::int`,
      consumo: sql<number>`coalesce(sum(${boletas.consumoM3}), 0)::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(socios.aprId, apr.id), noAnulada))
    .groupBy(boletas.periodo);

  // Consumo de los arranques residenciales y comerciales, por período, según las boletas.
  const usoPorPeriodoBoletas = await db
    .select({
      periodo: boletas.periodo,
      residencial: sql<number>`coalesce(sum(${boletas.consumoM3}) filter (where ${socios.uso} <> 'COMERCIAL'), 0)::int`,
      comercial: sql<number>`coalesce(sum(${boletas.consumoM3}) filter (where ${socios.uso} = 'COMERCIAL'), 0)::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(socios.aprId, apr.id), noAnulada, inArray(boletas.periodo, periodos)))
    .groupBy(boletas.periodo);

  // Consumo real: lo que subió cada medidor entre dos lecturas aprobadas, en el
  // período de la lectura nueva (igual que al emitir una boleta). La primera
  // lectura de un arranque, la de partida, no aporta: no hay con qué restarla.
  // Así el gráfico se llena apenas se aprueban las lecturas, sin esperar a las boletas.
  const consumoLecturas = await db.execute(sql`
    select periodo,
           coalesce(sum(m3), 0)::int as total,
           coalesce(sum(m3) filter (where comercial), 0)::int as comercial
    from (
      select l."periodo" as periodo,
             l."valor" - lag(l."valor") over (partition by l."socioId" order by l."createdAt") as m3,
             (s."uso" = 'COMERCIAL') as comercial
      from "Lectura" l
      join "Socio" s on s."id" = l."socioId"
      where s."aprId" = ${apr.id} and l."estado" = 'APROBADA'
    ) t
    where m3 > 0
    group by periodo
  `);
  const deLecturas = new Map(
    (consumoLecturas.rows as { periodo: string; total: number; comercial: number }[]).map((r) => [r.periodo, r])
  );

  const deP = new Map(porPeriodo.map((p) => [p.periodo, p]));
  const usoDeBoletas = new Map(usoPorPeriodoBoletas.map((u) => [u.periodo, u]));

  // Por período manda la lectura; si ese mes solo hay boletas (cargadas a mano), se usan ellas.
  const usoConsumo = { residencial: 0, comercial: 0 };
  for (const p of periodos) {
    const l = deLecturas.get(p);
    if (l && l.total > 0) {
      usoConsumo.comercial += l.comercial;
      usoConsumo.residencial += l.total - l.comercial;
    } else {
      const b = usoDeBoletas.get(p);
      usoConsumo.residencial += b?.residencial ?? 0;
      usoConsumo.comercial += b?.comercial ?? 0;
    }
  }

  /** Etiqueta corta del período: "Jul" a partir de "2026-07". */
  const etiqueta = (p: string) => formatearPeriodo(p).slice(0, 3);

  const serie = (campo: "pagadas" | "pendientes" | "vencidas") =>
    periodos.map((p) => ({
      periodo: etiqueta(p),
      valor: deP.get(p)?.[campo] ?? 0,
    }));

  const serieConsumo = periodos.map((p) => {
    const delaLectura = deLecturas.get(p)?.total ?? 0;
    return {
      periodo: etiqueta(p),
      valor: delaLectura > 0 ? delaLectura : (deP.get(p)?.consumo ?? 0),
    };
  });

  // Recharts espera una fila por columna con todas las series como campos.
  const datosCobranza = periodos.map((p) => ({
    periodo: etiqueta(p),
    pagadas: deP.get(p)?.pagadas ?? 0,
    pendientes: deP.get(p)?.pendientes ?? 0,
    vencidas: deP.get(p)?.vencidas ?? 0,
  }));

  // Recaudación acumulada por período, para el sparkline de tendencia.
  const recaudadoPorPeriodo = await db
    .select({
      periodo: boletas.periodo,
      monto: sql<number>`coalesce(sum(${boletas.montoPagado}), 0)::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(socios.aprId, apr.id), noAnulada))
    .groupBy(boletas.periodo);

  const deR = new Map(recaudadoPorPeriodo.map((p) => [p.periodo, p.monto]));
  const serieRecaudado = periodos.map((p) => ({
    periodo: etiqueta(p),
    valor: deR.get(p) ?? 0,
  }));

  /**
   * El período que más recaudó y quiénes pagaron en él. La lista acompaña al
   * gráfico de barras: cuál fue el mejor mes y gracias a quiénes.
   */
  const mejorPeriodo =
    recaudadoPorPeriodo.length > 0
      ? recaudadoPorPeriodo.reduce((a, b) => (b.monto > a.monto ? b : a))
      : null;

  const pagadoresDelMejor = mejorPeriodo
    ? await db
        .select({
          id: socios.id,
          nombre: socios.nombre,
          pagado: sql<number>`sum(${boletas.montoPagado})::int`,
          boletas: sql<number>`count(*)::int`,
        })
        .from(boletas)
        .innerJoin(socios, eq(boletas.socioId, socios.id))
        .where(
          and(
            eq(socios.aprId, apr.id),
            noAnulada,
            eq(boletas.periodo, mejorPeriodo.periodo),
            sql`${boletas.montoPagado} > 0`
          )
        )
        .groupBy(socios.id, socios.nombre)
        .orderBy(desc(sql`sum(${boletas.montoPagado})`))
        .limit(5)
    : [];

  const ultimasBoletas = await db
    .select({
      id: boletas.id,
      socioNombre: socios.nombre,
      periodo: boletas.periodo,
      montoTotal: boletas.montoTotal,
      montoPagado: boletas.montoPagado,
      fechaVencimiento: boletas.fechaVencimiento,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(eq(socios.aprId, apr.id))
    .orderBy(desc(boletas.createdAt))
    .limit(5);

  const ultimosSocios = await db.query.socios.findMany({
    where: eq(socios.aprId, apr.id),
    orderBy: [desc(socios.createdAt)],
    limit: 5,
    columns: { id: true, nombre: true, createdAt: true, activo: true },
  });

  const solicitudesPendientesRaw = await db
    .select({
      id: solicitudesAcceso.id,
      nombre: socios.nombre,
      rut: socios.rut,
      createdAt: solicitudesAcceso.createdAt,
    })
    .from(solicitudesAcceso)
    .innerJoin(socios, eq(solicitudesAcceso.socioId, socios.id))
    .where(
      and(eq(socios.aprId, apr.id), eq(solicitudesAcceso.estado, "PENDIENTE"))
    )
    .orderBy(desc(solicitudesAcceso.createdAt))
    .limit(5);

  // A partir de aquí se usa `d`, que es lo real o la muestra según ?demo=1.
  // Nunca por defecto: un panel con cifras inventadas y sin avisarlo haría
  // que un dirigente las tomara por suyas.
  const d: DatosDashboard = demo
    ? DEMO
    : {
        padron,
        morosidad,
        facturacion,
        variacionRecaudado: variacion(
          recienteActual.recaudado,
          recienteAnterior.recaudado
        ),
        variacionEmitidas: variacion(
          recienteActual.emitidas,
          recienteAnterior.emitidas
        ),
        cobranza: datosCobranza,
        consumo: serieConsumo,
        consumoPorUso: usoConsumo,
        recaudado: serieRecaudado,
        vencidas: serie("vencidas"),
        boletas: ultimasBoletas,
        socios: ultimosSocios,
        mejorPeriodo,
        pagadores: pagadoresDelMejor,
        solicitudesPendientes: solicitudesPendientesRaw.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          rut: s.rut,
          hace: tiempoRelativo(s.createdAt),
        })),
      };

  const cobertura =
    d.facturacion.facturado > 0
      ? Math.round((d.facturacion.recaudado / d.facturacion.facturado) * 100)
      : 0;

  const tasaMorosidad =
    d.padron.total > 0 ? (d.morosidad.socios / d.padron.total) * 100 : 0;

  const kpis: { icono: LucideIcon; tono: string; etiqueta: string; valor: string; detalle: string; href: string }[] = [
    {
      icono: Users,
      tono: "bg-[#ECE8FD] text-[#3A0CE3]",
      etiqueta: "Socios",
      valor: String(d.padron.total),
      detalle: `${d.padron.activos} ${d.padron.activos === 1 ? "activo" : "activos"}`,
      href: "/panel/socios",
    },
    {
      icono: d.morosidad.socios === 0 ? ShieldCheck : AlertTriangle,
      tono: d.morosidad.socios === 0 ? "bg-[#DFF4EB] text-[#0A7A52]" : "bg-[#FDECEC] text-[#A32020]",
      etiqueta: "Morosos",
      valor: String(d.morosidad.socios),
      detalle: d.morosidad.socios === 0 ? "Sin boletas vencidas" : `${tasaMorosidad.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} % de los socios · ${clp.format(d.morosidad.monto)} por cobrar`,
      href: "/panel/boletas",
    },
    {
      icono: Wallet,
      tono: "bg-[#E2F2FC] text-[#0A6EA8]",
      etiqueta: "Recaudado",
      valor: clp.format(d.facturacion.recaudado),
      detalle: d.facturacion.facturado === 0 ? "Aún no emites boletas" : `${cobertura}% de lo facturado`,
      href: "/panel/boletas",
    },
    caja
      ? {
          icono: Banknote,
          tono: "bg-[#FFEEDC] text-[#B05300]",
          etiqueta: "Disponible en caja",
          valor: caja.disponible === null ? "—" : clp.format(caja.disponible),
          detalle: caja.disponible === null ? "Falta el saldo inicial" : `${clp.format(caja.egresos)} de egresos este mes`,
          href: "/panel/caja",
        }
      : {
          icono: ReceiptText,
          tono: "bg-[#FFEEDC] text-[#B05300]",
          etiqueta: "Facturas emitidas",
          valor: String(d.facturacion.emitidas),
          detalle: d.facturacion.emitidas === 0 ? "Sin boletas emitidas" : `${clp.format(d.facturacion.facturado)} facturados`,
          href: "/panel/boletas",
        },
  ];

  // El aviso de arriba: lo que falta por cobrar. En la demostración sale de las boletas de muestra.
  const aviso = demo
    ? (() => {
        const sin = d.boletas.filter((b) => b.montoPagado < b.montoTotal);
        const futuras = sin.filter((b) => b.fechaVencimiento >= ahora).map((b) => b.fechaVencimiento.getTime());
        return {
          n: sin.length,
          monto: sin.reduce((t, b) => t + (b.montoTotal - b.montoPagado), 0),
          vencidas: sin.filter((b) => b.fechaVencimiento < ahora).length,
          proxima: futuras.length ? new Date(Math.min(...futuras)) : null,
        };
      })()
    : { n: porCobrar.n, monto: porCobrar.monto, vencidas: porCobrar.vencidas, proxima: porCobrar.proxima ? new Date(porCobrar.proxima) : null };

  const resultado = caja ? caja.ingresos - caja.egresos : 0;
  const maxFlujo = caja ? Math.max(caja.ingresos, caja.egresos, 1) : 1;
  const usoTotal = d.consumoPorUso.residencial + d.consumoPorUso.comercial;
  const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
  const GRIS = "text-[#5B5970]";
  const tarjeta = cn("rounded-[20px] bg-card p-5", SOMBRA);

  return (
    <div className="flex flex-col gap-4">
      {demo && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-tertiary/40 bg-tertiary/10 px-4 py-3">
          <FlaskConical className="size-4 shrink-0 text-tertiary-texto" />
          <p className="flex-1 text-[0.88rem] leading-relaxed">
            <strong>Vista de demostración.</strong> Ninguna de estas cifras es de tu comité: son datos inventados para ver cómo se verá el panel.
          </p>
          <Link href="/panel" className="text-[0.85rem] font-medium text-primary hover:underline">
            Salir de la demo
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[32px] leading-tight font-bold tracking-tight">Resumen</h1>
          <p className={cn("mt-1 text-[15px]", GRIS)}>Cómo va tu comité este mes.</p>
        </div>
        <div role="group" aria-label="Período" className="grid w-full grid-cols-3 gap-1 rounded-full bg-white/80 p-1 sm:w-auto">
          {RANGOS.map((r) => (
            <Link
              key={r.id}
              href={`/panel?rango=${r.id}${demo ? "&demo=1" : ""}`}
              aria-current={r.id === rango.id ? "true" : undefined}
              className={cn(
                "flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                r.id === rango.id ? "bg-primary text-white" : "text-[#3F3C55] hover:bg-accent"
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {aviso.n > 0 && (
        <Link href="/panel/boletas" className="flex items-center gap-3 rounded-2xl bg-[#FFF3E5] px-4 py-3 text-[15px] transition-colors hover:bg-[#FFEEDC]">
          <TriangleAlert className="size-5 shrink-0 text-[#B05300]" aria-hidden />
          <span className="min-w-0 flex-1">
            <strong className="font-bold">{aviso.n} {aviso.n === 1 ? "boleta pendiente" : "boletas pendientes"}</strong> por {clp.format(aviso.monto)}
            {aviso.vencidas > 0
              ? `, ${aviso.vencidas} ya ${aviso.vencidas === 1 ? "vencida" : "vencidas"}.`
              : aviso.proxima
                ? `, vence${aviso.n === 1 ? "" : "n"} el ${fechaCorta.format(aviso.proxima)}.`
                : "."}
          </span>
          <ArrowRight className="size-4 shrink-0 text-[#8F4400]" aria-hidden />
        </Link>
      )}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {kpis.map((kpi) => {
          const Icono = kpi.icono;
          return (
            <Link key={kpi.etiqueta} href={kpi.href} className={cn("min-w-0 rounded-[20px] bg-card p-4 transition-shadow hover:shadow-[0_14px_34px_rgba(58,12,227,0.14)] lg:p-5", SOMBRA)}>
              <div className="flex items-center justify-between gap-3">
                <p className={cn("text-[13px] font-semibold", GRIS)}>{kpi.etiqueta}</p>
                <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", kpi.tono)}>
                  <Icono className="size-[18px]" />
                </span>
              </div>
              <p className="mt-1 text-[26px] leading-tight font-bold tracking-tight tabular-nums lg:text-[32px]">{kpi.valor}</p>
              <p className={cn("mt-1 text-[13px]", GRIS)}>{kpi.detalle}</p>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className={cn(tarjeta, "lg:col-span-7")}>
          <h2 className="text-lg font-bold">Recaudación por mes</h2>
          <p className={cn("mb-4 text-sm", GRIS)}>Cuánto se cobró en cada período</p>
          <ResumenBarras datos={d.recaudado} formato="clp" nombre="Recaudación por mes" />
        </section>

        {caja ? (
          <section className={cn(tarjeta, "flex flex-col lg:col-span-5")}>
            <h2 className="text-lg font-bold">Resultado del mes</h2>
            <p className={cn("text-sm", GRIS)}>Lo que entró menos lo que salió</p>
            <p className={cn("mt-3 text-[40px] leading-none font-bold tracking-tight tabular-nums", resultado < 0 ? "text-[#A32020]" : "text-[#066A47]")}>
              {resultado > 0 ? "+" : ""}
              {clp.format(resultado)}
            </p>
            <div className="mt-5 flex flex-col gap-3">
              {(
                [
                  ["Ingresos", caja.ingresos, "bg-[#0A9B68]"],
                  ["Egresos", caja.egresos, "bg-[#E0524F]"],
                ] as const
              ).map(([n, v, c]) => (
                <div key={n}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className={GRIS}>{n}</span>
                    <span className="font-semibold tabular-nums">{clp.format(v)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#ECE9F5]">
                    <div className={cn("h-full rounded-full", c)} style={{ width: `${(v / maxFlujo) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <Link href="/panel/caja" className="mt-auto inline-flex min-h-11 items-center gap-2 pt-3 text-sm font-semibold text-primary hover:underline">
              Ver Caja <ArrowRight className="size-4" aria-hidden />
            </Link>
          </section>
        ) : (
          // Sin Finanzas no hay Caja: aquí va cuánto de lo facturado ya se cobró.
          <section className={cn(tarjeta, "flex flex-col lg:col-span-5")}>
            <h2 className="text-lg font-bold">Cobertura de cobranza</h2>
            <p className={cn("text-sm", GRIS)}>Cuánto de lo facturado se ha cobrado</p>
            <p className="mt-3 text-[40px] leading-none font-bold tracking-tight text-[#066A47] tabular-nums">{cobertura}%</p>
            <div className="mt-5">
              <div className="flex justify-between gap-3 text-sm">
                <span className={GRIS}>Cobrado</span>
                <span className="font-semibold tabular-nums">
                  {clp.format(d.facturacion.recaudado)} de {clp.format(d.facturacion.facturado)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#ECE9F5]">
                <div className="h-full rounded-full bg-[#0A9B68]" style={{ width: `${Math.min(cobertura, 100)}%` }} />
              </div>
            </div>
            <Link href="/panel/boletas" className="mt-auto inline-flex min-h-11 items-center gap-2 pt-3 text-sm font-semibold text-primary hover:underline">
              Ver boletas <ArrowRight className="size-4" aria-hidden />
            </Link>
          </section>
        )}

        <section className={cn(tarjeta, "lg:col-span-7")}>
          <h2 className="text-lg font-bold">Consumo de agua</h2>
          <p className={cn("mb-4 text-sm", GRIS)}>Metros cúbicos por período</p>
          <ResumenBarras datos={d.consumo} formato="m3" nombre="Consumo de agua" />
          {usoTotal > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[#F0EEF6] pt-3">
              {[
                { texto: "Residencial", valor: d.consumoPorUso.residencial },
                { texto: "Comercial", valor: d.consumoPorUso.comercial },
              ].map((u) => (
                <div key={u.texto}>
                  <dt className={cn("text-sm", GRIS)}>{u.texto}</dt>
                  <dd className="text-lg font-bold tabular-nums">
                    {u.valor.toLocaleString("es-CL")} m³ <span className={cn("text-sm font-normal", GRIS)}>{Math.round((u.valor / usoTotal) * 100)} %</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className={cn(tarjeta, "lg:col-span-5")}>
          <h2 className="text-lg font-bold">Quiénes pagaron</h2>
          <p className={cn("text-sm", GRIS)}>{d.mejorPeriodo ? `${formatearPeriodo(d.mejorPeriodo.periodo)}, el mejor mes` : "Aún no hay pagos registrados"}</p>
          {d.pagadores.length === 0 ? (
            <p className={cn("mt-4 text-sm", GRIS)}>Todavía nadie ha pagado.</p>
          ) : (
            <ul className="mt-3">
              {d.pagadores.map((s) => (
                <li key={s.id} className="flex items-center gap-3 border-t border-[#F0EEF6] py-3 first:border-t-0">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ECE8FD] text-[13px] font-bold text-[#2A07A8]">
                    {iniciales(s.nombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{s.nombre}</p>
                    <p className={cn("text-[13px]", GRIS)}>
                      {s.boletas} {s.boletas === 1 ? "boleta" : "boletas"}
                    </p>
                  </div>
                  <p className="shrink-0 text-[15px] font-bold tabular-nums">{clp.format(s.pagado)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cn("overflow-hidden rounded-[20px] bg-card lg:col-span-8", SOMBRA)}>
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
            <h2 className="text-lg font-bold">Boletas recientes</h2>
            <Link href="/panel/boletas" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline">
              Ver todas <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          {d.boletas.length === 0 ? (
            <p className={cn("px-5 pt-4 pb-8 text-center text-sm", GRIS)}>Todavía no hay boletas emitidas.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className={cn("text-[13px]", GRIS)}>
                      <th scope="col" className="px-5 py-2 font-semibold">Socio</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Período</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Monto</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Vence</th>
                      <th scope="col" className="px-5 py-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.boletas.map((b) => (
                      <tr key={b.id} className="border-t border-[#F0EEF6] hover:bg-[#FBFAFF]">
                        <td className="px-5 py-3 text-sm font-semibold">{b.socioNombre}</td>
                        <td className="px-3 py-3 text-sm text-[#3F3C55]">{formatearPeriodo(b.periodo)}</td>
                        <td className="px-3 py-3 text-right text-sm font-bold tabular-nums">{clp.format(b.montoTotal)}</td>
                        <td className="px-3 py-3 text-sm text-[#3F3C55]">{fechaCorta.format(b.fechaVencimiento)}</td>
                        <td className="px-5 py-3">
                          <EstadoBoleta b={b} ahora={ahora} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-[#F0EEF6] md:hidden">
                {d.boletas.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold">{b.socioNombre}</p>
                      <p className={cn("text-[13px]", GRIS)}>
                        {formatearPeriodo(b.periodo)} · vence {fechaCorta.format(b.fechaVencimiento)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-bold tabular-nums">{clp.format(b.montoTotal)}</p>
                      <EstadoBoleta b={b} ahora={ahora} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={cn("flex flex-col rounded-[20px] bg-card p-6 lg:col-span-4", SOMBRA, d.solicitudesPendientes.length === 0 && "items-center justify-center text-center")}>
          <UserCheck className="size-7 text-primary" aria-hidden />
          <h2 className="mt-2 text-lg font-bold">Solicitudes de acceso</h2>
          {d.solicitudesPendientes.length > 0 ? (
            <>
              <p className={cn("mt-1 text-sm", GRIS)}>
                {d.solicitudesPendientes.length} {d.solicitudesPendientes.length === 1 ? "pendiente" : "pendientes"}
              </p>
              <ul className="mt-3 flex flex-col divide-y divide-[#F0EEF6]">
                {d.solicitudesPendientes.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#ECE8FD] text-[12px] font-bold text-[#2A07A8]">
                      {iniciales(s.nombre)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{s.nombre}</p>
                      <p className={cn("truncate text-[13px]", GRIS)}>{s.rut}</p>
                    </div>
                    <span className={cn("shrink-0 text-xs", GRIS)}>{s.hace}</span>
                  </li>
                ))}
              </ul>
              <Link href="/panel/socios/solicitudes" className="mt-auto inline-flex min-h-11 items-center gap-2 pt-3 text-sm font-semibold text-primary hover:underline">
                Revisar solicitudes <ArrowRight className="size-4" aria-hidden />
              </Link>
            </>
          ) : (
            <p className={cn("mt-1 text-sm", GRIS)}>No hay solicitudes pendientes.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/** El estado de una boleta: pagada, vencida o pendiente. `ahora` se lee una sola vez para toda la página. */
function EstadoBoleta({ b, ahora }: { b: { montoTotal: number; montoPagado: number; fechaVencimiento: Date }; ahora: Date }) {
  const pagada = b.montoPagado >= b.montoTotal;
  const vencida = !pagada && b.fechaVencimiento < ahora;
  return (
    <span className={cn("inline-block rounded-full px-3 py-1 text-xs font-bold", pagada ? "bg-[#DFF4EB] text-[#075A3C]" : vencida ? "bg-[#FDECEC] text-[#A32020]" : "bg-[#FFEEDC] text-[#8F4400]")}>
      {pagada ? "Pagada" : vencida ? "Vencida" : "Pendiente"}
    </span>
  );
}
