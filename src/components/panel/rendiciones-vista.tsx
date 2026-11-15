"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, FileText, Loader2 } from "lucide-react";
import { consultarRendicion } from "@/app/panel/rendiciones/actions";
import type { DatosRendicion } from "@/lib/rendicion";
import {
  CONTENIDO_TODO,
  TIPOS_PERIODO,
  cambiarTipo,
  contenidoAParametro,
  periodoVecino,
  periodoYaEmpezo,
  rangoDe,
  type ContenidoRendicion,
  type PeriodoRendicion,
} from "@/lib/rendicion-periodo";
import { INTERVALO_RAPIDO } from "@/lib/avisos-datos";
import { formatearRut } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const clp = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("es-CL");
const fecha = (iso: string) => iso.split("-").reverse().join("-");
const TARJETA = "rounded-2xl bg-card shadow-[0_8px_24px_rgba(58,12,227,0.1)]";

const PARTES: { clave: keyof ContenidoRendicion; texto: string }[] = [
  { clave: "ingresos", texto: "Ingresos" },
  { clave: "egresos", texto: "Egresos" },
  { clave: "compras", texto: "Compras" },
  { clave: "cobranza", texto: "Cobranza" },
  { clave: "saldos", texto: "Saldos" },
  { clave: "extras", texto: "Patrimonio y trabajos" },
];

const mismo = (a: PeriodoRendicion, b: PeriodoRendicion) => a.tipo === b.tipo && a.anio === b.anio && a.numero === b.numero;

function urlDe(p: PeriodoRendicion, c: ContenidoRendicion, base: string) {
  const q = new URLSearchParams({ tipo: p.tipo, anio: String(p.anio), numero: String(p.numero), c: contenidoAParametro(c) });
  return `${base}?${q.toString()}`;
}

/** Las filas del Excel: lo mismo que ve en pantalla, solo con las partes elegidas. */
function filasExcel(d: DatosRendicion, c: ContenidoRendicion): (string | number)[][] {
  const f: (string | number)[][] = [["Rendición de cuentas", d.etiqueta], ["Del", fecha(d.desde), "al", fecha(d.hasta)], []];
  if (c.saldos && d.saldoInicio !== null) f.push(["Saldo al inicio", d.saldoInicio]);
  if (c.ingresos) f.push(["Ingresos", d.resumen.totalIngresos]);
  if (c.egresos) f.push(["Egresos", d.resumen.totalEgresos]);
  if (c.ingresos && c.egresos) f.push(["Resultado", d.resumen.totalIngresos - d.resumen.totalEgresos]);
  if (c.saldos && d.saldoCierre !== null) f.push(["Saldo al cierre", d.saldoCierre]);
  f.push([]);
  if (c.ingresos) {
    f.push(["INGRESOS", "Monto"], ...d.ingresos.map((i) => [i.nombre, i.monto]), []);
  }
  if (c.egresos) {
    f.push(["EGRESOS", "Monto"], ...d.egresos.map((i) => [i.nombre, i.monto]), []);
  }
  if (c.compras) {
    f.push(["COMPRAS POR PROVEEDOR", "RUT", "Compras", "Total"], ...d.compras.porProveedor.map((p) => [p.nombre, p.rut ? formatearRut(p.rut) : "", p.compras, p.total]), []);
    f.push(["COMPRAS: DETALLE", "Fecha", "N.º", "Proveedor", "Documento", "Estado", "Ítem", "Cantidad", "Costo unitario", "Total de la compra"]);
    for (const k of d.compras.detalle) {
      if (k.items.length === 0) f.push(["", fecha(k.fecha), `C-${k.numero}`, k.proveedor, k.documento, k.estado, "", "", "", k.total]);
      k.items.forEach((it, i) => f.push(["", fecha(k.fecha), `C-${k.numero}`, k.proveedor, k.documento, k.estado, it.descripcion, it.cantidad, it.costoUnitario, i === 0 ? k.total : ""]));
    }
    f.push([]);
  }
  if (c.cobranza) {
    f.push(["COBRANZA"], ["Boletas emitidas", d.cobranza.boletas], ["Monto emitido", d.cobranza.emitido], ["Monto pagado", d.cobranza.pagado], ["Deuda de socios, a hoy", d.cobranza.deudaTotal], []);
  }
  return f;
}

