"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Boxes, ChevronLeft, ChevronRight, Download, FileText, Info, Landmark, Loader2, ShoppingCart, type LucideIcon } from "lucide-react";
import { consultarRendicion } from "@/app/panel/rendiciones/actions";
import type { DatosRendicion } from "@/lib/rendicion";
import {
  SECCIONES_RENDICION,
  TIPOS_PERIODO,
  cambiarTipo,
  contenidoAParametro,
  contenidoDeSeccion,
  periodoVecino,
  periodoYaEmpezo,
  rangoDe,
  type ContenidoRendicion,
  type PeriodoRendicion,
  type SeccionRendicion,
} from "@/lib/rendicion-periodo";
import { INTERVALO_RAPIDO } from "@/lib/avisos-datos";
import { nombreMes } from "@/lib/finanzas-comun";
import { formatearRut } from "@/lib/formato";
import { formatoCantidad, unidadCorta } from "@/lib/inventario-comun";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const clp = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("es-CL");
const corto = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);
const fecha = (iso: string) => iso.split("-").reverse().join("-");
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const COL_ING = ["bg-[#2FB386]", "bg-[#7CD3B0]", "bg-[#BDE8D6]"];
const COL_EGR = ["bg-[#E8908E]", "bg-[#F0B07A]", "bg-[#F3C98B]", "bg-[#D9C2BE]"];

const mismo = (a: PeriodoRendicion, b: PeriodoRendicion) => a.tipo === b.tipo && a.anio === b.anio && a.numero === b.numero;

function urlDe(p: PeriodoRendicion, seccion: SeccionRendicion, c: ContenidoRendicion, base: string) {
  const q = new URLSearchParams({ tipo: p.tipo, anio: String(p.anio), numero: String(p.numero), seccion, c: contenidoAParametro(c) });
  return `${base}?${q.toString()}`;
}

