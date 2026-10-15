import type { Metadata } from "next";
import Link from "next/link";
import { and, countDistinct, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Droplets,
  FlaskConical,
  UserCheck,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { boletas, socios, solicitudesAcceso } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import {
  GraficoArea,
  GraficoBarras,
  SparklineArea,
} from "@/components/panel/graficos";
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

function Tarjeta({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Variación respecto al período anterior. */
function Delta({ valor, invertido }: { valor: number | null; invertido?: boolean }) {
  if (valor === null) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.75rem] font-medium text-muted-foreground">
        sin comparación
      </span>
    );
  }

  // En morosidad subir es malo: `invertido` cambia qué color es bueno.
  const bueno = invertido ? valor <= 0 : valor >= 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.75rem] font-medium tabular-nums",
        bueno ? "bg-forest/10 text-forest" : "bg-destructive/10 text-destructive"
      )}
    >
      {valor >= 0 ? (
        <ArrowUp className="size-3" />
      ) : (
        <ArrowDown className="size-3" />
      )}
      {Math.abs(valor).toFixed(1)}%
    </span>
  );
}

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; demo?: string }>;
}) {
  const { apr } = await requireAdmin();
  const { rango: rangoParam, demo: demoParam } = await searchParams;

  const demo = demoParam === "1";
  // Una sola lectura del reloj para toda la página: si cada fila leyera la
  // suya, dos boletas del mismo vencimiento podrían mostrar estados distintos.
  const ahora = new Date();
  const rango = RANGOS.find((r) => r.id === rangoParam) ?? RANGOS[1];
  const desde = new Date(Date.now() - rango.dias * 86_400_000);
  // El período anterior de igual largo, para calcular la variación.
  const desdeAnterior = new Date(Date.now() - rango.dias * 2 * 86_400_000);

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

  const kpis = [
    {
      icono: <Users />,
      fondo: "bg-primary/10",
      texto: "text-primary",
      etiqueta: "Socios",
      valor: String(d.padron.total),
      delta: null,
      detalle: `${d.padron.activos} ${d.padron.activos === 1 ? "activo" : "activos"}`,
      href: "/panel/socios",
    },
    {
      icono: <AlertTriangle />,
      fondo: "bg-destructive/10",
      texto: "text-destructive",
      etiqueta: "Morosos",
      valor: String(d.morosidad.socios),
      delta: null,
      detalle:
        d.morosidad.socios === 0
          ? "Sin boletas vencidas"
          : `${clp.format(d.morosidad.monto)} por cobrar`,
      href: "/panel/boletas",
    },
    {
      icono: <Wallet />,
      fondo: "bg-forest/10",
      texto: "text-forest",
      etiqueta: "Recaudado",
      valor: clp.format(d.facturacion.recaudado),
      delta: variacion(recienteActual.recaudado, recienteAnterior.recaudado),
      detalle:
        d.facturacion.facturado === 0
          ? "Aún no emites boletas"
          : `${cobertura}% de lo facturado`,
      href: "/panel/boletas",
    },
    {
      icono: <ReceiptText />,
      fondo: "bg-tertiary/15",
      texto: "text-tertiary-texto",
      etiqueta: "Facturas emitidas",
      valor: String(d.facturacion.emitidas),
      delta: variacion(recienteActual.emitidas, recienteAnterior.emitidas),
      detalle:
        d.facturacion.emitidas === 0
          ? "Sin boletas emitidas"
          : `${clp.format(d.facturacion.facturado)} facturados`,
      href: "/panel/boletas",
    },
  ];

  return (
    <>
      {demo && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-tertiary/40 bg-tertiary/10 px-4 py-3">
          <FlaskConical className="size-4 shrink-0 text-tertiary-texto" />
          <p className="flex-1 text-[0.88rem] leading-relaxed">
            <strong>Vista de demostración.</strong> Ninguna de estas cifras es
            de tu comité: son datos inventados para ver cómo se verá el panel.
          </p>
          <Link
            href="/panel"
            className="text-[0.85rem] font-medium text-primary hover:underline"
          >
            Salir de la demo
          </Link>
        </div>
      )}

      {/* Resumen: los cuatro KPI con un filtro de período único para toda la
          vista, en vez de un selector por tarjeta. */}
      <Tarjeta className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="text-[1.05rem] font-semibold">Resumen</h2>

          <div className="flex rounded-lg border border-border p-0.5">
            {RANGOS.map((r) => (
              <Link
                key={r.id}
                href={`/panel?rango=${r.id}${demo ? "&demo=1" : ""}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[0.85rem] font-medium transition-colors",
                  r.id === rango.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-border xl:grid-cols-4">
          {kpis.map((kpi, i) => (
            <Link
              key={kpi.etiqueta}
              href={kpi.href}
              className={cn(
                "min-w-0 p-3.5 transition-colors hover:bg-muted/40 sm:p-5",
                i > 0 && "xl:border-l xl:border-border",
                i % 2 === 1 && "border-l border-border xl:border-l",
                i > 1 && "border-t border-border xl:border-t-0"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-9 [&_svg]:size-4 sm:[&_svg]:size-4.5",
                    kpi.fondo,
                    kpi.texto
                  )}
                >
                  {kpi.icono}
                </span>
                <span className="truncate text-[0.82rem] text-muted-foreground sm:text-[0.9rem]">
                  {kpi.etiqueta}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
                <span
                  className={cn(
                    "text-[1.4rem] leading-none font-semibold tabular-nums sm:text-[1.8rem]",
                    kpi.texto
                  )}
                >
                  {kpi.valor}
                </span>
                {kpi.delta !== null && <Delta valor={kpi.delta} />}
              </div>

              <p className="mt-1.5 truncate text-[0.76rem] text-muted-foreground sm:text-[0.83rem]">
                {kpi.detalle}
              </p>
            </Link>
          ))}
        </div>
      </Tarjeta>

      {/* Dos tarjetas de tendencia + rendimiento del padrón a la derecha. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tarjeta>
          <h3 className="text-[1rem] font-semibold">Tasa de morosidad</h3>
          <p className="mt-0.5 text-[0.85rem] text-muted-foreground">
            Socios con boletas vencidas
          </p>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="text-[1.8rem] leading-none font-semibold tabular-nums">
                {tasaMorosidad.toFixed(2)}%
              </div>
              <p className="mt-1.5 text-[0.83rem] text-muted-foreground">
                {d.morosidad.socios} de {d.padron.total || 0} socios
              </p>
            </div>
            <div className="w-32">
              <SparklineArea
                datos={d.vencidas}
                nombre="Boletas vencidas"
                color="var(--destructive)"
                id="spark-morosidad"
              />
            </div>
          </div>
        </Tarjeta>

        {/* Cobertura, no monto: el monto ya está en el KPI de arriba y su
            curva en las barras del costado. Aquí interesa qué proporción de
            lo facturado llegó a cobrarse. */}
        <Tarjeta>
          <h3 className="text-[1rem] font-semibold">Cobertura de cobranza</h3>
          <p className="mt-0.5 text-[0.85rem] text-muted-foreground">
            Cuánto de lo facturado se ha cobrado
          </p>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="text-[1.8rem] leading-none font-semibold tabular-nums">
                {cobertura}%
              </div>
              <p className="mt-1.5 text-[0.83rem] text-muted-foreground">
                {clp.format(d.facturacion.recaudado)} de{" "}
                {clp.format(d.facturacion.facturado)}
              </p>
            </div>
            <div className="w-32">
              <SparklineArea
                datos={d.recaudado}
                nombre="Recaudado"
                color="var(--forest)"
                id="spark-recaudacion"
              />
            </div>
          </div>
        </Tarjeta>

        <Tarjeta className="lg:row-span-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[1rem] font-semibold">Recaudación por mes</h3>
            <Wallet className="size-4 shrink-0 text-forest" />
          </div>
          <p className="mt-0.5 text-[0.85rem] text-muted-foreground">
            Cuánto se cobró en cada período
          </p>

          <div className="mt-6">
            <GraficoBarras
              datos={d.recaudado}
              nombre="Recaudado"
              color="var(--forest)"
              formato="clp"
            />
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <h4 className="text-[0.9rem] font-medium">Quiénes pagaron</h4>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              {d.mejorPeriodo
                ? `En ${formatearPeriodo(d.mejorPeriodo.periodo)}, el mejor mes`
                : "Aún no hay pagos registrados"}
            </p>

            <div className="mt-3 flex flex-col gap-3">
              {d.pagadores.length === 0 ? (
                <p className="text-[0.85rem] text-muted-foreground">
                  Todavía nadie ha pagado.
                </p>
              ) : (
                d.pagadores.map((s) => (
                  <div key={s.id} className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[0.7rem] font-semibold text-forest">
                      {iniciales(s.nombre)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.87rem]">{s.nombre}</div>
                      <div className="text-[0.75rem] text-muted-foreground">
                        {s.boletas} {s.boletas === 1 ? "boleta" : "boletas"}
                      </div>
                    </div>
                    <span className="shrink-0 text-[0.85rem] font-semibold tabular-nums text-forest">
                      {clp.format(s.pagado)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Tarjeta>

        {/* Consumo en área: una sola serie, que es donde este gráfico
            funciona. Con tres estados de escalas distintas las curvas chicas
            quedaban aplastadas contra el eje. */}
        <Tarjeta className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[1rem] font-semibold">
                Evolución del consumo
              </h3>
              <p className="mt-0.5 text-[0.85rem] text-muted-foreground">
                Metros cúbicos consumidos por período
              </p>
            </div>
            <Droplets className="size-4 shrink-0 text-primary" />
          </div>

          <div className="mt-5">
            <GraficoArea
              datos={d.consumo}
              nombre="Consumo (m³)"
              color="var(--primary)"
            />
          </div>

          {/* Quién consume: el mismo período, separado por uso del agua. */}
          {d.consumoPorUso.residencial + d.consumoPorUso.comercial > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-[0.85rem]">
              {[
                { texto: "Residencial", valor: d.consumoPorUso.residencial },
                { texto: "Comercial", valor: d.consumoPorUso.comercial },
              ].map((u) => {
                const total = d.consumoPorUso.residencial + d.consumoPorUso.comercial;
                return (
                  <div key={u.texto}>
                    <div className="text-muted-foreground">{u.texto}</div>
                    <div className="mt-0.5 text-[1.05rem] font-semibold tabular-nums">
                      {u.valor.toLocaleString("es-CL")} m³
                      <span className="ml-1.5 text-[0.78rem] font-normal text-muted-foreground">
                        {Math.round((u.valor / total) * 100)} %
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Tarjeta>
      </div>

      {/* Ambas tarjetas terminan a la misma altura: la tabla reparte el
          espacio sobrante entre sus filas en vez de dejar un hueco al pie. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tarjeta className="flex flex-col lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[1rem] font-semibold">Boletas recientes</h3>
            <Link
              href="/panel/boletas"
              className="inline-flex items-center gap-1 text-[0.85rem] font-medium text-primary hover:underline"
            >
              Ver todas
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {d.boletas.length === 0 ? (
            <p className="mt-8 mb-4 text-center text-[0.88rem] text-muted-foreground">
              Todavía no hay boletas emitidas.
            </p>
          ) : (
            /* h-full + la tabla al 100%: las filas se estiran para llenar el
               alto en vez de amontonarse arriba y dejar el resto vacío. */
            <div className="mt-4 h-full overflow-x-auto">
              <table className="h-full w-full text-[0.87rem]">
                <thead>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="pb-2.5 font-medium">Socio</th>
                    <th className="hidden pb-2.5 font-medium sm:table-cell">Período</th>
                    <th className="pb-2.5 font-medium">Monto</th>
                    <th className="pb-2.5 font-medium">Vence</th>
                    <th className="pb-2.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {d.boletas.map((b) => {
                    const pagada = b.montoPagado >= b.montoTotal;
                    // `ahora` se fija una vez arriba: leer el reloj por fila
                    // haría que una boleta cambiara de estado a media tabla.
                    const atrasada = !pagada && b.fechaVencimiento < ahora;

                    return (
                      <tr key={b.id} className="border-b border-border/40 last:border-0">
                        <td className="py-3 font-medium">{b.socioNombre}</td>
                        <td className="hidden py-3 text-muted-foreground sm:table-cell">
                          {formatearPeriodo(b.periodo)}
                        </td>
                        <td className="py-3 tabular-nums">
                          {clp.format(b.montoTotal)}
                        </td>
                        <td className="py-3 tabular-nums text-muted-foreground">
                          {fechaCorta.format(b.fechaVencimiento)}
                        </td>
                        <td className="py-3">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[0.75rem] font-medium",
                              pagada
                                ? "bg-forest/10 text-forest"
                                : atrasada
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-tertiary/15 text-tertiary-texto"
                            )}
                          >
                            {pagada ? "Pagada" : atrasada ? "Vencida" : "Pendiente"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>

        <Tarjeta>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[1rem] font-semibold">Solicitudes de acceso</h3>
            <UserCheck className="size-4 text-primary" />
          </div>

          {d.solicitudesPendientes.length > 0 ? (
            <>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
                <div className="text-[1.8rem] leading-none font-semibold tabular-nums">
                  {d.solicitudesPendientes.length}
                  <span className="ml-2 text-[0.85rem] font-normal text-muted-foreground">
                    pendiente{d.solicitudesPendientes.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col divide-y divide-border/60 border-t border-border pt-1">
                {d.solicitudesPendientes.map((s) => (
                  <div key={s.id} className="flex items-center gap-2.5 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[0.7rem] font-semibold text-muted-foreground">
                      {iniciales(s.nombre)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[0.85rem] font-medium">
                        {s.nombre}
                      </div>
                      <div className="truncate text-[0.8rem] text-muted-foreground">
                        {s.rut}
                      </div>
                    </div>
                    <span className="shrink-0 text-[0.75rem] text-muted-foreground">
                      {s.hace}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                href="/panel/socios/solicitudes"
                className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-[0.85rem] font-medium text-primary transition-colors hover:bg-muted"
              >
                Revisar solicitudes
                <ArrowRight className="size-3.5" />
              </Link>
            </>
          ) : (
            <div className="mt-8 mb-6 flex flex-col items-center text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-muted">
                <UserCheck className="size-5 text-muted-foreground" />
              </span>
              <p className="mt-4 text-[0.88rem] font-medium">
                No hay solicitudes pendientes
              </p>
              <p className="mt-1.5 text-[0.83rem] leading-relaxed text-muted-foreground">
                Cuando un socio pida acceso a su panel con su RUT, aparecerá
                aquí para que lo apruebes.
              </p>
            </div>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