function descargarExcel(d: DatosRendicion, c: ContenidoRendicion) {
  const celda = (t: string | number) => `"${String(t).replace(/"/g, '""')}"`;
  const csv = "﻿" + filasExcel(d, c).map((fila) => fila.map(celda).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `rendicion-${d.etiqueta.replace(/\./g, "").replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Cifra({ label, valor, fuerte = false }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={cn("px-5 py-4", fuerte && "bg-primary/10")}>
      <p className={cn("text-[0.8rem] font-semibold", fuerte ? "text-primary" : "text-muted-foreground")}>{label}</p>
      <p className={cn("mt-1 text-2xl leading-tight font-bold tracking-tight tabular-nums", fuerte && "text-primary")}>{valor}</p>
    </div>
  );
}

function Lista({ titulo, filas, total }: { titulo: string; filas: { nombre: string; monto: number }[]; total: number }) {
  return (
    <section className={cn(TARJETA, "p-5")}>
      <h2 className="text-lg font-bold">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Sin movimientos en el período.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {filas.map((l) => (
            <li key={l.nombre}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{l.nombre}</span>
                <span className="shrink-0 font-semibold tabular-nums">{clp(l.monto)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary/10">
                <div className="h-full rounded-full bg-primary" style={{ width: `${total > 0 ? Math.max(2, Math.round((l.monto / total) * 100)) : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Rendiciones: las cuentas del comité de un mes, un trimestre, un semestre o un año, con las partes que se elijan
 * (ingresos, egresos, compras, cobranza…), para revisarlas en pantalla y bajarlas en PDF o Excel.
 */
export function RendicionesVista({ inicial, hoy }: { inicial: DatosRendicion; hoy: string }) {
  const [periodo, setPeriodo] = useState<PeriodoRendicion>(inicial.periodo);
  const [contenido, setContenido] = useState<ContenidoRendicion>(CONTENIDO_TODO);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["rendicion", periodo.tipo, periodo.anio, periodo.numero],
    queryFn: () => consultarRendicion(periodo),
    initialData: mismo(periodo, inicial.periodo) ? inicial : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: INTERVALO_RAPIDO,
  });
  const d = data ?? inicial;
  const hayExtras = Boolean(inicial.activos || inicial.labores || inicial.incidentes);
  const partes = PARTES.filter((p) => p.clave !== "extras" || hayExtras);
  const todo = partes.every((p) => contenido[p.clave]);

  function irA(p: PeriodoRendicion, c: ContenidoRendicion = contenido) {
    setPeriodo(p);
    window.history.replaceState(null, "", urlDe(p, c, "/panel/rendiciones"));
  }
  function alternar(clave: keyof ContenidoRendicion) {
    const sig = { ...contenido, [clave]: !contenido[clave] };
    // Siempre queda al menos una parte: una rendición vacía no sirve de nada.
    if (!Object.values(sig).some(Boolean)) return;
    setContenido(sig);
    window.history.replaceState(null, "", urlDe(periodo, sig, "/panel/rendiciones"));
  }

  const anterior = periodoVecino(periodo, -1);
  const siguiente = periodoVecino(periodo, 1);
  const haySiguiente = periodoYaEmpezo(siguiente, hoy);
  const etiqueta = rangoDe(periodo).etiqueta;
  const ing = d.resumen.totalIngresos;
  const egr = d.resumen.totalEgresos;
  const resultado = ing - egr;
  const sinNada = d.resumen.totalIngresos === 0 && d.resumen.totalEgresos === 0 && d.compras.detalle.length === 0 && d.cobranza.boletas === 0;

  const boton = "flex size-9 items-center justify-center rounded-full hover:bg-muted";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-[32px] leading-tight font-bold tracking-tight">Rendiciones</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => descargarExcel(d, contenido)} className="h-11 rounded-full bg-card font-semibold">
            <Download />
            Excel
          </Button>
          <Button render={<a href={urlDe(periodo, contenido, "/panel/rendiciones/pdf")} target="_blank" rel="noopener noreferrer" />} nativeButton={false} className="h-11 rounded-full font-semibold">
            <FileText />
            PDF
          </Button>
        </div>
      </div>

      <div className={cn(TARJETA, "flex flex-col gap-4 p-4 sm:p-5")}>
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Tipo de período" className="flex gap-1 rounded-full bg-muted p-1">
            {TIPOS_PERIODO.map((t) => (
              <button
                key={t.valor}
                type="button"
                role="radio"
                aria-checked={periodo.tipo === t.valor}
                onClick={() => irA(cambiarTipo(periodo, t.valor, hoy))}
                className={cn("h-8 rounded-full px-3 text-[13px] font-semibold", periodo.tipo === t.valor ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
              >
                {t.texto}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-full bg-muted p-1">
            <button type="button" onClick={() => irA(anterior)} aria-label="Período anterior" className={boton}>
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[9.5rem] px-2 text-center text-[15px] font-bold tabular-nums">{etiqueta}</span>
            <button type="button" onClick={() => irA(siguiente)} disabled={!haySiguiente} aria-label="Período siguiente" className={cn(boton, !haySiguiente && "opacity-30 hover:bg-transparent")}>
              <ChevronRight className="size-4" />
            </button>
          </div>
          {isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Actualizando" /> : null}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Qué incluir">
          <button
            type="button"
            aria-pressed={todo}
            onClick={() => {
              const sig = { ...CONTENIDO_TODO, extras: hayExtras };
              setContenido(sig);
              window.history.replaceState(null, "", urlDe(periodo, sig, "/panel/rendiciones"));
            }}
            className={cn("h-9 rounded-full border px-3.5 text-[13px] font-semibold", todo ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
          >
            Todo
          </button>
          {partes.map((p) => (
            <button
              key={p.clave}
              type="button"
              aria-pressed={contenido[p.clave]}
              onClick={() => alternar(p.clave)}
              className={cn("h-9 rounded-full border px-3.5 text-[13px] font-semibold", contenido[p.clave] ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
            >
              {p.texto}
            </button>
          ))}
        </div>
      </div>

      {isError ? <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">No pudimos cargar este período. Inténtalo otra vez.</p> : null}

      <div className={cn("flex flex-col gap-4 transition-opacity", isFetching && "opacity-60")}>
        {sinNada ? <p className={cn(TARJETA, "px-5 py-10 text-center text-sm text-muted-foreground")}>Sin movimientos en {d.etiqueta}.</p> : null}

        {(contenido.ingresos || contenido.egresos || contenido.saldos) && !sinNada ? (
          <div role="group" aria-label="Totales" className={cn(TARJETA, "grid divide-y divide-border overflow-hidden sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4")}>
            {contenido.saldos && d.saldoInicio !== null ? <Cifra label={`Saldo al ${fecha(d.desde)}`} valor={clp(d.saldoInicio)} /> : null}
            {contenido.ingresos ? <Cifra label="Ingresos" valor={clp(ing)} /> : null}
            {contenido.egresos ? <Cifra label="Egresos" valor={clp(egr)} /> : null}
            {contenido.ingresos && contenido.egresos ? <Cifra fuerte label="Resultado" valor={(resultado > 0 ? "+" : "") + clp(resultado)} /> : null}
            {contenido.saldos && d.saldoCierre !== null ? <Cifra label={`Saldo al ${fecha(d.hasta)}`} valor={clp(d.saldoCierre)} /> : null}
          </div>
        ) : null}

        {(contenido.ingresos || contenido.egresos) && !sinNada ? (
          <div className={cn("grid gap-4", contenido.ingresos && contenido.egresos && "lg:grid-cols-2")}>
            {contenido.ingresos ? <Lista titulo="Ingresos" filas={d.ingresos} total={ing} /> : null}
            {contenido.egresos ? <Lista titulo="Egresos" filas={d.egresos} total={egr} /> : null}
          </div>
        ) : null}

        {contenido.compras ? (
          <section className={cn(TARJETA, "p-5")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">Compras</h2>
              <p className="text-sm text-muted-foreground">
                {d.compras.detalle.length} {d.compras.detalle.length === 1 ? "compra" : "compras"} · <span className="font-semibold text-foreground tabular-nums">{clp(d.compras.total)}</span>
                {d.compras.porPagar > 0 ? ` · ${clp(d.compras.porPagar)} por pagar` : ""}
              </p>
            </div>
            {d.compras.detalle.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Sin compras en el período.</p>
            ) : (
              <>
                <h3 className="mt-4 text-[0.8rem] font-semibold text-muted-foreground">A quién</h3>
                <ul className="mt-2 divide-y divide-border">
                  {d.compras.porProveedor.map((p) => (
                    <li key={`${p.rut ?? ""}${p.nombre}`} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.nombre}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.rut ? `${formatearRut(p.rut)} · ` : ""}
                          {p.compras} {p.compras === 1 ? "compra" : "compras"}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{clp(p.total)}</span>
                    </li>
                  ))}
                </ul>

                <h3 className="mt-5 text-[0.8rem] font-semibold text-muted-foreground">Qué</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {d.compras.detalle.map((k) => (
                    <li key={`${k.numero}`} className="rounded-xl border border-border px-3.5 py-3 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-semibold">
                          C-{k.numero} · {k.proveedor}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{clp(k.total)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fecha(k.fecha)}
                        {k.documento ? ` · ${k.documento}` : ""}
                        {k.estado !== "PAGADA" ? " · Pendiente de pago" : ""}
                      </p>
                      {k.items.length > 0 ? (
                        <ul className="mt-2 flex flex-col gap-1 text-[0.82rem] text-muted-foreground">
                          {k.items.map((it, i) => (
                            <li key={i} className="flex justify-between gap-3">
                              <span className="min-w-0 truncate">
                                {Number.isInteger(it.cantidad) ? it.cantidad : String(it.cantidad).replace(".", ",")} × {it.descripcion}
                              </span>
                              <span className="shrink-0 tabular-nums">{clp(Math.round(it.cantidad * it.costoUnitario))}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ) : null}

        {contenido.cobranza ? (
          <section className={cn(TARJETA, "p-5")}>
            <h2 className="text-lg font-bold">Cobranza</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Boletas emitidas</dt>
                <dd className="mt-0.5 text-xl font-bold tabular-nums">{d.cobranza.boletas}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Monto emitido</dt>
                <dd className="mt-0.5 text-xl font-bold tabular-nums">{clp(d.cobranza.emitido)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pagado de lo emitido</dt>
                <dd className="mt-0.5 text-xl font-bold tabular-nums">
                  {clp(d.cobranza.pagado)}
                  {d.cobranza.emitido > 0 ? <span className="ml-1.5 text-sm font-medium text-muted-foreground">{Math.round((d.cobranza.pagado / d.cobranza.emitido) * 100)}%</span> : null}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Deuda de socios, a hoy</dt>
                <dd className="mt-0.5 text-xl font-bold tabular-nums">{clp(d.cobranza.deudaTotal)}</dd>
                {d.cobranza.sociosConDeuda > 0 ? <dd className="text-xs text-muted-foreground">{d.cobranza.sociosConDeuda} {d.cobranza.sociosConDeuda === 1 ? "socio" : "socios"}</dd> : null}
              </div>
            </dl>
          </section>
        ) : null}

        {contenido.extras && hayExtras ? (
          <section className={cn(TARJETA, "p-5")}>
            <h2 className="text-lg font-bold">Patrimonio y trabajos</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {d.activos ? (
                <>
                  <div>
                    <dt className="text-muted-foreground">Bienes vigentes</dt>
                    <dd className="mt-0.5 text-xl font-bold tabular-nums">{d.activos.n}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Valor actual</dt>
                    <dd className="mt-0.5 text-xl font-bold tabular-nums">{clp(d.activos.valorTotal)}</dd>
                  </div>
                </>
              ) : null}
              {d.labores ? (
                <div>
                  <dt className="text-muted-foreground">Labores realizadas</dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums">{d.labores.hechas}</dd>
                </div>
              ) : null}
              {d.incidentes ? (
                <div>
                  <dt className="text-muted-foreground">Fallas resueltas</dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums">{d.incidentes.resueltos}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : null}
      </div>
    </div>
  );
}