/** Las filas del Excel: lo mismo que ve en pantalla, solo con las partes elegidas. */
function filasExcel(d: DatosRendicion, c: ContenidoRendicion): (string | number)[][] {
  const f: (string | number)[][] = [["Rendición de cuentas", d.etiqueta], ["Del", fecha(d.desde), "al", fecha(d.hasta)], []];
  if (c.saldos && d.saldoInicio !== null) f.push(["Saldo al inicio", d.saldoInicio]);
  if (c.ingresos || c.saldos) f.push(["Ingresos", d.resumen.totalIngresos]);
  if (c.egresos || c.saldos) f.push(["Egresos", d.resumen.totalEgresos]);
  if ((c.ingresos && c.egresos) || c.saldos) f.push(["Resultado", d.resumen.totalIngresos - d.resumen.totalEgresos]);
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
  if (c.inventario && d.inventario) {
    f.push(["INVENTARIO", "Unidad", "Entró", "Salió"], ...d.inventario.materiales.map((m) => [m.nombre, unidadCorta(m.unidad), m.entradas, m.salidas]), []);
    if (d.inventario.stockBajo.length > 0) f.push(["CON POCO STOCK HOY", "Unidad", "Stock", "Mínimo"], ...d.inventario.stockBajo.map((m) => [m.nombre, unidadCorta(m.unidad), m.stock, m.minimo]), []);
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

function Encabezado({ titulo, sub, accion }: { titulo: string; sub?: string; accion?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {sub ? <p className={`mt-0.5 text-[13px] ${GRIS}`}>{sub}</p> : null}
      </div>
      {accion}
    </div>
  );
}

function Enlace({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[#2A07A8] hover:underline">
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

function Vacio({ icono: I, titulo, texto }: { icono: LucideIcon; titulo: string; texto: string }) {
  return (
    <Card className={`rounded-2xl border-0 px-6 py-12 text-center ${SOMBRA}`}>
      <I className="mx-auto size-8 text-[#B4B2C4]" aria-hidden />
      <p className="mt-2 font-semibold">{titulo}</p>
      <p className={`mt-1 text-sm ${GRIS}`}>{texto}</p>
    </Card>
  );
}

function Desglose({ filas, total, colores, vacio }: { filas: { nombre: string; monto: number }[]; total: number; colores: string[]; vacio: string }) {
  if (!total) return <p className={`mt-4 rounded-xl bg-[#F8F7FC] px-4 py-6 text-center text-sm ${GRIS}`}>{vacio}</p>;
  return (
    <>
      <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {filas.map((f, i) => (
          <span key={f.nombre} className={colores[i % colores.length]} style={{ width: `${(f.monto / total) * 100}%` }} />
        ))}
      </div>
      <table className="mt-3 w-full text-sm">
        <tbody className="divide-y divide-[#F3F1F8]">
          {filas.map((f, i) => (
            <tr key={f.nombre}>
              <td className="py-2.5">
                <span className="flex items-center gap-2">
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${colores[i % colores.length]}`} />
                  {f.nombre}
                </span>
              </td>
              <td className={`w-14 py-2.5 text-right text-xs tabular-nums ${GRIS}`}>{Math.round((f.monto / total) * 100)}%</td>
              <td className="w-28 py-2.5 text-right font-semibold tabular-nums">{clp(f.monto)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-[#E9E6F3]">
            <td className="pt-2.5 font-semibold">Total</td>
            <td />
            <td className="pt-2.5 text-right font-semibold tabular-nums">{clp(total)}</td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

type Barra = { etiqueta: string; detalle: string; ing: number | null; egr: number | null; mes?: string; /** El mes todavía no termina: sus barras son parciales. */ enCurso?: boolean };

function Grafico({ barras, onElegir }: { barras: Barra[]; onElegir?: (mes: string) => void }) {
  const tope = Math.max(100000, Math.ceil(Math.max(0, ...barras.map((b) => Math.max(b.ing ?? 0, b.egr ?? 0))) / 100000) * 100000);
  return (
    <div className="mt-6 flex gap-3">
      <div className={`flex h-[190px] flex-col justify-between pb-6 text-right text-[11px] tabular-nums ${GRIS}`}>
        <span>{corto(tope)}</span>
        <span>{corto(tope / 2)}</span>
        <span>0</span>
      </div>
      <div className="relative flex-1">
        <div aria-hidden className="absolute inset-x-0 top-[7px] border-t border-dashed border-[#ECEAF4]" />
        <div aria-hidden className="absolute inset-x-0 top-[87px] border-t border-dashed border-[#ECEAF4]" />
        <ul className="relative grid h-[190px] gap-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${barras.length}, minmax(0, 1fr))` }}>
          {barras.map((b) => {
            const vacio = b.ing == null;
            const clic = Boolean(onElegir && b.mes && !vacio);
            const Tag = clic ? "button" : "div";
            return (
              <li key={b.etiqueta + b.detalle} className="group flex flex-col items-center">
                <Tag
                  {...(clic ? { type: "button" as const, onClick: () => onElegir?.(b.mes!), "aria-label": `Ver ${b.detalle}` } : {})}
                  className={`relative flex w-full flex-1 items-end justify-center gap-[3px] rounded-t-lg border-b border-[#E4E1F0] pt-[7px] ${clic ? "cursor-pointer hover:bg-[#F4F1FF]" : ""}`}
                >
                  {vacio ? (
                    <span className={`mb-1 text-[10px] ${GRIS}`}>—</span>
                  ) : (
                    <>
                      <span className={`w-full max-w-[16px] rounded-t bg-[#2FB386] ${b.enCurso ? "opacity-45" : ""}`} style={{ height: `${((b.ing ?? 0) / tope) * 100}%` }} />
                      <span className={`w-full max-w-[16px] rounded-t bg-[#E8908E] ${b.enCurso ? "opacity-45" : ""}`} style={{ height: `${((b.egr ?? 0) / tope) * 100}%` }} />
                    </>
                  )}
                  <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg bg-[#15132B] px-2.5 py-1.5 text-left text-[11px] whitespace-nowrap text-white shadow-lg group-hover:block">
                    <span className="block font-semibold">{b.detalle}</span>
                    {b.enCurso ? <span className="block text-white/70">Mes en curso: aún incompleto</span> : null}
                    {vacio ? (
                      <span className="block text-white/70">Aún sin datos</span>
                    ) : (
                      <>
                        <span className="block">Ingresos {clp(b.ing ?? 0)}</span>
                        <span className="block">Egresos {clp(b.egr ?? 0)}</span>
                        {clic ? <span className="mt-0.5 block text-white/60">Clic para ver el mes</span> : null}
                      </>
                    )}
                  </span>
                </Tag>
                <span className={`mt-1.5 h-4 truncate text-[11px] ${GRIS}`}>{b.etiqueta}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Rendición de cuentas: las cuentas del comité de un mes, un trimestre, un semestre o un año para la asamblea. Se ve todo el
 * informe o una sola sección a la vez, y el PDF y el Excel llevan lo mismo que se ve.
 */
export function RendicionesVista({ inicial, hoy, seccionInicial = "todo" }: { inicial: DatosRendicion; hoy: string; seccionInicial?: SeccionRendicion }) {
  const [periodo, setPeriodo] = useState<PeriodoRendicion>(inicial.periodo);
  const [seccion, setSeccion] = useState<SeccionRendicion>(seccionInicial);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["rendicion", periodo.tipo, periodo.anio, periodo.numero],
    queryFn: () => consultarRendicion(periodo),
    initialData: mismo(periodo, inicial.periodo) ? inicial : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: INTERVALO_RAPIDO,
  });
  const d = data ?? inicial;
  const hayExtras = Boolean(inicial.activos || inicial.labores || inicial.incidentes);
  const hayInventario = Boolean(inicial.inventario);

  // Lo que el plan no incluye no se ofrece como sección.
  const secciones = SECCIONES_RENDICION.filter((s) => (s.id !== "inventario" || hayInventario) && (s.id !== "patrimonio" || hayExtras));
  const seccionVigente: SeccionRendicion = secciones.some((s) => s.id === seccion) ? seccion : "todo";
  const contenido: ContenidoRendicion = (() => {
    const c = contenidoDeSeccion(seccionVigente);
    return { ...c, inventario: c.inventario && hayInventario, extras: c.extras && hayExtras };
  })();

  function irA(p: PeriodoRendicion, s: SeccionRendicion = seccionVigente) {
    setPeriodo(p);
    setSeccion(s);
    window.history.replaceState(null, "", urlDe(p, s, contenidoDeSeccion(s), "/panel/rendiciones"));
  }
  function elegirSeccion(s: SeccionRendicion) {
    setSeccion(s);
    window.history.replaceState(null, "", urlDe(periodo, s, contenidoDeSeccion(s), "/panel/rendiciones"));
  }

  const siguiente = periodoVecino(periodo, 1);
  const haySiguiente = periodoYaEmpezo(siguiente, hoy);
  const rango = rangoDe(periodo);
  const titulo = rango.etiqueta;
  const subtitulo =
    periodo.tipo === "anio"
      ? "Enero a diciembre"
      : periodo.tipo === "mes"
        ? `Del ${fecha(d.desde)} al ${fecha(d.hasta)}`
        : `${mayuscula(nombreMes(rango.meses[0]).split(" ")[0])} a ${nombreMes(rango.meses[rango.meses.length - 1]).split(" ")[0]}`;

  const ing = d.resumen.totalIngresos;
  const egr = d.resumen.totalEgresos;
  const resultado = ing - egr;
  const ver = (s: SeccionRendicion) => seccionVigente === "todo" || seccionVigente === s;
  const verGrafico = seccionVigente === "todo" || seccionVigente === "saldos" || seccionVigente === "ingresos" || seccionVigente === "egresos";
  const pct = d.cobranza.emitido > 0 ? Math.min(100, Math.round((d.cobranza.pagado / d.cobranza.emitido) * 100)) : 0;

  // El gráfico: un mes se ve por semana; lo demás, mes a mes (un mes futuro queda sin datos) y al tocar uno se abre su rendición.
  const mesNombre = nombreMes(d.desde.slice(0, 7)).split(" ")[0];
  const barras: Barra[] =
    periodo.tipo === "mes" && d.semanas
      ? d.semanas.map((s) => ({ etiqueta: s.etiqueta, detalle: s.detalle, ing: s.ingresos, egr: s.egresos }))
      : d.resumen.meses.map((m) => {
          const futuro = `${m.mes}-01` > hoy;
          const n = Number(m.mes.slice(5, 7));
          // El mes en que estamos aún no termina: se dibuja más claro para que no parezca una caída.
          return { etiqueta: MES_CORTO[n - 1], detalle: `${mayuscula(nombreMes(m.mes))}`, ing: futuro ? null : m.ingresos, egr: futuro ? null : m.egresos, mes: m.mes, enCurso: d.enCurso && m.mes === hoy.slice(0, 7) };
        });

  // Qué tiene datos: lo vacío se avisa en una línea al final, y las secciones vacías se marcan en gris.
  const inv = d.inventario;
  const invConDatos = Boolean(inv && (inv.materiales.length > 0 || inv.stockBajo.length > 0));
  const activosConDatos = Boolean(d.activos && (d.activos.n > 0 || d.activos.comprados > 0));
  const laboresConDatos = Boolean(d.labores && d.labores.hechas + d.labores.programadas > 0);
  const fallasConDatos = Boolean(d.incidentes && d.incidentes.resueltos + d.incidentes.abiertos > 0);
  const patrimonioConDatos = activosConDatos || laboresConDatos || fallasConDatos;
  const comprasConDatos = d.compras.detalle.length > 0;
  const vacios = [...(hayInventario && !invConDatos ? ["Inventario"] : []), ...(hayExtras && !patrimonioConDatos ? ["Patrimonio y trabajos"] : []), ...(comprasConDatos ? [] : ["Compras"])];

  const filasCaja = [
    ...(d.saldoInicio !== null ? [{ s: "", t: `Saldo al ${fecha(d.desde)}`, v: d.saldoInicio, c: "", barra: "" }] : []),
    { s: "+", t: "Ingresos", v: ing, c: "text-[#075A3C]", barra: "bg-[#2FB386]" },
    { s: "−", t: "Egresos", v: egr, c: "text-[#A32020]", barra: "bg-[#E8908E]" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1376px]">
      <div>
        <h1 className="text-[24px] leading-tight font-semibold tracking-tight sm:text-[28px]">Rendición de cuentas</h1>
        <p className={`mt-0.5 text-[14px] sm:text-[15px] ${GRIS}`}>Estado financiero del comité para la asamblea</p>
      </div>

      {/* Barra de período + secciones */}
      <Card className={`mt-5 rounded-2xl border-0 ${SOMBRA}`}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <div role="radiogroup" aria-label="Agrupar por" className="grid grid-cols-4 rounded-lg bg-[#F4F3F9] p-1 sm:flex">
            {TIPOS_PERIODO.map((t) => (
              <button
                key={t.valor}
                type="button"
                role="radio"
                aria-checked={periodo.tipo === t.valor}
                onClick={() => irA(cambiarTipo(periodo, t.valor, hoy))}
                className={`h-8 rounded-md px-3 text-[13px] font-semibold ${periodo.tipo === t.valor ? "bg-white text-[#2A07A8] shadow-sm" : GRIS}`}
              >
                {t.texto}
              </button>
            ))}
          </div>
          <div className="flex h-10 items-center rounded-lg ring-1 ring-[#E4E1F0] sm:min-w-[260px]">
            <Button type="button" variant="ghost" size="icon" aria-label="Período anterior" onClick={() => irA(periodoVecino(periodo, -1))} className="size-10 rounded-lg">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-0 flex-1 text-center">
              <span className="block text-sm leading-tight font-semibold">{titulo}</span>
              <span className={`block text-[11px] leading-tight ${GRIS}`}>{subtitulo}</span>
            </span>
            <Button type="button" variant="ghost" size="icon" aria-label="Período siguiente" disabled={!haySiguiente} onClick={() => irA(siguiente)} className="size-10 rounded-lg">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <div className="min-w-0 flex-1 lg:hidden">
              <Select items={secciones.map((s) => ({ value: s.id, label: s.id === "todo" ? "Todo el informe" : s.nombre }))} value={seccionVigente} onValueChange={(v) => elegirSeccion((v ?? "todo") as SeccionRendicion)}>
                <SelectTrigger aria-label="Sección" className="h-10 w-full rounded-lg border-[#E4E1F0] px-3 font-semibold sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {secciones.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.id === "todo" ? "Todo el informe" : s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" aria-label="Descargar Excel" onClick={() => descargarExcel(d, contenido)} className="h-10 shrink-0 rounded-lg border-[#E4E1F0] bg-white px-3 font-semibold">
              <Download className="size-4" />
              <span className="hidden xl:inline">Excel</span>
            </Button>
            <Button render={<a href={urlDe(periodo, seccionVigente, contenido, "/panel/rendiciones/pdf")} target="_blank" rel="noopener noreferrer" />} nativeButton={false} aria-label="Descargar PDF" className="h-10 shrink-0 rounded-lg px-4 font-semibold">
              <FileText className="size-4" />
              PDF
            </Button>
          </div>
        </div>
        <nav aria-label="Secciones del informe" className="hidden gap-1 border-t border-[#F0EEF6] px-3 lg:flex">
          {secciones.map((s) => {
            const vacia = (s.id === "inventario" && !invConDatos) || (s.id === "patrimonio" && !patrimonioConDatos);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => elegirSeccion(s.id)}
                aria-current={seccionVigente === s.id ? "true" : undefined}
                className={`relative h-11 px-3 text-[13px] font-semibold transition-colors ${seccionVigente === s.id ? "text-[#2A07A8]" : vacia ? "text-[#A19FB2] hover:text-[#5B5970]" : `${GRIS} hover:text-[#15132B]`}`}
              >
                {s.nombre}
                {seccionVigente === s.id ? <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#3A0CE3]" /> : null}
              </button>
            );
          })}
          <span className={`ml-auto flex items-center gap-1.5 pr-2 text-xs ${GRIS}`}>
            {isFetching ? <Loader2 className="size-3.5 animate-spin" aria-label="Actualizando" /> : <Info className="size-3.5" aria-hidden />}
            El PDF y el Excel incluyen lo que ves
          </span>
        </nav>
      </Card>

      {isError ? (
        <p role="alert" className="mt-4 rounded-xl bg-[#FDECEC] px-4 py-3 text-sm font-medium text-[#A32020]">
          No pudimos cargar este período. Inténtalo otra vez.
        </p>
      ) : null}

      <div className={`mt-4 flex flex-col gap-4 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
        {/* Saldos */}
        {ver("saldos") ? (
          <Card className={`grid grid-cols-1 overflow-hidden rounded-2xl border-0 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] ${SOMBRA}`}>
            <div className="p-5 sm:p-6">
              <Encabezado titulo="Movimiento de caja" sub={`${titulo} · lo que había, lo que entró y lo que salió`} />
              <dl className="mt-4 text-[15px]">
                {filasCaja.map((f) => (
                  <div key={f.t} className="border-b border-[#F0EEF6] py-3.5 first:pt-1">
                    <div className="flex items-baseline gap-3">
                      <span aria-hidden className="w-4 text-center text-lg font-semibold text-[#A19FB2]">
                        {f.s}
                      </span>
                      <dt className={`flex-1 ${GRIS}`}>{f.t}</dt>
                      <dd className={`text-xl font-semibold whitespace-nowrap tabular-nums sm:text-[22px] ${f.c}`}>{clp(f.v)}</dd>
                    </div>
                    {f.barra ? (
                      <div className="mt-2 ml-7 h-1.5 overflow-hidden rounded-full bg-[#F1EFF7]">
                        <div className={`h-full rounded-full ${f.barra}`} style={{ width: `${(f.v / Math.max(ing, egr, 1)) * 100}%` }} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </dl>
              {ing > 0 ? <p className={`mt-3 pl-7 text-[13px] ${GRIS}`}>Por cada $100 que entraron, se gastaron ${Math.round((egr / ing) * 100)}.</p> : null}
            </div>
            <div className="relative flex flex-col justify-center overflow-hidden bg-[#2A0FB0] p-6 text-white sm:p-7">
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_80%_90%_at_100%_0%,#5B3CF0_0%,transparent_60%)]" />
              <div aria-hidden className="absolute -top-12 -right-12 size-48 rounded-full border border-white/10" />
              <div className="relative">
                {d.saldoCierre !== null ? (
                  <>
                    <p className="text-sm text-white/75">Saldo al {fecha(d.hasta)}</p>
                    <p className="mt-2 text-[34px] leading-none font-semibold tracking-tight whitespace-nowrap tabular-nums lg:text-[40px]">{clp(d.saldoCierre)}</p>
                    <p className="mt-2 text-sm text-white/75">{d.enCurso ? "Lo que el comité tiene hoy en caja y banco" : "Lo que quedó al cierre del período"}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-white/75">Resultado del período</p>
                    <p className="mt-2 text-[34px] leading-none font-semibold tracking-tight whitespace-nowrap tabular-nums lg:text-[40px]">{(resultado > 0 ? "+" : "") + clp(resultado)}</p>
                    <p className="mt-2 text-sm text-white/75">{resultado >= 0 ? "Entró más de lo que salió" : "Salió más de lo que entró"}</p>
                  </>
                )}
                {d.saldoCierre !== null ? (
                  <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold ring-1 ring-white/20 ring-inset">
                    <span aria-hidden className={`size-1.5 rounded-full ${resultado >= 0 ? "bg-[#7CF0C4]" : "bg-[#FF9C9A]"}`} />
                    {resultado >= 0 ? "Superávit" : "Déficit"} del período {resultado >= 0 ? "+" : "−"}
                    {clp(Math.abs(resultado))}
                  </span>
                ) : null}
              </div>
            </div>
          </Card>
        ) : null}

        {/* Gráfico + cobranza */}
        {verGrafico || ver("cobranza") ? (
          <div className={`grid grid-cols-1 gap-4 ${verGrafico && ver("cobranza") ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
            {verGrafico ? (
              <Card className={`rounded-2xl border-0 p-5 sm:p-6 ${SOMBRA}`}>
                <Encabezado
                  titulo={periodo.tipo === "mes" ? `Ingresos y egresos de ${mesNombre}, por semana` : "Ingresos y egresos por mes"}
                  sub={periodo.tipo === "mes" ? "Muestra en qué semanas entró y salió la plata" : "Toca un mes para ver su rendición"}
                  accion={
                    <span className="flex shrink-0 items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#2FB386]" />
                        Ingresos
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#E8908E]" />
                        Egresos
                      </span>
                    </span>
                  }
                />
                <Grafico barras={barras} onElegir={periodo.tipo === "mes" ? undefined : (mes) => irA({ tipo: "mes", anio: Number(mes.slice(0, 4)), numero: Number(mes.slice(5, 7)) })} />
                {periodo.tipo === "mes" ? (
                  <button type="button" onClick={() => irA({ tipo: "anio", anio: periodo.anio, numero: 1 })} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#2A07A8] hover:underline">
                    <ChevronLeft className="size-3.5" aria-hidden />
                    Volver al año completo
                  </button>
                ) : null}
              </Card>
            ) : null}
            {ver("cobranza") ? (
              <Card className={`flex flex-col rounded-2xl border-0 p-5 sm:p-6 ${SOMBRA}`}>
                <Encabezado titulo="Cobranza" sub={`${d.cobranza.boletas} boletas emitidas en el período`} accion={<Enlace href="/panel/pagos">Morosos</Enlace>} />
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="text-[30px] leading-none font-semibold tabular-nums">{pct}%</span>
                  <span className={`text-sm ${GRIS}`}>de lo emitido está pagado</span>
                </p>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#FDEFEF]">
                  <div className="h-full rounded-full bg-[#2FB386]" style={{ width: `${pct}%` }} />
                </div>
                <dl className="mt-4 flex flex-col gap-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className={GRIS}>Emitido</dt>
                    <dd className="font-semibold tabular-nums">{clp(d.cobranza.emitido)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className={GRIS}>Pagado</dt>
                    <dd className="font-semibold text-[#075A3C] tabular-nums">{clp(d.cobranza.pagado)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-[#F0EEF6] pt-2.5">
                    <dt className={GRIS}>Deuda total de socios hoy</dt>
                    <dd className="text-right">
                      <span className="block font-semibold text-[#A32020] tabular-nums">{clp(d.cobranza.deudaTotal)}</span>
                      {d.cobranza.sociosConDeuda > 0 ? (
                        <span className={`text-xs ${GRIS}`}>
                          {d.cobranza.sociosConDeuda} {d.cobranza.sociosConDeuda === 1 ? "socio" : "socios"}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* Ingresos / Egresos */}
        {ver("ingresos") || ver("egresos") ? (
          <div className={`grid grid-cols-1 gap-4 ${seccionVigente === "todo" ? "md:grid-cols-2" : ""}`}>
            {ver("ingresos") ? (
              <Card className={`rounded-2xl border-0 p-5 sm:p-6 ${SOMBRA}`}>
                <Encabezado titulo="De dónde vino la plata" sub="Ingresos por concepto" accion={<span className="text-lg font-semibold text-[#075A3C] tabular-nums">{clp(ing)}</span>} />
                <Desglose filas={d.ingresos} total={ing} colores={COL_ING} vacio="Sin ingresos en el período." />
              </Card>
            ) : null}
            {ver("egresos") ? (
              <Card className={`rounded-2xl border-0 p-5 sm:p-6 ${SOMBRA}`}>
                <Encabezado titulo="En qué se gastó" sub="Egresos por concepto" accion={<span className="text-lg font-semibold text-[#A32020] tabular-nums">{clp(egr)}</span>} />
                <Desglose filas={d.egresos} total={egr} colores={COL_EGR} vacio="Sin egresos en el período." />
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* Compras */}
        {ver("compras") ? (
          comprasConDatos ? (
            <Card className={`overflow-hidden rounded-2xl border-0 ${SOMBRA}`}>
              <div className="p-5 pb-4 sm:px-6">
                <Encabezado
                  titulo="Compras"
                  sub={`${d.compras.detalle.length} ${d.compras.detalle.length === 1 ? "compra" : "compras"} · ${clp(d.compras.total)} · ${d.compras.porPagar > 0 ? `${clp(d.compras.porPagar)} por pagar` : "ya incluidas en egresos"}`}
                  accion={<Enlace href="/panel/compras">Ver compras</Enlace>}
                />
              </div>
              <div className={`hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1.2fr)_120px] gap-4 border-y border-[#F3F1F8] bg-[#FAFAFD] px-6 py-2.5 text-xs font-medium sm:grid ${GRIS}`}>
                <span>Fecha</span>
                <span>Proveedor</span>
                <span>Detalle</span>
                <span className="text-right">Monto</span>
              </div>
              <ul className="divide-y divide-[#F3F1F8] border-t border-[#F3F1F8] sm:border-t-0">
                {d.compras.detalle.map((c) => {
                  const detalle = c.items.length > 0 ? c.items.map((it) => `${Number.isInteger(it.cantidad) ? it.cantidad : String(it.cantidad).replace(".", ",")} × ${it.descripcion}`).join(", ") : c.documento || "Sin detalle";
                  return (
                    <li key={c.numero} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3 text-sm sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1.2fr)_120px] sm:px-6">
                      <span className={`hidden tabular-nums sm:block ${GRIS}`}>{fecha(c.fecha)}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-semibold">
                          <ShoppingCart className="size-4 shrink-0 text-[#6B46F5] sm:hidden" aria-hidden />
                          <span className="truncate">{c.proveedor}</span>
                        </span>
                        <span className={`block text-xs sm:hidden ${GRIS}`}>
                          {fecha(c.fecha)} · {detalle}
                        </span>
                      </span>
                      <span className={`hidden truncate sm:block ${GRIS}`} title={detalle}>
                        {detalle}
                      </span>
                      <span className="text-right font-semibold tabular-nums">{clp(c.total)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : seccionVigente === "compras" ? (
            <Vacio icono={ShoppingCart} titulo="Sin compras en el período" texto={`No se registraron compras en ${titulo.toLowerCase()}.`} />
          ) : null
        ) : null}

        {/* Inventario */}
        {ver("inventario") && inv && invConDatos ? (
          <Card className={`overflow-hidden rounded-2xl border-0 ${SOMBRA}`}>
            <div className="p-5 pb-4 sm:px-6">
              <Encabezado
                titulo="Inventario"
                sub={`${inv.materiales.length} ${inv.materiales.length === 1 ? "material" : "materiales"} con movimientos${inv.stockBajo.length > 0 ? ` · ${inv.stockBajo.length} con poco stock hoy` : ""}`}
                accion={<Enlace href="/panel/inventario">Ver inventario</Enlace>}
              />
            </div>
            {inv.materiales.length > 0 ? (
              <>
                <div className={`hidden grid-cols-[minmax(0,1fr)_120px_120px] gap-4 border-y border-[#F3F1F8] bg-[#FAFAFD] px-6 py-2.5 text-xs font-medium sm:grid ${GRIS}`}>
                  <span>Material</span>
                  <span className="text-right">Entró</span>
                  <span className="text-right">Salió</span>
                </div>
                <ul className="divide-y divide-[#F3F1F8] border-t border-[#F3F1F8] sm:border-t-0">
                  {inv.materiales.map((m) => (
                    <li key={`${m.nombre}${m.unidad}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:px-6">
                      <span className="min-w-0 truncate font-semibold">{m.nombre}</span>
                      <span className="text-right tabular-nums">{m.entradas > 0 ? `${formatoCantidad(m.entradas)} ${unidadCorta(m.unidad)}` : "-"}</span>
                      <span className="text-right tabular-nums">{m.salidas > 0 ? `${formatoCantidad(m.salidas)} ${unidadCorta(m.unidad)}` : "-"}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {inv.stockBajo.length > 0 ? (
              <div className="border-t border-[#F3F1F8] px-5 py-4 sm:px-6">
                <p className={`text-xs font-medium ${GRIS}`}>Con poco stock hoy</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {inv.stockBajo.map((m) => (
                    <li key={`${m.nombre}${m.unidad}`} className="rounded-full bg-[#FFF3E0] px-2.5 py-1 text-xs font-medium text-[#8A4B00]">
                      {m.nombre}: quedan {formatoCantidad(m.stock)} {unidadCorta(m.unidad)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        ) : null}
        {seccionVigente === "inventario" && !invConDatos ? <Vacio icono={Boxes} titulo="Sin movimientos de inventario" texto="No hubo entradas ni salidas de materiales en el período." /> : null}

        {/* Patrimonio y trabajos */}
        {ver("patrimonio") && patrimonioConDatos ? (
          <Card className={`rounded-2xl border-0 p-5 sm:p-6 ${SOMBRA}`}>
            <Encabezado titulo="Patrimonio y trabajos" sub="Lo que tiene el comité y lo que se hizo en el período" />
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
              {activosConDatos && d.activos ? (
                <>
                  <div>
                    <dt className={GRIS}>Bienes vigentes</dt>
                    <dd className="mt-0.5 text-xl font-semibold tabular-nums">{d.activos.n}</dd>
                  </div>
                  <div>
                    <dt className={GRIS}>Valor actual</dt>
                    <dd className="mt-0.5 text-xl font-semibold tabular-nums">{clp(d.activos.valorTotal)}</dd>
                  </div>
                  {d.activos.comprados > 0 ? (
                    <div>
                      <dt className={GRIS}>Bienes comprados</dt>
                      <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                        {d.activos.comprados}
                        <span className={`ml-1.5 text-sm font-medium ${GRIS}`}>{clp(d.activos.costoComprados)}</span>
                      </dd>
                    </div>
                  ) : null}
                </>
              ) : null}
              {laboresConDatos && d.labores ? (
                <div>
                  <dt className={GRIS}>Labores realizadas</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                    {d.labores.hechas}
                    {d.labores.programadas > 0 ? <span className={`ml-1.5 text-sm font-medium ${GRIS}`}>{d.labores.programadas} programadas</span> : null}
                  </dd>
                </div>
              ) : null}
              {fallasConDatos && d.incidentes ? (
                <div>
                  <dt className={GRIS}>Fallas resueltas</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                    {d.incidentes.resueltos}
                    {d.incidentes.abiertos > 0 ? <span className={`ml-1.5 text-sm font-medium ${GRIS}`}>{d.incidentes.abiertos} abiertas</span> : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>
        ) : null}
        {seccionVigente === "patrimonio" && !patrimonioConDatos ? <Vacio icono={Landmark} titulo="Sin movimientos de patrimonio" texto="Sin bienes nuevos, labores ni fallas registradas en el período." /> : null}

        {seccionVigente === "todo" && vacios.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-[#D9D5EA] bg-white/50 px-5 py-3.5 text-sm">
            <Info className="size-4 shrink-0 text-[#8A8799]" aria-hidden />
            <span className={GRIS}>Sin movimientos en el período:</span>
            {vacios.map((v) => (
              <span key={v} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#46435C] ring-1 ring-[#E9E6F3]">
                {v}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
