"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck2, CalendarCog, Clock3, CalendarDays, CalendarRange, CalendarX2, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Loader2, Minus, Plus, Trash2, TriangleAlert } from "lucide-react";
import { consultarAsistencia, guardarCalendarioLaboral, guardarHoraLlegada, guardarHorasExtra, marcarAsistencia, type ResultadoAsistencia } from "@/app/panel/asistencia/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectorHora } from "@/components/panel/selector-hora";
import { FERIADOS_NACIONALES } from "@/lib/feriados";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { ESTADOS_ASISTENCIA_MANUAL, HORARIO_POR_DEFECTO, TEXTO_ESTADO_ASISTENCIA, aMinutos, duracionTramo, resumenDias, type AsistenciaDia, type DatosAsistencia, type DiaEspecial, type EstadoAsistencia, type HorarioComite, type HorarioPersona, type TramoComite } from "@/lib/rrhh-comun";
import { cn } from "@/lib/utils";

type Estado = EstadoAsistencia;
type Persona = { id: string; nombre: string; cargo: string };
/** Por persona y por día (AAAA-MM-DD), lo que pasó. */
type Grilla = Record<string, Record<string, Estado>>;

const ESTILO: Record<Estado, { punto: string; activo: string; celda: string }> = {
  PRESENTE: { punto: "bg-[#0A9B68]", activo: "border-[#0A7A52] bg-[#DFF4EB] text-[#075A3C]", celda: "bg-[#DFF4EB] text-[#075A3C]" },
  ATRASO: { punto: "bg-[#E58200]", activo: "border-[#B05300] bg-[#FFEEDC] text-[#8F4400]", celda: "bg-[#FFEEDC] text-[#8F4400]" },
  AUSENTE: { punto: "bg-[#D6403D]", activo: "border-[#A32020] bg-[#FDECEC] text-[#A32020]", celda: "bg-[#FDECEC] text-[#A32020]" },
  PERMISO: { punto: "bg-[#0B8BD3]", activo: "border-[#0A6EA8] bg-[#E2F2FC] text-[#0A5F91]", celda: "bg-[#E2F2FC] text-[#0A5F91]" },
  VACACIONES: { punto: "bg-[#7C5CF5]", activo: "border-[#5B3FD6] bg-[#ECE8FD] text-[#2A07A8]", celda: "bg-[#ECE8FD] text-[#2A07A8]" },
  LICENCIA: { punto: "bg-[#7B7892]", activo: "border-[#55526A] bg-[#F1F0F7] text-[#3F3C55]", celda: "bg-[#F1F0F7] text-[#3F3C55]" },
};
const ORDEN: Estado[] = ["PRESENTE", "ATRASO", "AUSENTE", "PERMISO", "VACACIONES", "LICENCIA"];
const texto = (e: Estado) => TEXTO_ESTADO_ASISTENCIA[e];

/** Quién debe trabajar cada día: depende del horario de cada persona y de los feriados y días sin operación. */
type Contexto = {
  especial: (iso: string) => DiaEspecial | null;
  horario: (id: string) => number[];
  debe: (id: string, iso: string) => boolean;
  /** Cuándo funciona el comité ese día; null si está cerrado (o si el comité no definió su horario). */
  comite: (iso: string) => TramoComite | null;
  /** El comité definió su horario y ese día está cerrado. */
  cerrado: (iso: string) => boolean;
  /** A qué hora entra esa persona ese día: la suya o, si no tiene, cuando abre el comité. */
  ingreso: (id: string, iso: string) => string | null;
  /** Minutos que se esperan antes de sugerir un atraso. */
  tolerancia: number;
};

const ESTILO_ESPECIAL: Record<DiaEspecial["tipo"], { celda: string; chip: string; etiqueta: string }> = {
  FERIADO: { celda: "bg-[#F6E3EC]", chip: "bg-[#FBEAF2] text-[#9B2C5E]", etiqueta: "Feriado" },
  SIN_OPERACION: { celda: "bg-[repeating-linear-gradient(135deg,#D9D5E4_0_3px,#F4F3F8_3px_7px)]", chip: "bg-[#EFEDF4] text-[#4A4760]", etiqueta: "Sin operación" },
};

const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];
const LETRA = ["D", "L", "M", "X", "J", "V", "S"];
const CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";

