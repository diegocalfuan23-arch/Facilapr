"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Banknote, ChevronLeft, ChevronRight, Download, FileText, Landmark, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const clp = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("es-CL");
const signo = (n: number) => (n > 0 ? "+" : "") + clp(n);

const TARJETA = "rounded-2xl bg-card shadow-[0_8px_24px_rgba(58,12,227,0.1)]";
const C_ING = "bg-primary";
const C_EGR = "bg-amber-500";

export type MesReporte = { mes: string; nombre: string; corto: string; ingresos: number; egresos: number };
export type LineaReporte = { clave: string; nombre: string; monto: number };
export type CuadreReporte = { saldoInicial: number; ingresos: number; egresos: number; real: number; efectivo: number; banco: number; desde: string };
export type CompraPorPagar = { id: string; numero: number; proveedor: string; vence: string | null; vencida: boolean; total: number };

type Props = {
  anio: number;
  anioActual: number;
  /** Las filas del Excel de movimientos. */
  planilla: (string | number)[][];
  meses: MesReporte[];
  origen: LineaReporte[];
  destino: LineaReporte[];
  cuadre: CuadreReporte | null;
  proveedores: { totalPorPagar: number; nPorPagar: number; vencidas: number; comprasAnio: number; sinProveedor: number; lista: CompraPorPagar[] };
  comprasPorProveedor: LineaReporte[];
};

function Total({ label, valor, detalle, fuerte = false }: { label: string; valor: string; detalle: string; fuerte?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-4 px-5 py-4 lg:block lg:py-5", fuerte && "bg-primary/10")}>
      <div className="min-w-0">
        <p className={cn("text-[0.8rem] font-semibold", fuerte ? "text-primary" : "text-muted-foreground")}>{label}</p>
        <p className="text-[0.8rem] text-muted-foreground lg:hidden">{detalle}</p>
      </div>
      <p className={cn("shrink-0 text-2xl leading-tight font-bold tracking-tight tabular-nums lg:mt-1 lg:text-[2.1rem]", fuerte && "text-primary")}>{valor}</p>
      <p className="mt-1 hidden text-[0.8rem] text-muted-foreground lg:block">{detalle}</p>
    </div>
  );
}

function Operador({ c }: { c: string }) {
  return (
    <span aria-hidden className="hidden items-center text-2xl font-medium text-muted-foreground/60 lg:flex">
      {c}
    </span>
  );
}

/** En el celular, el gráfico no cabe: cada mes con movimientos es una tarjeta con sus dos barras. Al tocarla, los totales pasan a ese mes. */
function GraficoMovil({ meses, sel, onSel }: { meses: MesReporte[]; sel: string | null; onSel: (mes: string) => void }) {
  const conDatos = meses.filter((m) => m.ingresos + m.egresos > 0);
  const max = Math.max(...conDatos.flatMap((m) => [m.ingresos, m.egresos]), 1);
  const vacios = meses.length - conDatos.length;
  return (
    <div className="flex flex-col gap-2 md:hidden">
      {conDatos.map((m) => (
        <button
          key={m.mes}
          type="button"
          aria-pressed={sel === m.mes}
          onClick={() => onSel(m.mes)}
          className={cn("rounded-2xl p-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", sel === m.mes ? "bg-primary/10" : "bg-muted/60")}
        >
          <span className="block text-[0.95rem] font-bold capitalize">{m.nombre}</span>
          {(
            [
              ["Ingresos", m.ingresos, C_ING],
              ["Egresos", m.egresos, C_EGR],
            ] as const
          ).map(([nombre, valor, color]) => (
            <span key={nombre} className="mt-2 block">
              <span className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{nombre}</span>
                <span className="font-semibold tabular-nums">{clp(valor)}</span>
              </span>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted">
                <span className={cn("block h-full rounded-full", color)} style={{ width: `${(valor / max) * 100}%` }} />
              </span>
            </span>
          ))}
        </button>
      ))}
      {vacios > 0 && <p className="pt-1 text-[0.8rem] text-muted-foreground">Sin movimientos en {vacios === 1 ? "el otro mes" : `los otros ${vacios} meses`}.</p>}
    </div>
  );
}

