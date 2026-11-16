"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CalendarCheck, Check, Clock3, Download, HeartPulse, Palmtree, Paperclip, Plus, Printer, Search, type LucideIcon } from "lucide-react";
import { adjuntarLicencia, cambiarEstadoAusencia } from "@/app/panel/ausencias/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AusenciaDialog } from "@/components/panel/ausencia-dialog";
import { MotivoRechazoDialog } from "@/components/panel/motivo-rechazo-dialog";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { type AusenciaFila, type EstadoAusencia } from "@/lib/rrhh-comun";
import { CLASES, claseDe, cruces, type ClaseAusencia, type SaldoVacaciones } from "@/lib/ausencias-clases";
import { cn } from "@/lib/utils";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DSEM = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const aFecha = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const cl = (s: string) => s.split("-").reverse().slice(0, 2).join("-");
const diaSiguiente = (s: string) => {
  const f = aFecha(s);
  f.setDate(f.getDate() + 1);
  return `${String(f.getDate()).padStart(2, "0")}-${String(f.getMonth() + 1).padStart(2, "0")}`;
};
const numero = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
const rango = (a: Pick<AusenciaFila, "desde" | "hasta">) => (a.desde === a.hasta ? cl(a.desde) : `${cl(a.desde)} al ${cl(a.hasta)}`);

const COLUMNAS: { estado: EstadoAusencia; titulo: string; punto: string; vacio: string }[] = [
  { estado: "SOLICITADA", titulo: "Solicitadas", punto: "bg-[#F0A23C]", vacio: "Nada por aprobar" },
  { estado: "APROBADA", titulo: "Aprobadas", punto: "bg-[#2FB386]", vacio: "Sin registros aprobados" },
  { estado: "RECHAZADA", titulo: "Rechazadas", punto: "bg-[#E5484D]", vacio: "Sin registros rechazados" },
];

export type { SaldoVacaciones };

/** Una fecha como mini calendario: mes, día y día de la semana. */
function Fecha({ f }: { f: string }) {
  const d = aFecha(f);
  return (
    <span className="flex w-[42px] shrink-0 flex-col items-center overflow-hidden rounded-md bg-white text-center shadow-[0_1px_2px_rgba(21,19,43,0.06)] ring-1 ring-[#ECEAF4]">
      <span className="block w-full bg-[#F1EEFD] text-[9px] leading-4 font-bold text-[#2A07A8] uppercase">{MESES[d.getMonth()].slice(0, 3)}</span>
      <span className="block text-[15px] leading-5 font-semibold tabular-nums">{d.getDate()}</span>
      <span className={`block pb-0.5 text-[9px] leading-3 ${GRIS}`}>{DSEM[d.getDay()]}</span>
    </span>
  );
}

/** El texto del saldo de una persona: de dónde sale su número. */
function lineaSaldo(p: SaldoVacaciones, pedidos: number) {
  if (p.saldo === null) return "Falta su fecha de ingreso en Personal.";
  if ((p.ganados ?? 0) === 0 && p.tomados === 0) return p.desde ? `Podrá tomarlas desde ${p.desde.split("-").reverse().join("-")}` : "Aún no tiene días";
  if ((p.ganados ?? 0) === 0) return `Tomó ${numero(p.tomados)} antes de cumplir el año`;
  if (p.delAnio !== null && p.acumulados !== null && p.usadosPeriodo !== null) {
    return `${p.delAnio} del año ${p.acumulados >= 0 ? "+" : "–"} ${numero(Math.abs(p.acumulados))} ${p.acumulados >= 0 ? "acumulados" : "de años anteriores"} – ${numero(p.usadosPeriodo)} usados`;
  }
  return pedidos ? `${numero(p.saldo)} días · ${pedidos} solicitados` : `${numero(p.saldo)} días disponibles`;
}

/**
 * Vacaciones (con permisos) o licencias médicas del personal. En vacaciones se ve además el saldo de
 * cada persona: lo que ganó desde su ingreso menos lo que ya tomó.
 */