// ---- fechas como texto AAAA-MM-DD, sin horas ni zonas horarias
const aUtc = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const aIso = (d: Date) => d.toISOString().slice(0, 10);
const sumar = (iso: string, n: number) => aIso(new Date(aUtc(iso).getTime() + n * 86_400_000));
const diaSem = (iso: string) => aUtc(iso).getUTCDay(); // 0 = domingo
const lunesDe = (iso: string) => sumar(iso, -((diaSem(iso) + 6) % 7));
const numero = (iso: string) => Number(iso.slice(8));
const mesDe = (iso: string) => Number(iso.slice(5, 7)) - 1;
const anioDe = (iso: string) => Number(iso.slice(0, 4));
const primeroDeMes = (iso: string, delta = 0) => aIso(new Date(Date.UTC(anioDe(iso), mesDe(iso) + delta, 1)));
const diasDelMes = (iso: string) => {
  const total = new Date(Date.UTC(anioDe(iso), mesDe(iso) + 1, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${iso.slice(0, 8)}${String(i + 1).padStart(2, "0")}`);
};
const inicial = (s: string) => s[0].toUpperCase() + s.slice(1);
/** Una hora (HH:MM) unos minutos antes, sin pasar de la medianoche. */
const horaMenos = (h: string, min: number) => {
  const m = Math.max(0, aMinutos(h) - min);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const comaDecimal = (n: number) => String(n).replace(".", ",");

function Stat({ label, valor, alerta = false }: { label: string; valor: number | string; alerta?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-2xl bg-card px-4 py-3", SOMBRA)}>
      <p className={cn("text-[13px] font-medium", alerta && Number(valor) > 0 ? "text-[#8F4400]" : GRIS)}>{label}</p>
      <p className="text-[26px] leading-tight font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

function Leyenda() {
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs", GRIS)}>
      {ORDEN.map((e) => (
        <li key={e} className="flex items-center gap-2">
          <span aria-hidden className={cn("size-2 rounded-sm", ESTILO[e].punto)} />
          {texto(e)}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span aria-hidden className="size-2 rounded-sm bg-[#F4E3CF]" />
        Sin marcar
      </li>
    </ul>
  );
}

function Navegador({ titulo, detalle, anterior, siguiente, onAnterior, onSiguiente }: { titulo: string; detalle: string; anterior: string; siguiente: string; onAnterior: () => void; onSiguiente: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[#F0EEF6] px-3 py-3 lg:px-5">
      <Button variant="ghost" size="icon" aria-label={anterior} onClick={onAnterior} className="size-10 rounded-lg">
        <ChevronLeft />
      </Button>
      <div className="min-w-0 text-center">
        <h2 className="text-[15px] leading-tight font-semibold tracking-tight sm:text-lg">{titulo}</h2>
        <p className={cn("text-[13px]", GRIS)}>{detalle}</p>
      </div>
      <Button variant="ghost" size="icon" aria-label={siguiente} onClick={onSiguiente} className="size-10 rounded-lg">
        <ChevronRight />
      </Button>
    </div>
  );
}

/** El calendario que se abre al tocar el día: un punto por cada marca, un aro en los días sin completar y los feriados pintados. */
function Calendario({
  dia,
  hoy,
  personas,
  ctx,
  estadoDe,
  onSel,
  onMes,
}: {
  dia: string;
  hoy: string;
  personas: Persona[];
  ctx: Contexto;
  estadoDe: (id: string, fecha: string) => Estado | null;
  onSel: (d: string) => void;
  onMes: (delta: number) => void;
}) {
  const dias = diasDelMes(dia);
  const vacios = (diaSem(dias[0]) + 6) % 7;
  return (
    <div className={cn("rounded-2xl bg-card p-4", SOMBRA)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          {inicial(MESES[mesDe(dia)])} {anioDe(dia)}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" onClick={() => onSel(hoy)} className="h-9 rounded-lg px-3 text-sm font-semibold">
            Hoy
          </Button>
          <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => onMes(-1)} className="size-9 rounded-lg">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => onMes(1)} className="size-9 rounded-lg">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className={cn("mt-3 grid grid-cols-7 text-center text-xs font-medium", GRIS)}>
        {DIAS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: vacios }, (_, i) => (
          <span key={i} />
        ))}
        {dias.map((d) => {
          const estados = personas.flatMap((p) => {
            const e = estadoDe(p.id, d);
            return e ? [e] : [];
          });
          const esp = ctx.especial(d);
          const nadie = !personas.some((p) => ctx.debe(p.id, d));
          const incompleto = d <= hoy && personas.some((p) => ctx.debe(p.id, d) && !estadoDe(p.id, d));
          const activo = d === dia;
          const esHoy = d === hoy;
          const resumen = estados.length ? `, ${estados.map(texto).join(", ")}` : "";
          return (
            <button
              key={d}
              type="button"
              aria-pressed={activo}
              aria-label={`${numero(d)} de ${MESES[mesDe(d)]}${esp ? `, ${esp.nombre}` : ""}${resumen}${incompleto ? ", incompleto" : ""}`}
              title={esp ? `${ESTILO_ESPECIAL[esp.tipo].etiqueta}: ${esp.nombre}` : undefined}
              onClick={() => onSel(d)}
              className={cn(
                "flex h-[58px] min-w-0 flex-col items-center gap-1 rounded-xl pt-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                activo ? "bg-[#ECE8FD]" : esp ? ESTILO_ESPECIAL[esp.tipo].celda : "hover:bg-[#F7F6FC]"
              )}
            >
              <span className={cn("flex size-6 items-center justify-center rounded-full text-[13px] tabular-nums", esHoy ? "bg-primary font-bold text-white" : esp?.tipo === "FERIADO" ? "font-semibold text-[#9B2C5E]" : nadie ? GRIS : "font-medium")}>{numero(d)}</span>
              <span className="flex h-2 items-center gap-0.5">
                {estados.map((e, k) => (
                  <span key={k} aria-hidden className={cn("size-1.5 rounded-full", ESTILO[e].punto)} />
                ))}
                {incompleto && <span aria-hidden className="size-1.5 rounded-full border border-[#B05300]" />}
              </span>
            </button>
          );
        })}
      </div>
      <ul className={cn("mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-[#F0EEF6] pt-3 text-xs", GRIS)}>
        {ORDEN.map((e) => (
          <li key={e} className="flex items-center gap-2">
            <span aria-hidden className={cn("size-2 rounded-full", ESTILO[e].punto)} />
            {texto(e)}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full border border-[#B05300]" />
          Incompleto
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className={cn("size-2.5 rounded-sm", ESTILO_ESPECIAL.FERIADO.celda)} />
          Feriado
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className={cn("size-2.5 rounded-sm", ESTILO_ESPECIAL.SIN_OPERACION.celda)} />
          Sin operación
        </li>
      </ul>
    </div>
  );
}

function FilaPersona({
  persona,
  estado,
  automatico,
  extras,
  futuro,
  debe,
  horario,
  ingreso,
  llegada,
  tolerancia,
  onEstado,
  onExtras,
  onLlegada,
}: {
  persona: Persona;
  estado: Estado | null;
  automatico: boolean;
  extras: number;
  futuro: boolean;
  /** Le toca trabajar ese día según su horario (y no es feriado ni día sin operación). */
  debe: boolean;
  horario: number[];
  /** A qué hora le toca entrar ese día, si se sabe. */
  ingreso: string | null;
  /** A qué hora llegó, si se anotó. */
  llegada: string | null;
  tolerancia: number;
  onEstado: (e: Estado | null) => void;
  onExtras: (n: number) => void;
  onLlegada: (hora: string | null) => void;
}) {
  const trabaja = estado === "PRESENTE" || estado === "ATRASO";
  const minutosTarde = llegada && ingreso ? aMinutos(llegada) - aMinutos(ingreso) : null;
  return (
    <li className={cn("px-4 py-4 lg:px-5", !debe && !estado && "bg-[#FBFBFD]")}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{persona.nombre}</p>
          <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]", GRIS)}>
            {persona.cargo}
            {debe ? (
              ingreso ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#F1EEFD] px-1.5 py-0.5 text-xs font-semibold text-[#2A07A8]">
                  <Clock3 className="size-3" aria-hidden />
                  Ingresa {ingreso}
                </span>
              ) : null
            ) : (
              <span className="rounded-md bg-[#F0EFF4] px-1.5 py-0.5 text-xs font-semibold text-[#5B5970]">Libre hoy · trabaja {resumenDias(horario)}</span>
            )}
          </p>
        </div>
        {automatico && estado ? (
          <span className={cn("w-fit rounded-lg px-3 py-2 text-sm font-semibold", ESTILO[estado].celda)}>{texto(estado)} aprobada</span>
        ) : (
          <div role="radiogroup" aria-label={`Asistencia de ${persona.nombre}`} className="grid grid-cols-4 gap-1 xl:w-[380px] xl:shrink-0">
            {ESTADOS_ASISTENCIA_MANUAL.map((e) => {
              const activo = estado === e;
              const bloqueado = futuro && e !== "PERMISO";
              return (
                <button
                  key={e}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  disabled={bloqueado}
                  onClick={() => onEstado(activo ? null : e)}
                  className={cn(
                    "h-10 rounded-lg border text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
                    activo ? ESTILO[e].activo : "border-[#E4E1F0] bg-white text-[#3F3C55] hover:bg-[#F7F6FC]"
                  )}
                >
                  {texto(e)}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {trabaja && !automatico && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 xl:justify-end">
          <div className={cn("flex items-center gap-2 text-[13px]", GRIS)}>
            Llegó
            {/* La lista parte una hora antes de la hora de ingreso: las primeras horas de trabajo, no la hora de ahora. */}
            <SelectorHora valor={llegada} onCambio={onLlegada} etiqueta={`Hora de llegada de ${persona.nombre}`} inicio={ingreso ? horaMenos(ingreso, 60) : "06:00"} />
          </div>
          {minutosTarde !== null && minutosTarde > tolerancia ? (
            <span className="flex items-center gap-2 text-[13px] font-medium text-[#8F4400]">
              {minutosTarde} min tarde
              {estado === "PRESENTE" && (
                <button type="button" onClick={() => onEstado("ATRASO")} className="rounded-md bg-[#FFF3E5] px-2 py-1 text-xs font-semibold hover:bg-[#FFE9D1]">
                  Marcar atraso
                </button>
              )}
            </span>
          ) : minutosTarde !== null ? (
            <span className="text-[13px] font-medium text-[#075A3C]">A tiempo</span>
          ) : null}
          <span className="flex items-center gap-3">
          <span className={cn("text-[13px]", GRIS)}>Horas extras</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label={`Restar hora extra a ${persona.nombre}`} disabled={extras <= 0} onClick={() => onExtras(Math.max(0, extras - 1))} className="size-9 rounded-lg border-[#E4E1F0]">
              <Minus />
            </Button>
            <span className="w-9 text-center text-sm font-semibold tabular-nums">{comaDecimal(extras)}</span>
            <Button variant="outline" size="icon" aria-label={`Sumar hora extra a ${persona.nombre}`} disabled={extras >= 12} onClick={() => onExtras(Math.min(12, extras + 1))} className="size-9 rounded-lg border-[#E4E1F0]">
              <Plus />
            </Button>
          </div>
          </span>
        </div>
      )}
    </li>
  );
}

function VistaSemana({ dia, hoy, personas, ctx, estadoDe, onDia, onMover }: { dia: string; hoy: string; personas: Persona[]; ctx: Contexto; estadoDe: (id: string, f: string) => Estado | null; onDia: (d: string) => void; onMover: (n: number) => void }) {
  const lunes = lunesDe(dia);
  const dias = Array.from({ length: 7 }, (_, i) => sumar(lunes, i));
  const titulo = `${numero(dias[0])} al ${numero(dias[6])} de ${MESES[mesDe(dias[6])]}`;
  const sinMarcar = dias.filter((d) => d <= hoy).reduce((t, d) => t + personas.filter((p) => ctx.debe(p.id, d) && !estadoDe(p.id, d)).length, 0);
  const nadie = (d: string) => !personas.some((p) => ctx.debe(p.id, d));
  return (
    <div className={cn("mt-4 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
      <Navegador titulo={titulo} detalle={sinMarcar ? `${sinMarcar} marcas pendientes` : "Semana al día"} anterior="Semana anterior" siguiente="Semana siguiente" onAnterior={() => onMover(-7)} onSiguiente={() => onMover(7)} />
      <table className="hidden w-full table-fixed border-collapse text-left lg:table">
        <thead>
          <tr className="text-[13px] text-[#3F3C55]">
            <th scope="col" className="w-[17%] px-5 py-3 font-semibold">Persona</th>
            {dias.map((d, i) => {
              const esp = ctx.especial(d);
              return (
                <th key={d} scope="col" className={cn("px-1.5 py-2 text-center font-semibold", d === hoy ? "text-[#2A07A8]" : esp?.tipo === "FERIADO" ? "text-[#9B2C5E]" : nadie(d) ? GRIS : "")}>
                  <span className="block text-xs font-medium">{DIAS[i]}</span>
                  <span className="text-[15px] tabular-nums">{numero(d)}</span>
                  {esp && (
                    <span title={esp.nombre} className={cn("mx-auto mt-0.5 block w-fit max-w-full truncate rounded px-1 text-[10px] font-semibold", ESTILO_ESPECIAL[esp.tipo].chip)}>
                      {ESTILO_ESPECIAL[esp.tipo].etiqueta}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {personas.map((p) => (
            <tr key={p.id} className="border-t border-[#F0EEF6]">
              <th scope="row" className="px-5 py-3 font-normal">
                <span className="block truncate text-[15px] font-semibold">{p.nombre}</span>
                <span className={cn("block text-[13px]", GRIS)}>{p.cargo}</span>
              </th>
              {dias.map((d) => {
                const e = estadoDe(p.id, d);
                const esp = ctx.especial(d);
                const debe = ctx.debe(p.id, d);
                const textoCelda = e ? texto(e) : esp ? "" : debe ? "Marcar" : "Libre";
                return (
                  <td key={d} className="px-1 py-2">
                    <button
                      type="button"
                      aria-label={`${p.nombre}, ${numero(d)}: ${e ? texto(e) : esp ? esp.nombre : debe ? "sin marcar" : "libre"}`}
                      onClick={() => onDia(d)}
                      className={cn(
                        "h-11 w-full truncate rounded-lg px-1 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        e ? ESTILO[e].celda : esp ? `${ESTILO_ESPECIAL[esp.tipo].celda} hover:opacity-80` : debe ? "border border-dashed border-[#DAD6E6] text-[#A5A3B5] hover:bg-[#F7F6FC]" : "text-[#B9B7C6] hover:bg-[#F7F6FC]"
                      )}
                    >
                      {textoCelda}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-[#F0EEF6] lg:hidden">
        {dias.map((d, i) => {
          const esp = ctx.especial(d);
          return nadie(d) && !esp && !personas.some((p) => estadoDe(p.id, d)) ? null : (
            <li key={d}>
              <button type="button" onClick={() => onDia(d)} className="flex w-full gap-3 px-4 py-3 text-left">
                <span className={cn("w-10 shrink-0", d === hoy && "text-[#2A07A8]")}>
                  <span className={cn("block text-xs", GRIS)}>{DIAS[i]}</span>
                  <span className="block text-lg leading-tight font-semibold tabular-nums">{numero(d)}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  {esp && <span className={cn("w-fit rounded-md px-2 py-0.5 text-xs font-semibold", ESTILO_ESPECIAL[esp.tipo].chip)}>{esp.nombre}</span>}
                  {!esp &&
                    personas.map((p) => {
                      const e = estadoDe(p.id, d);
                      return (
                        <span key={p.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{p.nombre}</span>
                          <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold", e ? ESTILO[e].celda : "text-[#5B5970]")}>{e ? texto(e) : ctx.debe(p.id, d) ? "Sin marcar" : "Libre"}</span>
                        </span>
                      );
                    })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function VistaMes({
  dia,
  hoy,
  personas,
  ctx,
  estadoDe,
  horasExtraMes,
  onDia,
  onMes,
}: {
  dia: string;
  hoy: string;
  personas: Persona[];
  ctx: Contexto;
  estadoDe: (id: string, f: string) => Estado | null;
  horasExtraMes: Record<string, number>;
  onDia: (d: string) => void;
  onMes: (n: number) => void;
}) {
  const dias = diasDelMes(dia);
  const debia = (id: string) => dias.filter((d) => d <= hoy && ctx.debe(id, d));
  const faltaSinMarcar = (id: string) => debia(id).filter((d) => !estadoDe(id, d)).length;
  const especiales = dias.filter((d) => ctx.especial(d));
  const de = (id: string, e: Estado) => dias.filter((d) => estadoDe(id, d) === e).length;
  const vino = (id: string) => de(id, "PRESENTE") + de(id, "ATRASO");
  const total = (fn: (id: string) => number) => personas.reduce((t, p) => t + fn(p.id), 0);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const horas = personas.reduce((t, p) => t + (horasExtraMes[p.id] ?? 0), 0);
  const pendientesTotal = personas.reduce((t, p) => t + faltaSinMarcar(p.id), 0);
  return (
    <>
      <section aria-label="Resumen del mes" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Asistencia" valor={`${pct(total(vino), total((id) => debia(id).length))}%`} />
        <Stat label="Atrasos" valor={total((id) => de(id, "ATRASO"))} />
        <Stat label="Ausencias" valor={total((id) => de(id, "AUSENTE"))} />
        <Stat label="Horas extras" valor={comaDecimal(Math.round(horas * 10) / 10)} />
      </section>

      <div className={cn("mt-4 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
        <Navegador
          titulo={`${inicial(MESES[mesDe(dia)])} ${anioDe(dia)}`}
          detalle={especiales.length ? `${especiales.length} día${especiales.length === 1 ? "" : "s"} sin operación o feriado` : "Sin feriados este mes"}
          anterior="Mes anterior"
          siguiente="Mes siguiente"
          onAnterior={() => onMes(-1)}
          onSiguiente={() => onMes(1)}
        />
        <ul className="divide-y divide-[#F0EEF6]">
          {personas.map((p) => (
            <li key={p.id} className="px-4 py-4 lg:grid lg:grid-cols-[170px_minmax(0,1fr)_320px] lg:items-center lg:gap-5 lg:px-5">
              <div className="flex items-baseline justify-between gap-3 lg:block">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{p.nombre}</p>
                  <p className={cn("text-[13px]", GRIS)}>{p.cargo}</p>
                </div>
                <p className="shrink-0 text-right lg:mt-1 lg:text-left">
                  <span className="text-lg font-semibold tabular-nums">{pct(vino(p.id), debia(p.id).length)}%</span>
                  <span className={cn("ml-1 text-[13px]", GRIS)}>asistencia</span>
                  <span className={cn("mt-0.5 block text-xs", GRIS)}>{resumenDias(ctx.horario(p.id))}</span>
                </p>
              </div>
              <div className="min-w-0">
                <div className="mt-3 flex gap-px sm:gap-0.5 lg:mt-0">
                  {dias.map((d) => {
                    const e = estadoDe(p.id, d);
                    const esp = ctx.especial(d);
                    const debe = ctx.debe(p.id, d);
                    const pasado = debe && d <= hoy;
                    const desc = e ? texto(e) : esp ? esp.nombre : !debe ? "Libre" : pasado ? "Sin marcar" : "Por venir";
                    return (
                      <button
                        key={d}
                        type="button"
                        title={`${numero(d)}: ${desc}`}
                        aria-label={`${p.nombre}, ${numero(d)}: ${desc}`}
                        onClick={() => onDia(d)}
                        className={cn(
                          "h-7 min-w-0 flex-1 rounded-[3px] transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          e ? ESTILO[e].punto : esp ? ESTILO_ESPECIAL[esp.tipo].celda : !debe ? "bg-[#F7F6FC]" : pasado ? "bg-[#F4E3CF] ring-1 ring-[#E8B985] ring-inset" : "bg-[#ECE9F5]"
                        )}
                      />
                    );
                  })}
                </div>
                <div className={cn("mt-1 flex justify-between text-[11px] tabular-nums", GRIS)}>
                  <span>1</span>
                  <span>{Math.ceil(dias.length / 2)}</span>
                  <span>{dias.length}</span>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-4 gap-2 text-center lg:mt-0">
                {(
                  [
                    ["Vino", vino(p.id)],
                    ["Atrasos", de(p.id, "ATRASO")],
                    ["Faltas", de(p.id, "AUSENTE")],
                    ["Permisos", de(p.id, "PERMISO") + de(p.id, "VACACIONES") + de(p.id, "LICENCIA")],
                  ] as [string, number][]
                ).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-[#F7F6FC] py-2">
                    <dd className={cn("text-[15px] font-semibold tabular-nums", k === "Faltas" && v > 0 && "text-[#A32020]")}>{v}</dd>
                    <dt className={cn("text-xs", GRIS)}>{k}</dt>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 border-t border-[#F0EEF6] px-4 py-3 lg:px-5">
          <Leyenda />
          <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs", GRIS)}>
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-3 rounded-sm bg-[#F4E3CF] ring-1 ring-[#E8B985] ring-inset" />
              Debía trabajar, sin marcar
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-3 rounded-sm bg-[#F7F6FC] ring-1 ring-[#ECEAF4] ring-inset" />
              Libre según su horario
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className={cn("size-3 rounded-sm", ESTILO_ESPECIAL.FERIADO.celda)} />
              Feriado
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className={cn("size-3 rounded-sm", ESTILO_ESPECIAL.SIN_OPERACION.celda)} />
              Sin operación
            </li>
          </ul>
          {pendientesTotal > 0 && <p className="text-xs text-[#8F4400]">{pendientesTotal} días en que alguien debía trabajar siguen sin marcar.</p>}
        </div>
      </div>
    </>
  );
}

/** Define cuándo funciona el comité, quién trabaja cada día (y a qué hora entra) y los feriados locales o días sin operación. */
function ConfigLaboral({
  personas,
  horarios,
  dias,
  comite,
  toleranciaMin,
  hoy,
  tabInicial,
  onCerrar,
}: {
  personas: Persona[];
  horarios: Record<string, HorarioPersona>;
  dias: DiaEspecial[];
  /** El horario del comité por día; null si todavía no lo definió. */
  comite: HorarioComite | null;
  toleranciaMin: number;
  hoy: string;
  tabInicial: "comite" | "horario" | "feriados";
  onCerrar: () => void;
}) {
  const cliente = useQueryClient();
  const [guardando, iniciar] = useTransition();
  const [tab, setTab] = useState(tabInicial);
  const [h, setH] = useState<Record<string, number[] | undefined>>(() => Object.fromEntries(Object.entries(horarios).map(([id, x]) => [id, x.dias])));
  const [ing, setIng] = useState<Record<string, string | undefined>>(() => Object.fromEntries(Object.entries(horarios).map(([id, x]) => [id, x.ingreso ?? undefined])));
  const [com, setCom] = useState<HorarioComite | null>(comite);
  const [tol, setTol] = useState(String(toleranciaMin));
  const [cal, setCal] = useState<DiaEspecial[]>(dias);
  const [nuevo, setNuevo] = useState(false);
  const [fecha, setFecha] = useState("");
  const [tipo, setTipo] = useState<DiaEspecial["tipo"]>("SIN_OPERACION");
  const [nombre, setNombre] = useState("");
  const [todoElAnio, setTodoElAnio] = useState(false);

  const diasDe = (id: string) => h[id] ?? HORARIO_POR_DEFECTO;
  const alternar = (id: string, d: number) => {
    const actual = diasDe(id);
    const sig = actual.includes(d) ? actual.filter((x) => x !== d) : [...actual, d];
    const igual = sig.length === HORARIO_POR_DEFECTO.length && HORARIO_POR_DEFECTO.every((x) => sig.includes(x));
    setH((x) => ({ ...x, [id]: igual ? undefined : sig }));
  };
  const fijarTramo = (d: number, t: TramoComite | null) => setCom((c) => ({ ...(c ?? {}), [d]: t }));
  const tramoMalo = com ? ORDEN_SEMANA.some((d) => com[d] && aMinutos(com[d]!.cierra) <= aMinutos(com[d]!.abre)) : false;
  const tolNum = tol === "" ? null : Number(tol);
  const tolMala = tolNum === null || !Number.isInteger(tolNum) || tolNum < 0 || tolNum > 120;
  const sinDias = personas.some((p) => diasDe(p.id).length === 0);
  const cambios =
    JSON.stringify(personas.map((p) => [h[p.id] ?? null, ing[p.id] ?? null])) !== JSON.stringify(personas.map((p) => [horarios[p.id]?.dias ?? null, horarios[p.id]?.ingreso ?? null])) ||
    JSON.stringify(cal) !== JSON.stringify(dias) ||
    JSON.stringify(com) !== JSON.stringify(comite) ||
    tol !== String(toleranciaMin);
  const nacional = (f: string) => Object.prototype.hasOwnProperty.call(FERIADOS_NACIONALES, f);
  const repetida = !!fecha && (cal.some((d) => d.fecha === fecha) || nacional(fecha));
  const anio = hoy.slice(0, 4);
  const lista: DiaEspecial[] = [
    ...Object.entries(FERIADOS_NACIONALES)
      .filter(([k]) => k.startsWith(anio))
      .map(([k, n]) => ({ fecha: k, tipo: "FERIADO" as const, nombre: n, nacional: true })),
    ...cal,
  ]
    .filter((d) => todoElAnio || d.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  function agregar() {
    if (!fecha || !nombre.trim() || repetida) return;
    setCal((c) => [...c, { fecha, tipo, nombre: nombre.trim() }]);
    setFecha("");
    setNombre("");
    setNuevo(false);
  }

  function guardar() {
    iniciar(async () => {
      const r = await guardarCalendarioLaboral({
        horarios: Object.fromEntries(personas.map((p) => [p.id, { dias: h[p.id] ?? null, ingreso: ing[p.id] ?? null }])),
        dias: cal.map((d) => ({ fecha: d.fecha, tipo: d.tipo, nombre: d.nombre })),
        comite: com ? Object.fromEntries(ORDEN_SEMANA.map((d) => [String(d), com[d] ?? null])) : null,
        toleranciaMin: tolNum,
      });
      if (r.ok) {
        toast.success("Calendario laboral guardado");
        void cliente.invalidateQueries({ queryKey: ["asistencia"] });
        onCerrar();
      } else {
        toast.error(r.error);
      }
    });
  }

  const columnasPersona = "sm:grid-cols-[minmax(0,1fr)_104px_repeat(7,36px)]";

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="flex max-h-[92vh] max-w-[620px] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[620px]">
        <div className="shrink-0 border-b border-[#F0EEF6] px-6 pt-5 pb-0">
          <DialogTitle className="pr-8 text-lg font-semibold text-[#15132B]">Calendario laboral</DialogTitle>
          <DialogDescription className={cn("mt-0.5 text-[13px]", GRIS)}>Define quién trabaja cada día. Lo que no es laboral no queda pendiente ni cuenta como falta.</DialogDescription>
          <div role="tablist" aria-label="Sección" className="mt-4 flex gap-6">
            {(
              [
                ["comite", "Horario del comité", "Comité"],
                ["horario", "Personas", "Personas"],
                ["feriados", "Feriados y sin operación", "Feriados"],
              ] as const
            ).map(([k, t, c]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn("-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", tab === k ? "border-primary text-[#15132B]" : "border-transparent text-[#8A8799] hover:text-[#15132B]")}
              >
                <span className="sm:hidden">{c}</span>
                <span className="hidden sm:inline">{t}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "comite" ? (
            <div className="px-6 py-4">
              {com === null ? (
                <div className="rounded-xl bg-[#F8F7FC] p-5 text-center">
                  <p className="text-sm font-semibold">Todavía no definiste el horario del comité</p>
                  <p className={cn("mx-auto mt-1 max-w-sm text-[13px]", GRIS)}>Sin horario, la asistencia solo mira los días de cada persona. Con horario, sabe cuándo abre el comité y puede avisar de los atrasos.</p>
                  <Button
                    type="button"
                    onClick={() => setCom({ 0: null, 1: { abre: "08:00", cierra: "17:00" }, 2: { abre: "08:00", cierra: "17:00" }, 3: { abre: "08:00", cierra: "17:00" }, 4: { abre: "08:00", cierra: "17:00" }, 5: { abre: "08:00", cierra: "17:00" }, 6: null })}
                    className="mt-3 h-9 rounded-lg px-4 font-semibold"
                  >
                    Definir horario del comité
                  </Button>
                </div>
              ) : (
                <>
                  <p className={cn("mb-3 text-[13px]", GRIS)}>Días y horas en que funciona el comité. Los días cerrados nadie queda pendiente.</p>
                  <ul className="divide-y divide-[#F3F1F8]">
                    {ORDEN_SEMANA.map((d) => {
                      const t = com[d] ?? null;
                      const malo = t && aMinutos(t.cierra) <= aMinutos(t.abre);
                      return (
                        <li key={d} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={!!t}
                            aria-label={`${DIAS_LARGOS[d]} abierto`}
                            onClick={() => fijarTramo(d, t ? null : { abre: "08:00", cierra: "17:00" })}
                            className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", t ? "bg-primary" : "bg-[#DCD9E8]")}
                          >
                            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", t ? "left-[18px]" : "left-0.5")} />
                          </button>
                          <span className="w-[86px] text-sm font-semibold">{DIAS_LARGOS[d]}</span>
                          {t ? (
                            <span className="flex flex-1 flex-wrap items-center gap-2">
                              <SelectorHora valor={t.abre} onCambio={(h) => h && fijarTramo(d, { ...t, abre: h })} etiqueta={`${DIAS_LARGOS[d]} abre`} inicio="05:00" />
                              <span className={GRIS}>a</span>
                              <SelectorHora valor={t.cierra} onCambio={(h) => h && fijarTramo(d, { ...t, cierra: h })} etiqueta={`${DIAS_LARGOS[d]} cierra`} inicio={t.abre} invalido={!!malo} />
                              <span className={cn("text-xs", malo ? "text-[#A32020]" : GRIS)}>{malo ? "Cierre antes de abrir" : duracionTramo(t)}</span>
                            </span>
                          ) : (
                            <span className={cn("flex-1 text-sm", GRIS)}>Cerrado</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const lunes = com[1];
                      if (lunes) setCom((c) => Object.fromEntries(ORDEN_SEMANA.map((d) => [d, c && c[d] ? { ...lunes } : null])) as HorarioComite);
                    }}
                    className="mt-2 h-8 rounded-lg px-2 text-xs font-semibold text-[#2A07A8]"
                  >
                    Copiar el horario del lunes a los días abiertos
                  </Button>
                </>
              )}

              <div className="mt-4 rounded-xl border border-[#E4E1F0] p-4">
                <label htmlFor="tolerancia" className="text-sm font-semibold">
                  Tolerancia de atraso
                </label>
                <p className={cn("mt-0.5 text-xs", GRIS)}>Cuántos minutos después de su hora de ingreso se le puede esperar a alguien antes de sugerir marcar un atraso. Nunca se marca solo.</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <Input id="tolerancia" inputMode="numeric" value={tol} onChange={(e) => setTol(e.target.value.replace(/\D/g, "").slice(0, 3))} className={cn("h-9 w-[84px] rounded-lg px-2 text-right tabular-nums shadow-none", tolMala ? "border-[#F2C1C0]" : "border-[#E4E1F0]")} />
                  <span className={cn("text-sm", GRIS)}>minutos</span>
                  {tolMala && <span className="text-xs text-[#A32020]">Entre 0 y 120.</span>}
                </div>
              </div>
            </div>
          ) : tab === "horario" ? (
            <div className="px-6 py-4">
              <div className={cn("mb-1 hidden grid-cols-[minmax(0,1fr)_104px_repeat(7,36px)] items-center gap-1.5 text-center text-xs font-semibold sm:grid", GRIS)}>
                <span />
                <span>Ingresa</span>
                {ORDEN_SEMANA.map((d) => (
                  <span key={d}>{CORTO[d]}</span>
                ))}
              </div>
              <ul className="divide-y divide-[#F3F1F8]">
                {personas.map((p) => {
                  const ds = diasDe(p.id);
                  return (
                    <li key={p.id} className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-3 sm:items-center sm:gap-1.5", columnasPersona)}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{p.nombre}</span>
                        <span className={cn("block text-xs", GRIS)}>
                          {p.cargo} · {resumenDias(ds)}
                        </span>
                      </span>
                      <SelectorHora
                        valor={ing[p.id] ?? null}
                        onCambio={(h) => setIng((x) => ({ ...x, [p.id]: h ?? undefined }))}
                        etiqueta={`Hora de ingreso de ${p.nombre}`}
                        inicio="05:00"
                        vacio="Cuando abre el comité"
                        className="w-[124px] sm:w-[104px]"
                      />
                      <span role="group" aria-label={`Días que trabaja ${p.nombre}`} className="col-span-2 grid grid-cols-7 gap-1.5 sm:contents">
                        {ORDEN_SEMANA.map((d) => {
                          const on = ds.includes(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              aria-pressed={on}
                              aria-label={`${DIAS_LARGOS[d]}, ${p.nombre}`}
                              onClick={() => alternar(p.id, d)}
                              className={cn("flex h-9 items-center justify-center rounded-lg border text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", on ? "border-primary bg-primary text-white" : "border-[#E4E1F0] bg-white text-[#B4B2C4] hover:bg-[#F3F1FA]")}
                            >
                              <span className="sm:hidden">{LETRA[d]}</span>
                              {on ? <Check className="hidden size-4 sm:block" strokeWidth={3} aria-hidden /> : <span className="hidden sm:block">—</span>}
                            </button>
                          );
                        })}
                      </span>
                      {ds.length === 0 && <span className="col-span-2 text-xs text-[#A32020] sm:col-span-9">Elige al menos un día.</span>}
                    </li>
                  );
                })}
              </ul>
              <p className={cn("mt-3 rounded-lg bg-[#F8F7FC] px-3 py-2.5 text-xs", GRIS)}>Sin días marcados a mano = lunes a viernes. Sin hora de ingreso = entra cuando abre el comité. Los días que el comité está cerrado no cuentan aunque estén marcados.</p>
            </div>
          ) : (
            <div className="px-6 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div role="radiogroup" aria-label="Mostrar" className="flex rounded-lg bg-[#F4F3F9] p-0.5 text-[13px] font-semibold">
                  {(
                    [
                      [false, "Próximos"],
                      [true, `Todo ${anio}`],
                    ] as const
                  ).map(([v, t]) => (
                    <button key={t} type="button" role="radio" aria-checked={todoElAnio === v} onClick={() => setTodoElAnio(v)} className={cn("h-8 rounded-md px-3 whitespace-nowrap", todoElAnio === v ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}>
                      {t}
                    </button>
                  ))}
                </div>
                {!nuevo && (
                  <Button size="sm" onClick={() => setNuevo(true)} className="h-9 rounded-lg px-3 font-semibold">
                    <Plus className="size-4" />
                    Agregar fecha
                  </Button>
                )}
              </div>

              {nuevo && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    agregar();
                  }}
                  className="mb-4 flex flex-col gap-3 rounded-xl border border-[#E4E1F0] p-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      Fecha
                      <Input type="date" autoFocus value={fecha} onChange={(e) => setFecha(e.target.value)} className={cn("h-10 rounded-lg shadow-none", repetida ? "border-[#F2C1C0]" : "border-[#E4E1F0]")} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      Motivo
                      <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder={tipo === "FERIADO" ? "Ej.: aniversario de la comuna" : "Ej.: corte programado"} className="h-10 rounded-lg border-[#E4E1F0] shadow-none" />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div role="radiogroup" aria-label="Tipo" className="flex gap-1.5">
                      {(["SIN_OPERACION", "FERIADO"] as const).map((t) => (
                        <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipo(t)} className={cn("h-8 rounded-full border px-3 text-xs font-semibold", tipo === t ? "border-primary bg-[#F1EEFD] text-[#2A07A8]" : cn("border-[#E4E1F0]", GRIS))}>
                          {t === "FERIADO" ? "Feriado local" : "Sin operación"}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setNuevo(false)} className="h-9 rounded-lg px-3 font-semibold">
                        Cancelar
                      </Button>
                      <Button type="submit" size="sm" disabled={!fecha || !nombre.trim() || repetida} className="h-9 rounded-lg px-3 font-semibold">
                        Agregar
                      </Button>
                    </div>
                  </div>
                  {repetida && <p className="text-xs text-[#A32020]">Esa fecha ya está en el calendario.</p>}
                </form>
              )}

              {lista.length ? (
                <ul className="divide-y divide-[#F3F1F8]">
                  {lista.map((d) => {
                    const dow = diaSem(d.fecha);
                    return (
                      <li key={d.fecha} className="flex items-center gap-3 py-2.5">
                        <span className={cn("flex w-12 shrink-0 flex-col items-center rounded-lg py-1 leading-tight", ESTILO_ESPECIAL[d.tipo].chip)}>
                          <span className="text-[17px] font-semibold tabular-nums">{numero(d.fecha)}</span>
                          <span className="text-[10px] font-semibold uppercase">{MESES[mesDe(d.fecha)].slice(0, 3)}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{d.nombre}</span>
                          <span className={cn("block text-xs", GRIS)}>
                            {DIAS_LARGOS[dow]} · {d.nacional ? "Feriado nacional" : d.tipo === "FERIADO" ? "Feriado local" : "Sin operación"}
                          </span>
                        </span>
                        {d.nacional ? (
                          <span className={cn("text-xs", GRIS)}>Automático</span>
                        ) : (
                          <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${d.nombre}`} onClick={() => setCal((c) => c.filter((x) => x.fecha !== d.fecha))} className="size-8 rounded-lg text-[#8A8799] hover:bg-[#FDECEC] hover:text-[#A32020]">
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={cn("py-8 text-center text-sm", GRIS)}>No quedan feriados ni días sin operación este año.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-4">
          <span className={cn("hidden text-sm sm:block", GRIS)}>{cambios ? "Cambios sin guardar" : "Sin cambios"}</span>
          <div className="flex flex-1 justify-end gap-2 sm:flex-none">
            <Button type="button" variant="ghost" onClick={onCerrar} className="h-10 rounded-lg px-4 font-semibold">
              Cancelar
            </Button>
            <Button type="button" disabled={!cambios || sinDias || tramoMalo || tolMala || guardando} onClick={guardar} className="h-10 rounded-lg px-5 font-semibold">
              {guardando && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * La asistencia del personal, en tres vistas: el día (para marcar a cada persona), la semana y el mes.
 * Cada persona tiene su horario (por defecto de lunes a viernes) y el comité sus feriados y días sin operación:
 * los días en que no toca trabajar no quedan pendientes. Las vacaciones y licencias aprobadas se marcan solas.
 */
export function AsistenciaVista({ dia, datos }: { dia: string; datos: DatosAsistencia }) {
  // Parte con lo que trajo el servidor y se actualiza sola: cada 30 segundos y al volver a la pestaña.
  const { data } = useQuery({ queryKey: ["asistencia", dia], queryFn: () => consultarAsistencia(dia), initialData: datos, refetchInterval: 30_000 });
  const { filas, grilla, horasExtraMes, horarios, diasComite, comite, toleranciaMin } = data;
  const router = useRouter();
  const [, navegar] = useTransition();
  const [vista, setVista] = useState<"dia" | "semana" | "mes">("dia");
  const [calendario, setCalendario] = useState(false);
  const [config, setConfig] = useState<null | "comite" | "horario" | "feriados">(null);
  const cerrarConfig = useCallback(() => setConfig(null), []);

  const ctx: Contexto = useMemo(() => {
    const especial = (iso: string): DiaEspecial | null => {
      if (Object.prototype.hasOwnProperty.call(FERIADOS_NACIONALES, iso)) return { fecha: iso, tipo: "FERIADO", nombre: FERIADOS_NACIONALES[iso], nacional: true };
      return diasComite.find((d) => d.fecha === iso) ?? null;
    };
    const horario = (id: string) => horarios[id]?.dias ?? HORARIO_POR_DEFECTO;
    const tramo = (iso: string): TramoComite | null => (comite ? (comite[diaSem(iso)] ?? null) : null);
    const cerrado = (iso: string) => comite !== null && !tramo(iso);
    return {
      especial,
      horario,
      comite: tramo,
      cerrado,
      ingreso: (id, iso) => horarios[id]?.ingreso ?? tramo(iso)?.abre ?? null,
      tolerancia: toleranciaMin,
      debe: (id, iso) => !especial(iso) && !cerrado(iso) && horario(id).includes(diaSem(iso)),
    };
  }, [horarios, diasComite, comite, toleranciaMin]);

  const ir = (d: string) => navegar(() => router.push(`/panel/asistencia?dia=${d}`));
  const personas: Persona[] = filas.map((f) => ({ id: f.trabajadorId, nombre: f.nombre, cargo: f.cargo }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Asistencia</h1>
          <p className={cn("mt-0.5 text-[15px]", GRIS)}>Quién vino cada día según su horario. Feriados, vacaciones y licencias se marcan solos.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setConfig("comite")} disabled={personas.length === 0} className="h-11 rounded-lg border-[#E4E1F0] bg-white px-3 font-semibold">
            <CalendarCog />
            Calendario laboral
          </Button>
          <div role="tablist" aria-label="Vista" className="grid grid-cols-3 gap-1 rounded-lg bg-white/80 p-1 sm:w-[270px]">
            {(
              [
                ["dia", "Día"],
                ["semana", "Semana"],
                ["mes", "Mes"],
              ] as const
            ).map(([v, n]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={vista === v}
                onClick={() => setVista(v)}
                className={cn("h-9 rounded-md px-2 text-sm font-semibold whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", vista === v ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filas.length === 0 ? (
        <div className={cn("rounded-2xl bg-card px-6 py-16 text-center", SOMBRA)}>
          <p className="text-[1.05rem] font-medium">Sin personas activas</p>
          <p className={cn("mx-auto mt-2 max-w-xl text-[0.95rem]", GRIS)}>Agrega a las personas en Personal para llevar su asistencia.</p>
        </div>
      ) : (
        // Al cambiar de día, las marcas pendientes de confirmar quedan atrás: el cuerpo se arma de nuevo.
        <Cuerpo key={dia} dia={dia} filas={filas} grilla={grilla} horasExtraMes={horasExtraMes} ctx={ctx} vista={vista} setVista={setVista} calendario={calendario} setCalendario={setCalendario} ir={ir} abrirFeriados={() => setConfig("feriados")} />
      )}

      {config && <ConfigLaboral personas={personas} horarios={horarios} dias={diasComite} comite={comite} toleranciaMin={toleranciaMin} hoy={hoyEnChile()} tabInicial={config} onCerrar={cerrarConfig} />}
    </div>
  );
}

function Cuerpo({
  dia,
  filas,
  grilla,
  horasExtraMes,
  ctx,
  vista,
  setVista,
  calendario,
  setCalendario,
  ir,
  abrirFeriados,
}: {
  dia: string;
  filas: AsistenciaDia[];
  grilla: Grilla;
  horasExtraMes: Record<string, number>;
  ctx: Contexto;
  vista: "dia" | "semana" | "mes";
  setVista: (v: "dia" | "semana" | "mes") => void;
  calendario: boolean;
  setCalendario: (v: boolean | ((v: boolean) => boolean)) => void;
  ir: (d: string) => void;
  abrirFeriados: () => void;
}) {
  const cliente = useQueryClient();
  const enCurso = useRef(0);
  const clave = ["asistencia", dia];
  const hoy = hoyEnChile();
  const personas: Persona[] = filas.map((f) => ({ id: f.trabajadorId, nombre: f.nombre, cargo: f.cargo }));

  const delDia = (id: string) => filas.find((f) => f.trabajadorId === id);
  const estadoDelDia = (id: string): Estado | null => delDia(id)?.estado ?? null;
  /** Lo que pasó ese día con esa persona: en el día abierto, lo que se acaba de marcar; en los demás, la planilla. */
  const estadoDe = (id: string, fecha: string): Estado | null => (fecha === dia ? estadoDelDia(id) : (grilla[id]?.[fecha] ?? null));

  const futuro = dia > hoy;
  const esp = ctx.especial(dia);
  // A quién le toca trabajar hoy, y de ellos a quién falta marcar.
  const conTurno = personas.filter((p) => ctx.debe(p.id, dia));
  const sinMarcar = conTurno.filter((p) => estadoDelDia(p.id) === null);
  const cuenta = (e: Estado) => personas.filter((p) => estadoDelDia(p.id) === e).length;

  /**
   * Muestra el cambio al instante en la caché, lo envía al servidor y, si falla, devuelve esas personas a como estaban.
   * Al terminar el último envío se vuelven a pedir los datos: así lo que hizo otra persona también se ve.
   */
  async function guardar(cambios: { id: string; parcial: Partial<AsistenciaDia> }[], enviar: () => Promise<ResultadoAsistencia[]>) {
    // Una recarga en camino pisaría el cambio que se acaba de mostrar.
    await cliente.cancelQueries({ queryKey: clave });
    const antes = cliente.getQueryData<DatosAsistencia>(clave);
    const poner = (cambiar: (f: AsistenciaDia) => AsistenciaDia) => cliente.setQueryData<DatosAsistencia>(clave, (d) => d && { ...d, filas: d.filas.map(cambiar) });
    poner((f) => ({ ...f, ...cambios.find((c) => c.id === f.trabajadorId)?.parcial }));
    enCurso.current++;
    try {
      const resultados = await enviar();
      const fallo = resultados.find((r) => !r.ok);
      if (fallo && !fallo.ok) {
        toast.error(fallo.error);
        const falladas = cambios.filter((_, i) => !resultados[i].ok).map((c) => c.id);
        poner((f) => (falladas.includes(f.trabajadorId) ? (antes?.filas.find((x) => x.trabajadorId === f.trabajadorId) ?? f) : f));
      } else {
        // Con el mismo id, un aviso reemplaza al anterior: no se apilan aunque se marque a varias personas seguidas.
        toast.success("Guardado", { id: "asistencia-guardado", duration: 1500 });
      }
    } finally {
      if (--enCurso.current === 0) void cliente.invalidateQueries({ queryKey: ["asistencia"] });
    }
  }

  function marcar(p: Persona, nuevo: Estado | null) {
    // Sin presencia no hay hora de llegada ni horas extras.
    const vino = nuevo === "PRESENTE" || nuevo === "ATRASO";
    void guardar([{ id: p.id, parcial: { estado: nuevo, ...(vino ? {} : { horasExtra: 0, horaLlegada: null }) } }], async () => [await marcarAsistencia(p.id, dia, nuevo)]);
  }

  function todosPresentes() {
    const lista = [...sinMarcar];
    void guardar(
      lista.map((p) => ({ id: p.id, parcial: { estado: "PRESENTE" as Estado } })),
      () => Promise.all(lista.map((p) => marcarAsistencia(p.id, dia, "PRESENTE")))
    );
  }

  function llegada(p: Persona, hora: string | null) {
    void guardar([{ id: p.id, parcial: { horaLlegada: hora } }], async () => [await guardarHoraLlegada(p.id, dia, hora)]);
  }

  function horasExtra(p: Persona, n: number) {
    void guardar([{ id: p.id, parcial: { horasExtra: n } }], async () => [await guardarHorasExtra(p.id, dia, n)]);
  }

  // Los días de este mes, hasta ayer, en que alguien debía trabajar y falta marcarlo. Hoy no cuenta: todavía se puede marcar.
  const pendientes = diasDelMes(hoy).filter((d) => d < hoy && personas.some((p) => ctx.debe(p.id, d) && !estadoDe(p.id, d)));

  const irA = (d: string) => ir(d);
  const mover = (delta: number) => irA(sumar(dia, delta));
  const irAlMes = (delta: number) => irA(primeroDeMes(dia, delta));
  const verDia = (d: string) => {
    irA(d);
    setVista("dia");
  };

  return (
    <>
      {pendientes.length > 0 && (
        <button
          type="button"
          onClick={() => irA(pendientes[0])}
          className="flex w-full items-center gap-3 rounded-xl bg-[#FFF3E5] px-4 py-3 text-left text-sm font-medium text-[#8F4400] hover:bg-[#FFEEDC] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            {pendientes.length} {pendientes.length === 1 ? "día anterior sin completar" : "días anteriores sin completar"}
          </span>
          <span className="shrink-0 font-semibold">Ir al primero</span>
        </button>
      )}

      {vista === "mes" ? (
        <VistaMes dia={dia} hoy={hoy} personas={personas} ctx={ctx} estadoDe={estadoDe} horasExtraMes={horasExtraMes} onDia={verDia} onMes={irAlMes} />
      ) : vista === "semana" ? (
        <VistaSemana dia={dia} hoy={hoy} personas={personas} ctx={ctx} estadoDe={estadoDe} onDia={verDia} onMover={mover} />
      ) : (
        <>
          <section aria-label={`Resumen del ${numero(dia)} de ${MESES[mesDe(dia)]}`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Presentes" valor={cuenta("PRESENTE") + cuenta("ATRASO")} />
            <Stat label="Atrasos" valor={cuenta("ATRASO")} />
            <Stat label="Ausentes" valor={cuenta("AUSENTE")} />
            <Stat label="Con permiso" valor={cuenta("PERMISO") + cuenta("VACACIONES") + cuenta("LICENCIA")} />
            <div className="col-span-2 sm:col-span-2 lg:col-span-1">
              <Stat label="Sin marcar" valor={sinMarcar.length} alerta />
            </div>
          </section>

          <div className="relative" onKeyDown={(e) => e.key === "Escape" && setCalendario(false)}>
            {/* Sin overflow-hidden: la lista de horas de cada fila tiene que poder salirse de la tarjeta. */}
            <div className={cn("rounded-2xl bg-card", SOMBRA)}>
              <div className="flex items-center justify-between gap-2 border-b border-[#F0EEF6] px-3 py-3 lg:px-5">
                <Button variant="ghost" size="icon" aria-label="Día anterior" onClick={() => mover(-1)} className="size-10 rounded-lg">
                  <ChevronLeft />
                </Button>
                <button
                  type="button"
                  aria-expanded={calendario}
                  aria-label={`Abrir calendario, ${DIAS_LARGOS[diaSem(dia)]} ${numero(dia)} de ${MESES[mesDe(dia)]}`}
                  onClick={() => setCalendario((v) => !v)}
                  className="min-w-0 rounded-xl px-1 py-1 text-center transition-colors hover:bg-[#F7F6FC] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-3"
                >
                  <span className="flex items-center justify-center gap-2 text-[15px] leading-tight font-semibold tracking-tight whitespace-nowrap sm:text-lg">
                    <CalendarDays className="size-[18px] shrink-0 text-primary" aria-hidden />
                    {DIAS_LARGOS[diaSem(dia)]} {numero(dia)} de {MESES[mesDe(dia)]}
                    <ChevronDown className={cn("size-4 shrink-0 transition-transform", calendario && "rotate-180")} aria-hidden />
                  </span>
                  <span className={cn("block text-[13px]", GRIS)}>
                    {dia === hoy ? "Hoy · " : ""}
                    {esp
                      ? esp.nombre
                      : ctx.cerrado(dia)
                        ? "Comité cerrado"
                        : conTurno.length
                          ? `${ctx.comite(dia) ? `Comité ${ctx.comite(dia)!.abre}–${ctx.comite(dia)!.cierra} · ` : ""}${conTurno.length - sinMarcar.length} de ${conTurno.length} marcados`
                          : "Nadie trabaja este día"}
                  </span>
                </button>
                <Button variant="ghost" size="icon" aria-label="Día siguiente" onClick={() => mover(1)} className="size-10 rounded-lg">
                  <ChevronRight />
                </Button>
              </div>

              {esp ? (
                <p className={cn("flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium lg:px-5", ESTILO_ESPECIAL[esp.tipo].chip)}>
                  {esp.tipo === "FERIADO" ? <CalendarRange className="size-4 shrink-0" aria-hidden /> : <CalendarX2 className="size-4 shrink-0" aria-hidden />}
                  <span className="flex-1">
                    {ESTILO_ESPECIAL[esp.tipo].etiqueta}
                    {esp.nacional ? " nacional" : ""}: {esp.nombre}. Nadie queda pendiente; marca solo si alguien trabajó.
                  </span>
                  {!esp.nacional && (
                    <button type="button" onClick={abrirFeriados} className="shrink-0 font-semibold underline underline-offset-2">
                      Cambiar
                    </button>
                  )}
                </p>
              ) : futuro || conTurno.length === 0 ? (
                <p className={cn("flex items-center gap-2 bg-[#F7F6FC] px-4 py-2 text-[13px] lg:px-5", GRIS)}>
                  <CalendarCheck2 className="size-4 shrink-0" aria-hidden />
                  {futuro ? "Día futuro: solo puedes registrar permisos." : ctx.cerrado(dia) ? "El comité no funciona este día. Marca solo si alguien trabajó." : "A nadie le toca trabajar este día según su horario. Marca solo si alguien trabajó."}
                </p>
              ) : null}

              <ul className="divide-y divide-[#F0EEF6]">
                {[...conTurno, ...personas.filter((p) => !conTurno.includes(p))].map((p) => (
                  <FilaPersona
                    key={p.id}
                    persona={p}
                    estado={estadoDelDia(p.id)}
                    automatico={delDia(p.id)?.automatico ?? false}
                    extras={delDia(p.id)?.horasExtra ?? 0}
                    futuro={futuro}
                    debe={ctx.debe(p.id, dia)}
                    horario={ctx.horario(p.id)}
                    ingreso={ctx.ingreso(p.id, dia)}
                    llegada={delDia(p.id)?.horaLlegada ?? null}
                    tolerancia={ctx.tolerancia}
                    onEstado={(e) => marcar(p, e)}
                    onExtras={(n) => horasExtra(p, n)}
                    onLlegada={(h) => llegada(p, h)}
                  />
                ))}
              </ul>

              {sinMarcar.length > 0 && !futuro && (
                <div className="border-t border-[#F0EEF6] p-3 lg:px-5">
                  <Button onClick={todosPresentes} className="h-11 w-full rounded-lg font-semibold">
                    <CheckCheck />
                    Marcar {sinMarcar.length === 1 ? `a ${sinMarcar[0].nombre}` : `${sinMarcar.length} pendientes`} como presente{sinMarcar.length === 1 ? "" : "s"}
                  </Button>
                </div>
              )}
            </div>

            {calendario && (
              <>
                <button type="button" aria-label="Cerrar calendario" onClick={() => setCalendario(false)} className="fixed inset-0 z-20 cursor-default bg-transparent" />
                <div className="absolute top-[68px] left-1/2 z-30 w-full max-w-[400px] -translate-x-1/2 rounded-2xl shadow-[0_24px_60px_rgba(22,21,28,0.25)]">
                  <Calendario
                    dia={dia}
                    hoy={hoy}
                    personas={personas}
                    ctx={ctx}
                    estadoDe={estadoDe}
                    onSel={(d) => {
                      irA(d);
                      setCalendario(false);
                    }}
                    onMes={irAlMes}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