/** Barras de ingresos y egresos por mes: al tocar un mes, los totales de arriba pasan a ese mes. */
function Grafico({ meses, sel, onSel }: { meses: MesReporte[]; sel: string | null; onSel: (mes: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...meses.flatMap((m) => [m.ingresos, m.egresos]), 1);
  const paso = max >= 1_000_000 ? 500_000 : max >= 200_000 ? 200_000 : max >= 50_000 ? 50_000 : 10_000;
  const tope = Math.ceil(max / paso) * paso;
  const marcas = [tope, tope / 2, 0];
  const miles = (n: number) => (n === 0 ? "$0" : n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString("es-CL")} M` : `$${(n / 1000).toLocaleString("es-CL")} mil`);
  const mostrar = hover ?? sel;
  return (
    <div className="hidden md:block">
      <div className="relative h-[230px] pl-[58px]">
        {marcas.map((v, i) => (
          <div key={v} aria-hidden className="absolute inset-x-0 flex items-center gap-2" style={{ top: `${(i / (marcas.length - 1)) * 100}%`, transform: "translateY(-50%)" }}>
            <span className="w-[50px] shrink-0 text-right text-[0.7rem] text-muted-foreground tabular-nums">{miles(v)}</span>
            <span className={cn("h-px flex-1", v === 0 ? "bg-border" : "bg-border/50")} />
          </div>
        ))}
        <div className="relative flex h-full items-stretch">
          {meses.map((m, i) => {
            const conDatos = m.ingresos + m.egresos > 0;
            const activo = sel === m.mes;
            const alto = (v: number) => (v === 0 ? 0 : Math.max((v / tope) * 100, 1.5));
            const lado = i < 3 ? "left-0" : i > 8 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <button
                key={m.mes}
                type="button"
                disabled={!conDatos}
                aria-pressed={activo}
                aria-label={`${m.nombre}: ingresos ${clp(m.ingresos)}, egresos ${clp(m.egresos)}`}
                onClick={() => onSel(m.mes)}
                onMouseEnter={() => setHover(m.mes)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m.mes)}
                onBlur={() => setHover(null)}
                className={cn(
                  "relative flex min-w-0 flex-1 items-end justify-center gap-0.5 rounded-t-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                  activo ? "bg-primary/10" : conDatos ? "hover:bg-muted/70" : "cursor-default"
                )}
              >
                <span className={cn("w-[38%] max-w-[18px] rounded-t-[4px]", C_ING)} style={{ height: `${alto(m.ingresos)}%` }} />
                <span className={cn("w-[38%] max-w-[18px] rounded-t-[4px]", C_EGR)} style={{ height: `${alto(m.egresos)}%` }} />
                {mostrar === m.mes && conDatos && (
                  <span className={cn("absolute top-1 z-10 rounded-lg bg-slate-900 px-2 py-1 text-left text-xs whitespace-nowrap text-white tabular-nums", lado)}>
                    <span className="block font-semibold capitalize">{m.nombre}</span>
                    <span className="block">Ingresos {clp(m.ingresos)}</span>
                    <span className="block">Egresos {clp(m.egresos)}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex pl-[58px]">
        {meses.map((m) => (
          <span key={m.mes} className={cn("min-w-0 flex-1 text-center text-[0.65rem] sm:text-xs", sel === m.mes ? "font-bold text-primary" : "text-muted-foreground")}>
            {m.corto}
          </span>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-[0.8rem] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span aria-hidden className={cn("size-2.5 rounded-sm", C_ING)} />
          Ingresos
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className={cn("size-2.5 rounded-sm", C_EGR)} />
          Egresos
        </span>
      </div>
    </div>
  );
}

/** Un reparto por categoría, con su barra de porcentaje. */
function Reparto({ titulo, lineas, color, vacio, nota }: { titulo: string; lineas: LineaReporte[]; color: string; vacio: string; nota?: string }) {
  const total = lineas.reduce((s, l) => s + l.monto, 0);
  return (
    <section className={cn(TARJETA, "h-full p-5")}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-bold">{titulo}</h2>
        <p className="text-sm font-semibold text-muted-foreground tabular-nums">{clp(total)}</p>
      </div>
      {lineas.length === 0 ? (
        <p className="mt-4 text-[0.9rem] text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {lineas.map((l) => {
            const pct = total ? (l.monto / total) * 100 : 0;
            return (
              <li key={l.clave}>
                <span className="flex justify-between gap-4 text-[0.95rem]">
                  <span className="min-w-0 truncate font-medium">{l.nombre}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {clp(l.monto)} <span className="font-normal text-muted-foreground">{Math.round(pct)}%</span>
                  </span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className={cn("block h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {nota && (
        <p className="mt-4 flex items-start gap-2 text-[0.8rem] font-medium text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {nota}
        </p>
      )}
    </section>
  );
}

function Cascada({ label, valor, desde, hasta, tope, color, fuerte = false }: { label: string; valor: string; desde: number; hasta: number; tope: number; color: string; fuerte?: boolean }) {
  const izq = tope > 0 ? Math.max(0, (desde / tope) * 100) : 0;
  const ancho = tope > 0 ? Math.max(0, ((hasta - desde) / tope) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between gap-4 text-sm">
        <dt className={fuerte ? "font-bold" : "text-muted-foreground"}>{label}</dt>
        <dd className={cn("tabular-nums", fuerte ? "font-bold" : "font-medium")}>{valor}</dd>
      </div>
      <div aria-hidden className="relative mt-1 h-2 rounded-full bg-muted">
        <span className={cn("absolute h-full rounded-full", color)} style={{ left: `${izq}%`, width: `${Math.min(ancho, 100 - izq)}%` }} />
      </div>
    </div>
  );
}

const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

export function ReportesVista({ anio, anioActual, planilla, meses, origen, destino, cuadre, proveedores, comprasPorProveedor }: Props) {
  const [sel, setSel] = useState<string | null>(null);
  const [descarga, setDescarga] = useState(false);
  const conDatos = meses.filter((m) => m.ingresos + m.egresos > 0);
  const totalIng = meses.reduce((s, m) => s + m.ingresos, 0);
  const totalEgr = meses.reduce((s, m) => s + m.egresos, 0);
  const mes = meses.find((m) => m.mes === sel) ?? null;
  const ing = mes ? mes.ingresos : totalIng;
  const egr = mes ? mes.egresos : totalEgr;
  const res = ing - egr;
  const alcance = mes ? `${mes.nombre} ${anio}` : String(anio);
  const elegir = (id: string) => setSel((s) => (s === id ? null : id));

  // El informe imprimible es el de un mes: el elegido o, si no hay, el último con movimientos.
  const mesInforme = mes?.mes ?? conDatos[conDatos.length - 1]?.mes ?? null;

  function descargarExcel() {
    const celda = (t: string | number) => `"${String(t).replace(/"/g, '""')}"`;
    const csv = "﻿" + planilla.map((f) => f.map(celda).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const botonAnio = "flex size-9 items-center justify-center rounded-full hover:bg-muted";

  const totalOrigen = origen.reduce((s, l) => s + l.monto, 0);
  const cobros = origen.find((l) => l.clave === "COBROS");
  const pctCobros = cobros && totalOrigen ? Math.round((cobros.monto / totalOrigen) * 100) : 0;

  const esperado = cuadre ? cuadre.saldoInicial + cuadre.ingresos - cuadre.egresos : 0;
  const diferencia = cuadre ? cuadre.real - esperado : 0;
  const topeCuadre = cuadre ? Math.max(cuadre.saldoInicial + cuadre.ingresos, esperado, cuadre.real, 1) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[32px] leading-tight font-bold tracking-tight">Reportes</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">Cuánto entró, cuánto salió y si la plata cuadra.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full bg-card p-1">
            <Link href={`/panel/reportes?anio=${anio - 1}`} aria-label="Año anterior" className={botonAnio}>
              <ChevronLeft className="size-4" />
            </Link>
            <span className="px-2 text-[15px] font-bold tabular-nums">{anio}</span>
            {anio < anioActual + 1 ? (
              <Link href={`/panel/reportes?anio=${anio + 1}`} aria-label="Año siguiente" className={botonAnio}>
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span className={cn(botonAnio, "text-muted-foreground/40 hover:bg-transparent")}>
                <ChevronRight className="size-4" />
              </span>
            )}
          </div>
          <div className="relative">
            <Button data-tour="rep-descargar" variant="outline" aria-expanded={descarga} onClick={() => setDescarga((v) => !v)} className="h-11 rounded-full bg-card font-semibold">
              <Download />
              Descargar
            </Button>
            {descarga && (
              <div className="absolute right-0 z-20 mt-1 w-[230px] overflow-hidden rounded-2xl bg-card p-1 shadow-[0_16px_40px_rgba(22,21,28,0.18)]">
                <button
                  type="button"
                  onClick={() => {
                    descargarExcel();
                    setDescarga(false);
                  }}
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium hover:bg-accent"
                >
                  <Download className="size-4" aria-hidden />
                  Excel de movimientos
                </button>
                {anio <= anioActual ? (
                  <a href={`/panel/reportes/rendicion?anio=${anio}`} target="_blank" rel="noopener noreferrer" onClick={() => setDescarga(false)} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium hover:bg-accent">
                    <FileText className="size-4" aria-hidden />
                    Rendición de cuentas {anio}
                  </a>
                ) : null}
                {mesInforme ? (
                  <Link href={`/informes/caja/${mesInforme}`} target="_blank" onClick={() => setDescarga(false)} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium hover:bg-accent">
                    <FileText className="size-4" aria-hidden />
                    PDF del período
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {mes && (
        <button type="button" onClick={() => setSel(null)} className="inline-flex min-h-9 w-fit items-center gap-2 rounded-full bg-primary/10 px-3 text-sm font-semibold text-primary">
          Viendo {mes.nombre} {anio}
          <X className="size-4" aria-hidden />
          <span className="sr-only">Volver a todo el año</span>
        </button>
      )}

      <div role="group" aria-label="Totales" data-tour="rep-totales" className={cn(TARJETA, "grid divide-y divide-border overflow-hidden lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:divide-y-0")}>
        <Total label={`Ingresos ${alcance}`} valor={clp(ing)} detalle={mes ? "Del mes" : `${conDatos.length} ${conDatos.length === 1 ? "mes" : "meses"} con movimientos`} />
        <Operador c="−" />
        <Total label={`Egresos ${alcance}`} valor={clp(egr)} detalle={ing ? `${Math.round((egr / ing) * 100)}% de los ingresos` : "Sin ingresos"} />
        <Operador c="=" />
        <Total fuerte label={`Resultado ${alcance}`} valor={signo(res)} detalle={res >= 0 ? "Entró más de lo que salió" : "Salió más de lo que entró"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className={cn(TARJETA, "p-5 lg:col-span-7")}>
          <h2 className="text-lg font-bold">Mes a mes</h2>
          <p className="mb-4 text-sm text-muted-foreground">Toca un mes para verlo en detalle</p>
          <Grafico meses={meses} sel={sel} onSel={elegir} />
          <GraficoMovil meses={meses} sel={sel} onSel={elegir} />
        </section>

        <section data-tour="rep-cuadre" className={cn(TARJETA, "flex flex-col p-5 lg:col-span-5")}>
          <h2 className="text-lg font-bold">Cuadre con Caja</h2>
          <p className="text-sm text-muted-foreground">Lo que debería haber contra lo que hay</p>
          {cuadre ? (
            <>
              <dl className="mt-4 flex flex-col gap-3">
                <Cascada label="Saldo inicial" valor={clp(cuadre.saldoInicial)} desde={0} hasta={cuadre.saldoInicial} tope={topeCuadre} color="bg-muted-foreground/50" />
                <Cascada label="Ingresos desde el saldo inicial" valor={signo(cuadre.ingresos)} desde={cuadre.saldoInicial} hasta={cuadre.saldoInicial + cuadre.ingresos} tope={topeCuadre} color={C_ING} />
                <Cascada label="Egresos desde el saldo inicial" valor={clp(-cuadre.egresos)} desde={esperado} hasta={cuadre.saldoInicial + cuadre.ingresos} tope={topeCuadre} color={C_EGR} />
                <Cascada fuerte label="Debería haber" valor={clp(esperado)} desde={0} hasta={esperado} tope={topeCuadre} color="bg-slate-900 dark:bg-slate-200" />
                <Cascada fuerte label="Hay en Caja" valor={clp(cuadre.real)} desde={0} hasta={cuadre.real} tope={topeCuadre} color="bg-slate-900 dark:bg-slate-200" />
              </dl>
              <div className="mt-3 mb-4 flex flex-wrap gap-4 text-[0.8rem] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Banknote className="size-4" aria-hidden />
                  Efectivo {clp(cuadre.efectivo)}
                </span>
                <span className="flex items-center gap-2">
                  <Landmark className="size-4" aria-hidden />
                  Banco {clp(cuadre.banco)}
                </span>
              </div>
              {diferencia !== 0 ? (
                <Link href="/panel/caja" className="mt-auto flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">Hay una diferencia de {clp(Math.abs(diferencia))}</span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </Link>
              ) : (
                <p className="mt-auto rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">Todo cuadra</p>
              )}
              <p className="mt-2 text-[0.75rem] text-muted-foreground">Desde el {fechaCorta(cuadre.desde)}, la fecha de tu saldo inicial, hasta hoy.</p>
            </>
          ) : (
            <div className="mt-4 flex flex-1 flex-col justify-center rounded-xl border border-dashed border-border p-4 text-[0.9rem] text-muted-foreground">
              <p>Para ver el cuadre, define con cuánta plata partiste en el saldo inicial de la Caja.</p>
              <Link href="/panel/caja" className="mt-2 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
                Ir a Caja <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          )}
        </section>

        <div className="lg:col-span-6">
          <Reparto
            titulo="De dónde vino la plata"
            lineas={origen}
            color={C_ING}
            vacio="Sin ingresos este año."
            nota={pctCobros >= 30 ? `${pctCobros}% está en «Otros cobros»: conviene clasificarlo.` : undefined}
          />
        </div>
        <div className="lg:col-span-6">
          <Reparto titulo="A dónde fue la plata" lineas={destino} color={C_EGR} vacio="Sin egresos este año." />
        </div>

        <section data-tour="rep-detalle" className={cn(TARJETA, "min-w-0 overflow-hidden lg:col-span-8")}>
          <h2 className="px-5 pt-5 pb-2 text-lg font-bold">Detalle por mes</h2>
          {conDatos.length === 0 ? (
            <p className="px-5 pb-5 text-[0.9rem] text-muted-foreground">Sin movimientos en {anio}.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[520px] border-collapse text-left">
                  <thead>
                    <tr className="text-[0.8rem] text-muted-foreground">
                      <th scope="col" className="px-5 py-2 font-semibold">Mes</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Ingresos</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Egresos</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Resultado</th>
                      <th scope="col" aria-label="Informe" className="px-5 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {conDatos.map((m) => (
                      <tr key={m.mes} className={cn("border-t border-border", sel === m.mes ? "bg-primary/10" : "hover:bg-muted/50")}>
                        <td className="px-5 py-2">
                          <button type="button" onClick={() => elegir(m.mes)} className="min-h-10 text-[0.95rem] font-semibold capitalize hover:underline">
                            {m.nombre}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right text-[0.95rem] tabular-nums">{clp(m.ingresos)}</td>
                        <td className="px-3 py-2 text-right text-[0.95rem] tabular-nums">{clp(m.egresos)}</td>
                        <td className="px-3 py-2 text-right text-[0.95rem] font-bold tabular-nums">{signo(m.ingresos - m.egresos)}</td>
                        <td className="px-5 py-2 text-right">
                          <Link href={`/informes/caja/${m.mes}`} target="_blank" className="inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline">
                            Informe
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/50 text-[0.95rem] font-bold tabular-nums">
                      <td className="px-5 py-3">Total {anio}</td>
                      <td className="px-3 py-3 text-right">{clp(totalIng)}</td>
                      <td className="px-3 py-3 text-right">{clp(totalEgr)}</td>
                      <td className="px-3 py-3 text-right">{signo(totalIng - totalEgr)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <ul className="divide-y divide-border md:hidden">
                {conDatos.map((m) => (
                  <li key={m.mes}>
                    <button type="button" onClick={() => elegir(m.mes)} className={cn("flex min-h-14 w-full items-center justify-between gap-4 px-5 py-2 text-left", sel === m.mes && "bg-primary/10")}>
                      <span className="min-w-0">
                        <span className="block text-[0.95rem] font-semibold capitalize">{m.nombre}</span>
                        <span className="block text-[0.8rem] text-muted-foreground tabular-nums">
                          {clp(m.ingresos)} entró · {clp(m.egresos)} salió
                        </span>
                      </span>
                      <span className="shrink-0 text-[0.95rem] font-bold tabular-nums">{signo(m.ingresos - m.egresos)}</span>
                    </button>
                  </li>
                ))}
                <li className="flex justify-between gap-4 bg-muted/50 px-5 py-3 text-[0.95rem] font-bold tabular-nums">
                  <span>Total {anio}</span>
                  <span>{signo(totalIng - totalEgr)}</span>
                </li>
              </ul>
            </>
          )}
        </section>

        <section className={cn(TARJETA, "flex flex-col p-5 lg:col-span-4")}>
          <h2 className="text-lg font-bold">Proveedores</h2>
          <p className="mt-2 text-sm text-muted-foreground">Lo que debes</p>
          <p className="text-[1.65rem] leading-tight font-bold tabular-nums">{clp(proveedores.totalPorPagar)}</p>
          {proveedores.nPorPagar > 0 ? (
            <p className={cn("text-[0.85rem]", proveedores.vencidas > 0 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>
              {proveedores.nPorPagar} {proveedores.nPorPagar === 1 ? "compra" : "compras"} por pagar
              {proveedores.vencidas > 0 ? ` · ${proveedores.vencidas} vencida${proveedores.vencidas === 1 ? "" : "s"}` : ""}
            </p>
          ) : (
            <p className="text-[0.85rem] text-muted-foreground">No debes nada por ahora.</p>
          )}
          {proveedores.lista.length > 0 && (
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {proveedores.lista.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 py-2 text-[0.85rem]">
                  <span className="min-w-0 truncate">
                    C-{c.numero} · {c.proveedor}
                    <span className={cn("ml-2 text-[0.75rem]", c.vencida ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>{c.vence ? `vence ${fechaCorta(c.vence)}` : "sin vencimiento"}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{clp(c.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-muted-foreground">Compras en {anio}</p>
          <p className="text-[0.95rem] font-semibold tabular-nums">{clp(proveedores.comprasAnio)}</p>
          {proveedores.sinProveedor > 0 && (
            <p className="mt-2 flex items-start gap-2 text-[0.8rem] font-medium text-amber-800 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {proveedores.sinProveedor === proveedores.comprasAnio ? "Todas están sin proveedor asignado." : `${clp(proveedores.sinProveedor)} sin proveedor asignado.`}
            </p>
          )}
          <Link href="/panel/compras" className="mt-auto inline-flex min-h-11 items-center gap-2 pt-2 text-sm font-semibold text-primary hover:underline">
            Ver compras <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>

        {comprasPorProveedor.length > 0 && (
          <div className="lg:col-span-12">
            <Reparto titulo={`Compras por proveedor en ${anio}`} lineas={comprasPorProveedor} color="bg-primary/70" vacio="Sin compras este año." />
          </div>
        )}
      </div>
    </div>
  );
}