export function AusenciasVista({
  tipo,
  ausencias,
  ajenas = [],
  personas,
  saldos,
}: {
  tipo: "VACACIONES" | "LICENCIA";
  ausencias: AusenciaFila[];
  /** Las ausencias del otro módulo (licencias en Vacaciones y al revés): solo sirven para avisar de cruces. */
  ajenas?: AusenciaFila[];
  personas: { id: string; nombre: string }[];
  /** Solo en vacaciones. */
  saldos?: SaldoVacaciones[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [fTipo, setFTipo] = useState<"todos" | ClaseAusencia>("todos");
  const [fPersona, setFPersona] = useState("todos");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<AusenciaFila | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<EstadoAusencia | null>(null);
  // Al rechazar o anular se pide el motivo antes de mover la tarjeta.
  const [rechazando, setRechazando] = useState<{ a: AusenciaFila; anular: boolean } | null>(null);
  // El estado se ve cambiar al instante; si el servidor falla, se vuelve atrás.
  const [movidas, setMovidas] = useState<Record<string, EstadoAusencia>>({});
  const [, iniciar] = useTransition();
  const archivoRef = useRef<HTMLInputElement>(null);
  const [adjuntandoA, setAdjuntandoA] = useState<string | null>(null);
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
    // Lo que se editó en el diálogo manda sobre lo que se movió antes en el tablero.
    setMovidas({});
  }, []);
  const cerrarMotivo = useCallback(() => setRechazando(null), []);

  const estadoDe = (a: AusenciaFila) => movidas[a.id] ?? a.estado;
  const todasConEstado = [...ausencias, ...ajenas].map((a) => ({ ...a, estado: estadoDe(a) }));

  function aplicar(a: AusenciaFila, destino: EstadoAusencia, motivo?: string) {
    const origen = estadoDe(a);
    setMovidas((m) => ({ ...m, [a.id]: destino }));
    iniciar(async () => {
      const r = await cambiarEstadoAusencia(a.id, destino, motivo);
      if (!r.ok) {
        toast.error(r.error);
        setMovidas((m) => ({ ...m, [a.id]: origen }));
      }
    });
  }

  function mover(a: AusenciaFila, destino: EstadoAusencia) {
    const origen = estadoDe(a);
    if (origen === destino) return;
    // Rechazar o anular pide el motivo; el resto cambia al instante.
    if (destino === "RECHAZADA") {
      setRechazando({ a, anular: origen === "APROBADA" });
      return;
    }
    aplicar(a, destino);
  }

  function elegirArchivo(a: AusenciaFila) {
    setAdjuntandoA(a.id);
    archivoRef.current?.click();
  }

  function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    const id = adjuntandoA;
    e.target.value = "";
    setAdjuntandoA(null);
    if (!archivo || !id) return;
    const datos = new FormData();
    datos.set("archivo", archivo);
    iniciar(async () => {
      const r = await adjuntarLicencia(id, datos);
      if (r.ok) toast.success("Licencia adjuntada");
      else toast.error(r.error);
    });
  }

  const hoy = hoyEnChile();
  const anio = hoy.slice(0, 4);
  const esLicencia = tipo === "LICENCIA";
  const vigentes = ausencias.filter((a) => estadoDe(a) === "APROBADA" && a.desde <= hoy && a.hasta >= hoy);
  const solicitadas = ausencias.filter((a) => estadoDe(a) === "SOLICITADA").length;
  const diasAnio = ausencias.filter((a) => estadoDe(a) === "APROBADA" && a.desde.startsWith(anio) && (esLicencia || a.tipo === "VACACIONES")).reduce((s, a) => s + a.dias, 0);

  const q = busqueda.trim().toLowerCase();
  const filtradas = ausencias.filter(
    (a) =>
      (fTipo === "todos" || claseDe(a) === fTipo) &&
      (fPersona === "todos" || a.trabajadorId === fPersona) &&
      (!q || a.trabajador.toLowerCase().includes(q) || (a.detalle ?? "").toLowerCase().includes(q) || (a.nota ?? "").toLowerCase().includes(q) || (a.motivoRechazo ?? "").toLowerCase().includes(q))
  );

  const conSaldos = !esLicencia && saldos && saldos.length > 0;
  const saldoDe = (id: string) => saldos?.find((s) => s.id === id)?.saldo ?? null;
  const pedidos = (id: string) => ausencias.filter((a) => a.trabajadorId === id && estadoDe(a) === "SOLICITADA" && a.tipo === "VACACIONES").reduce((s, a) => s + a.dias, 0);
  const clasesFiltro: ClaseAusencia[] = esLicencia ? [] : ["VACACIONES", "CON_GOCE", "SIN_GOCE"];

  function exportar() {
    const celda = (t: string | number) => `"${String(t).replace(/"/g, '""')}"`;
    const estados = { SOLICITADA: "Solicitada", APROBADA: "Aprobada", RECHAZADA: "Rechazada" } as const;
    const filas: (string | number)[][] = [
      ["Persona", "Tipo", "Desde", "Hasta", esLicencia ? "Días corridos" : "Días hábiles", "Horas", "Estado", "Detalle", "Nota", "Motivo del rechazo"],
      ...filtradas.map((a) => [a.trabajador, CLASES[claseDe(a)].texto, a.desde.split("-").reverse().join("-"), a.hasta.split("-").reverse().join("-"), a.horas != null ? "" : a.dias, a.horas ?? "", estados[estadoDe(a)], a.detalle ?? "", a.nota ?? "", a.motivoRechazo ?? ""]),
    ];
    const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `${esLicencia ? "licencias" : "vacaciones-y-permisos"}-${hoy}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  const kpis: { clave: string; titulo: string; corto: string; valor: string; detalle: string; icono: LucideIcon; color: string }[] = [
    {
      clave: "hoy",
      titulo: esLicencia ? "Con licencia hoy" : "De vacaciones hoy",
      corto: "Fuera hoy",
      valor: String(vigentes.length),
      detalle: vigentes.length ? [...new Set(vigentes.map((a) => a.trabajador.split(" ")[0]))].join(", ") : "Todos trabajando",
      icono: esLicencia ? HeartPulse : Palmtree,
      color: "bg-[#E6F6EF] text-[#0A7A52]",
    },
    {
      clave: "anio",
      titulo: esLicencia ? `Días de licencia en ${anio}` : `Días tomados en ${anio}`,
      corto: `Días en ${anio}`,
      valor: String(diasAnio),
      detalle: esLicencia ? "días corridos" : "días hábiles de vacaciones",
      icono: CalendarCheck,
      color: "bg-[#ECE8FD] text-[#3A0CE3]",
    },
    { clave: "aprobar", titulo: "Por aprobar", corto: "Por aprobar", valor: String(solicitadas), detalle: solicitadas ? "Esperan tu respuesta" : "Al día", icono: Clock3, color: "bg-[#FFF3E0] text-[#B86400]" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1376px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[28px]">{esLicencia ? "Licencias" : "Vacaciones"}</h1>
          <p className={`mt-0.5 text-[15px] ${GRIS}`}>{esLicencia ? "Las licencias médicas del personal, con su folio y sus fechas." : "Las vacaciones y permisos del personal, y cuántos días le quedan a cada uno."}</p>
        </div>
        {personas.length > 0 ? (
          <Button data-tour="aus-nueva" onClick={() => setCreando(true)} className="h-10 shrink-0 rounded-lg px-4 font-semibold">
            <Plus />
            {esLicencia ? "Nueva licencia" : "Vacaciones o permiso"}
          </Button>
        ) : null}
      </div>

      <div data-tour="aus-kpis" className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
        {kpis.map((k) => {
          const I = k.icono;
          return (
            <Card key={k.clave} className={`flex items-center gap-4 rounded-2xl border-0 p-4 sm:p-5 ${SOMBRA}`}>
              <span aria-hidden className={`hidden size-12 shrink-0 items-center justify-center rounded-2xl sm:flex ${k.color}`}>
                <I className="size-6" />
              </span>
              <div className="min-w-0">
                <p className={`truncate text-[13px] ${GRIS}`}>
                  <span className="sm:hidden">{k.corto}</span>
                  <span className="hidden sm:inline">{k.titulo}</span>
                </p>
                <p className="mt-0.5 text-[26px] leading-none font-semibold tabular-nums">{k.valor}</p>
                <p className={`mt-1 hidden truncate text-xs sm:block ${GRIS}`}>{k.detalle}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {personas.length === 0 ? (
        <Card className={`mt-4 rounded-2xl border-0 px-6 py-14 text-center ${SOMBRA}`}>
          <p className="text-lg font-semibold">Primero agrega personas en Personal</p>
        </Card>
      ) : (
        <div className={cn("mt-4 grid grid-cols-1 items-start gap-4", conSaldos && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
          <div className="min-w-0">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative lg:w-[260px]">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input aria-label="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por persona o detalle" className="h-10 rounded-lg border-[#E4E1F0] bg-white pl-9 shadow-none" />
              </div>
              <div className="flex gap-2">
                {clasesFiltro.length > 0 ? (
                  <Select items={[{ value: "todos", label: "Todos los tipos" }, ...clasesFiltro.map((c) => ({ value: c, label: CLASES[c].texto }))]} value={fTipo} onValueChange={(v) => setFTipo((v ?? "todos") as "todos" | ClaseAusencia)}>
                    <SelectTrigger aria-label="Tipo" className="h-10 min-w-0 flex-1 rounded-lg border-[#E4E1F0] bg-white px-3 shadow-none lg:w-[170px] lg:flex-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los tipos</SelectItem>
                      {clasesFiltro.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CLASES[c].texto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Select items={[{ value: "todos", label: "Todo el personal" }, ...personas.map((p) => ({ value: p.id, label: p.nombre }))]} value={fPersona} onValueChange={(v) => setFPersona(v ?? "todos")}>
                  <SelectTrigger aria-label="Persona" className="h-10 min-w-0 flex-1 rounded-lg border-[#E4E1F0] bg-white px-3 shadow-none lg:w-[180px] lg:flex-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todo el personal</SelectItem>
                    {personas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" aria-label="Exportar a Excel" title="Exportar a Excel" disabled={filtradas.length === 0} onClick={exportar} className="size-10 shrink-0 rounded-lg border-[#E4E1F0] bg-white">
                  <Download className="size-4" />
                </Button>
              </div>
              <p className={`hidden text-xs xl:ml-auto xl:block ${GRIS}`}>Arrastra las tarjetas entre columnas o usa sus botones</p>
            </div>

            <input ref={archivoRef} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={subirArchivo} />

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {COLUMNAS.map((col) => {
                const items = filtradas.filter((a) => estadoDe(a) === col.estado).sort((a, b) => (col.estado === "SOLICITADA" ? a.desde.localeCompare(b.desde) : b.desde.localeCompare(a.desde)));
                const arrastrada = ausencias.find((a) => a.id === arrastrando);
                const activo = sobre === col.estado && arrastrada !== undefined && estadoDe(arrastrada) !== col.estado;
                return (
                  <section
                    key={col.estado}
                    aria-label={col.titulo}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setSobre(col.estado);
                    }}
                    onDragLeave={() => setSobre((s) => (s === col.estado ? null : s))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const reg = ausencias.find((a) => a.id === arrastrando);
                      if (reg) mover(reg, col.estado);
                      setArrastrando(null);
                      setSobre(null);
                    }}
                    className={`flex min-h-[220px] flex-col rounded-2xl p-2 transition-colors ${activo ? "bg-[#ECE8FD] ring-2 ring-[#A895F8] ring-dashed" : "bg-white/60 ring-1 ring-[#E9E6F3]"}`}
                  >
                    <div className="flex items-center gap-2 px-2 pt-1.5 pb-2">
                      <span aria-hidden className={`size-2 rounded-full ${col.punto}`} />
                      <h2 className="flex-1 text-[14px] font-semibold">{col.titulo}</h2>
                      <span className={`rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-[#E9E6F3] ${GRIS}`}>{items.length}</span>
                    </div>
                    <ul className="flex flex-1 flex-col gap-2">
                      {items.map((a) => {
                        const clase = CLASES[claseDe(a)];
                        const TI = clase.icono;
                        const porHoras = a.horas != null;
                        const saldo = saldoDe(a.trabajadorId);
                        const sinSaldo = a.tipo === "VACACIONES" && saldo !== null && saldo < a.dias;
                        const enCurso = col.estado === "APROBADA" && a.desde <= hoy && a.hasta >= hoy;
                        const choques = col.estado === "SOLICITADA" ? cruces(a, todasConEstado) : [];
                        return (
                          <li
                            key={a.id}
                            draggable
                            onDragStart={() => setArrastrando(a.id)}
                            onDragEnd={() => {
                              setArrastrando(null);
                              setSobre(null);
                            }}
                            onClick={() => setEditando(a)}
                            className={`cursor-grab overflow-hidden rounded-xl bg-white shadow-[0_1px_3px_rgba(21,19,43,0.08)] ring-1 ring-[#EFEDF6] transition-opacity active:cursor-grabbing ${arrastrando === a.id ? "opacity-40" : ""} ${col.estado === "RECHAZADA" ? "opacity-90" : ""}`}
                          >
                            <div className="flex items-center gap-2.5 px-3.5 pt-3.5">
                              <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${clase.suave} ${clase.tinte}`}>
                                <TI className="size-[18px]" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{a.trabajador}</p>
                                <p className={`truncate text-xs font-medium ${clase.tinte}`}>{clase.texto}</p>
                              </div>
                            </div>
                            <div className="mx-3.5 mt-3 flex items-center gap-2 rounded-lg bg-[#F8F7FC] px-2.5 py-2">
                              <Fecha f={a.desde} />
                              {a.desde !== a.hasta ? (
                                <>
                                  <ArrowRight className="size-3.5 shrink-0 text-[#A19FB2]" aria-hidden />
                                  <Fecha f={a.hasta} />
                                </>
                              ) : null}
                              <span className="ml-auto text-right">
                                <span className="block text-[17px] leading-none font-semibold tabular-nums">{porHoras ? numero(a.horas as number) : a.dias}</span>
                                <span className={`text-[10px] ${GRIS}`}>{porHoras ? ((a.horas as number) === 1 ? "hora" : "horas") : esLicencia ? `día${a.dias === 1 ? "" : "s"} corrido${a.dias === 1 ? "" : "s"}` : `día${a.dias === 1 ? "" : "s"} hábil${a.dias === 1 ? "" : "es"}`}</span>
                              </span>
                            </div>
                            <div className="px-3.5 pt-2 pb-3.5">
                              {a.detalle || a.nota ? <p className={`truncate text-xs italic ${GRIS}`}>“{a.detalle || a.nota}”</p> : null}

                              {a.tipo === "LICENCIA" && col.estado !== "RECHAZADA" ? (
                                a.adjuntoId ? (
                                  <a href={`/panel/ausencias/adjunto/${a.adjuntoId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#075A3C] hover:underline">
                                    <Paperclip className="size-3.5" aria-hidden />
                                    Licencia adjunta
                                  </a>
                                ) : (
                                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[#8A4B00]">
                                    <Paperclip className="size-3.5" aria-hidden />
                                    Falta la licencia ·{" "}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        elegirArchivo(a);
                                      }}
                                      className="underline underline-offset-2 hover:no-underline"
                                    >
                                      adjuntar
                                    </button>
                                  </p>
                                )
                              ) : null}

                              {enCurso ? <p className="mt-1 text-xs font-medium text-[#0B5E94]">En curso · vuelve el {diaSiguiente(a.hasta)}</p> : null}

                              {col.estado === "SOLICITADA" ? (
                                <>
                                  {choques.length > 0 ? (
                                    <p className="mt-1 flex items-start gap-1 text-xs font-medium text-[#8A4B00]">
                                      <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                                      Se cruza con {choques.map((c) => `${c.trabajador.split(" ")[0]} (${rango(c)})`).join(" y ")}
                                    </p>
                                  ) : null}
                                  {a.tipo === "VACACIONES" && saldo !== null ? (
                                    <p className={`mt-1 text-xs ${sinSaldo ? "font-medium text-[#A32020]" : "text-[#075A3C]"}`}>{sinSaldo ? "No le alcanzan los días" : `Le quedarían ${numero(saldo - a.dias)} de ${numero(saldo)} días`}</p>
                                  ) : null}
                                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        mover(a, "RECHAZADA");
                                      }}
                                      className="h-8 rounded-lg border-[#E4E1F0] text-xs font-semibold text-[#A32020] hover:bg-[#FDF3F3] hover:text-[#A32020]"
                                    >
                                      Rechazar
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        mover(a, "APROBADA");
                                      }}
                                      className="h-8 rounded-lg text-xs font-semibold"
                                    >
                                      <Check className="size-3.5" />
                                      Aprobar
                                    </Button>
                                  </div>
                                </>
                              ) : null}

                              {col.estado === "APROBADA" ? (
                                <div className="mt-3 flex items-center justify-between border-t border-[#F3F1F8] pt-2.5">
                                  <a href={`/panel/ausencias/comprobante/${a.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#46435C] hover:text-[#15132B]">
                                    <Printer className="size-4" aria-hidden />
                                    Comprobante
                                  </a>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      mover(a, "RECHAZADA");
                                    }}
                                    className="text-[13px] font-semibold text-[#A32020] hover:underline"
                                  >
                                    Anular
                                  </button>
                                </div>
                              ) : null}

                              {col.estado === "RECHAZADA" ? (
                                <>
                                  {a.motivoRechazo ? (
                                    <p className="mt-2 rounded-lg bg-[#FDEFEF] px-2.5 py-1.5 text-xs text-[#A32020]">
                                      <b className="font-semibold">Motivo:</b> {a.motivoRechazo}
                                    </p>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      aplicar(a, "SOLICITADA");
                                    }}
                                    className="mt-2 text-[13px] font-semibold text-[#2A07A8] hover:underline"
                                  >
                                    Volver a revisar
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                      {items.length === 0 ? (
                        <li className={`flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#DCD8EA] px-4 py-8 text-center text-[13px] ${GRIS}`}>{activo ? "Suelta aquí" : col.vacio}</li>
                      ) : null}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>

          {conSaldos && saldos ? (
            <Card data-tour="aus-saldo" aria-label="Saldo de vacaciones" className={`rounded-2xl border-0 p-5 ${SOMBRA}`}>
              <h2 className="text-[15px] font-semibold">Saldo de vacaciones</h2>
              <p className={`text-xs ${GRIS}`}>15 días hábiles por cada año cumplido</p>
              <ul className="mt-4 flex flex-col divide-y divide-[#F3F1F8]">
                {saldos.map((p) => {
                  const ped = pedidos(p.id);
                  // Sin días que mostrar: falta su ingreso, o aún no cumple el primer año y no ha tomado nada.
                  const sinDatos = p.saldo === null || ((p.ganados ?? 0) === 0 && p.tomados === 0);
                  const saldo = p.saldo ?? 0;
                  const total = 15;
                  const r = 18;
                  const c = 2 * Math.PI * r;
                  const fraccion = sinDatos ? 0 : Math.max(0, Math.min(saldo - ped, total)) / Math.max(total, saldo, 1);
                  return (
                    <li key={p.id} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
                      <span className="relative size-12 shrink-0">
                        <svg viewBox="0 0 48 48" className="size-full -rotate-90" aria-hidden>
                          <circle cx="24" cy="24" r={r} fill="none" stroke="#EEEBF7" strokeWidth="5" />
                          {!sinDatos ? <circle cx="24" cy="24" r={r} fill="none" stroke={saldo < 0 ? "#E5484D" : "#2FB386"} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${fraccion * c} ${c}`} /> : null}
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums">{sinDatos ? "—" : numero(saldo)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.nombre}</span>
                        <span className={`block text-xs ${sinDatos ? GRIS : saldo < 0 ? "text-[#A32020]" : GRIS}`}>{lineaSaldo(p, ped)}</span>
                        {ped > 0 && !sinDatos ? <span className="block text-xs text-[#8A4B00]">{ped} días solicitados por aprobar</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className={`mt-4 border-t border-[#F3F1F8] pt-4 text-xs leading-relaxed ${GRIS}`}>El feriado se puede acumular hasta por dos períodos. Imprime el comprobante de cada vacación aprobada para que el trabajador lo firme.</p>
            </Card>
          ) : null}
        </div>
      )}

      {(creando || editando) && <AusenciaDialog key={editando?.id ?? "nueva"} ausencia={editando} tipo={tipo} personas={personas} saldos={saldos} ajenas={todasConEstado} onCerrar={cerrar} />}
      {rechazando && <MotivoRechazoDialog key={rechazando.a.id} ausencia={rechazando.a} anular={rechazando.anular} onCerrar={cerrarMotivo} onConfirmar={(motivo) => aplicar(rechazando.a, "RECHAZADA", motivo)} />}
    </div>
  );
}
