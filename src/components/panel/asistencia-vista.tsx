"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck2, CalendarDays, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, TriangleAlert } from "lucide-react";
import { guardarHorasExtra, marcarAsistencia } from "@/app/panel/asistencia/actions";
import { Button } from "@/components/ui/button";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { ESTADOS_ASISTENCIA_MANUAL, TEXTO_ESTADO_ASISTENCIA, type AsistenciaDia, type EstadoAsistencia } from "@/lib/rrhh-comun";
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
const finde = (iso: string) => diaSem(iso) === 0 || diaSem(iso) === 6;
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

/** El calendario que se abre al tocar el día: un punto por cada marca y un aro en los días sin completar. */
function Calendario({
  dia,
  hoy,
  personas,
  estadoDe,
  onSel,
  onMes,
}: {
  dia: string;
  hoy: string;
  personas: Persona[];
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
          const incompleto = !finde(d) && d <= hoy && estados.length < personas.length;
          const activo = d === dia;
          const esHoy = d === hoy;
          const resumen = estados.length ? `, ${estados.map(texto).join(", ")}` : "";
          return (
            <button
              key={d}
              type="button"
              aria-pressed={activo}
              aria-label={`${numero(d)} de ${MESES[mesDe(d)]}${resumen}${incompleto ? ", incompleto" : ""}`}
              onClick={() => onSel(d)}
              className={cn(
                "flex h-[58px] min-w-0 flex-col items-center gap-1 rounded-xl pt-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                activo ? "bg-[#ECE8FD]" : "hover:bg-[#F7F6FC]"
              )}
            >
              <span className={cn("flex size-6 items-center justify-center rounded-full text-[13px] tabular-nums", esHoy ? "bg-primary font-bold text-white" : finde(d) ? GRIS : "font-medium")}>{numero(d)}</span>
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
  onEstado,
  onExtras,
}: {
  persona: Persona;
  estado: Estado | null;
  automatico: boolean;
  extras: number;
  futuro: boolean;
  onEstado: (e: Estado | null) => void;
  onExtras: (n: number) => void;
}) {
  const trabaja = estado === "PRESENTE" || estado === "ATRASO";
  return (
    <li className="px-4 py-4 lg:px-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{persona.nombre}</p>
          <p className={cn("text-[13px]", GRIS)}>{persona.cargo}</p>
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
        <div className="mt-3 flex items-center justify-between gap-3 xl:justify-end">
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
        </div>
      )}
    </li>
  );
}

function VistaSemana({ dia, hoy, personas, estadoDe, onDia, onMover }: { dia: string; hoy: string; personas: Persona[]; estadoDe: (id: string, f: string) => Estado | null; onDia: (d: string) => void; onMover: (n: number) => void }) {
  const lunes = lunesDe(dia);
  const dias = Array.from({ length: 7 }, (_, i) => sumar(lunes, i));
  const titulo = `${numero(dias[0])} al ${numero(dias[6])} de ${MESES[mesDe(dias[6])]}`;
  const sinMarcar = dias.filter((d) => !finde(d) && d <= hoy).reduce((t, d) => t + personas.filter((p) => !estadoDe(p.id, d)).length, 0);
  return (
    <div className={cn("mt-4 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
      <Navegador titulo={titulo} detalle={sinMarcar ? `${sinMarcar} marcas pendientes` : "Semana al día"} anterior="Semana anterior" siguiente="Semana siguiente" onAnterior={() => onMover(-7)} onSiguiente={() => onMover(7)} />
      <table className="hidden w-full table-fixed border-collapse text-left lg:table">
        <thead>
          <tr className="text-[13px] text-[#3F3C55]">
            <th scope="col" className="w-[17%] px-5 py-3 font-semibold">Persona</th>
            {dias.map((d, i) => (
              <th key={d} scope="col" className={cn("px-1.5 py-2 text-center font-semibold", d === hoy ? "text-[#2A07A8]" : finde(d) ? GRIS : "")}>
                <span className="block text-xs font-medium">{DIAS[i]}</span>
                <span className="text-[15px] tabular-nums">{numero(d)}</span>
              </th>
            ))}
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
                return (
                  <td key={d} className="px-1 py-2">
                    <button
                      type="button"
                      aria-label={`${p.nombre}, ${numero(d)}: ${e ? texto(e) : "sin marcar"}`}
                      onClick={() => onDia(d)}
                      className={cn(
                        "h-11 w-full truncate rounded-lg px-1 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        e ? ESTILO[e].celda : finde(d) ? "text-[#A5A3B5] hover:bg-[#F7F6FC]" : "border border-dashed border-[#DAD6E6] text-[#A5A3B5] hover:bg-[#F7F6FC]"
                      )}
                    >
                      {e ? texto(e) : finde(d) ? "" : "Marcar"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-[#F0EEF6] lg:hidden">
        {dias.map((d, i) =>
          finde(d) && !personas.some((p) => estadoDe(p.id, d)) ? null : (
            <li key={d}>
              <button type="button" onClick={() => onDia(d)} className="flex w-full gap-3 px-4 py-3 text-left">
                <span className={cn("w-10 shrink-0", d === hoy && "text-[#2A07A8]")}>
                  <span className={cn("block text-xs", GRIS)}>{DIAS[i]}</span>
                  <span className="block text-lg leading-tight font-semibold tabular-nums">{numero(d)}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  {personas.map((p) => {
                    const e = estadoDe(p.id, d);
                    return (
                      <span key={p.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{p.nombre}</span>
                        <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold", e ? ESTILO[e].celda : "text-[#5B5970]")}>{e ? texto(e) : "Sin marcar"}</span>
                      </span>
                    );
                  })}
                </span>
              </button>
            </li>
          )
        )}
      </ul>
    </div>
  );
}

function VistaMes({
  dia,
  hoy,
  personas,
  estadoDe,
  horasExtraMes,
  onDia,
  onMes,
}: {
  dia: string;
  hoy: string;
  personas: Persona[];
  estadoDe: (id: string, f: string) => Estado | null;
  horasExtraMes: Record<string, number>;
  onDia: (d: string) => void;
  onMes: (n: number) => void;
}) {
  const dias = diasDelMes(dia);
  const transcurridos = dias.filter((d) => !finde(d) && d <= hoy);
  const de = (id: string, e: Estado) => dias.filter((d) => estadoDe(id, d) === e).length;
  const vino = (id: string) => de(id, "PRESENTE") + de(id, "ATRASO");
  const total = (fn: (id: string) => number) => personas.reduce((t, p) => t + fn(p.id), 0);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const horas = personas.reduce((t, p) => t + (horasExtraMes[p.id] ?? 0), 0);
  return (
    <>
      <section aria-label="Resumen del mes" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Asistencia" valor={`${pct(total(vino), transcurridos.length * personas.length)}%`} />
        <Stat label="Atrasos" valor={total((id) => de(id, "ATRASO"))} />
        <Stat label="Ausencias" valor={total((id) => de(id, "AUSENTE"))} />
        <Stat label="Horas extras" valor={comaDecimal(Math.round(horas * 10) / 10)} />
      </section>

      <div className={cn("mt-4 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
        <Navegador titulo={`${inicial(MESES[mesDe(dia)])} ${anioDe(dia)}`} detalle={`${transcurridos.length} días hábiles transcurridos`} anterior="Mes anterior" siguiente="Mes siguiente" onAnterior={() => onMes(-1)} onSiguiente={() => onMes(1)} />
        <ul className="divide-y divide-[#F0EEF6]">
          {personas.map((p) => (
            <li key={p.id} className="px-4 py-4 lg:grid lg:grid-cols-[170px_minmax(0,1fr)_320px] lg:items-center lg:gap-5 lg:px-5">
              <div className="flex items-baseline justify-between gap-3 lg:block">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{p.nombre}</p>
                  <p className={cn("text-[13px]", GRIS)}>{p.cargo}</p>
                </div>
                <p className="shrink-0 text-right lg:mt-1 lg:text-left">
                  <span className="text-lg font-semibold tabular-nums">{pct(vino(p.id), transcurridos.length)}%</span>
                  <span className={cn("ml-1 text-[13px]", GRIS)}>asistencia</span>
                </p>
              </div>
              <div className="min-w-0">
                <div className="mt-3 flex gap-px sm:gap-0.5 lg:mt-0">
                  {dias.map((d) => {
                    const e = estadoDe(p.id, d);
                    const pasado = !finde(d) && d <= hoy;
                    return (
                      <button
                        key={d}
                        type="button"
                        title={`${numero(d)}: ${e ? texto(e) : "Sin marcar"}`}
                        aria-label={`${p.nombre}, ${numero(d)}: ${e ? texto(e) : "sin marcar"}`}
                        onClick={() => onDia(d)}
                        className={cn(
                          "h-7 min-w-0 flex-1 rounded-[3px] transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          e ? ESTILO[e].punto : finde(d) ? "bg-[#F7F6FC]" : pasado ? "bg-[#F4E3CF]" : "bg-[#ECE9F5]"
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
                    <dd className="text-[15px] font-semibold tabular-nums">{v}</dd>
                    <dt className={cn("text-xs", GRIS)}>{k}</dt>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        <div className="border-t border-[#F0EEF6] px-4 py-3 lg:px-5">
          <Leyenda />
        </div>
      </div>
    </>
  );
}

/**
 * La asistencia del personal, en tres vistas: el día (para marcar a cada persona), la semana y el mes.
 * Las vacaciones y licencias aprobadas se marcan solas. Las marcas se ven al instante y se confirman con
 * el servidor; si falla, se vuelve atrás.
 */
export function AsistenciaVista({ dia, filas, grilla, horasExtraMes }: { dia: string; filas: AsistenciaDia[]; grilla: Grilla; horasExtraMes: Record<string, number> }) {
  const router = useRouter();
  const [, navegar] = useTransition();
  const [vista, setVista] = useState<"dia" | "semana" | "mes">("dia");
  const [calendario, setCalendario] = useState(false);

  const ir = (d: string) => navegar(() => router.push(`/panel/asistencia?dia=${d}`));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Asistencia</h1>
          <p className={cn("mt-1 text-[15px]", GRIS)}>Quién vino cada día. Las vacaciones y licencias aprobadas se marcan solas.</p>
        </div>
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

      {filas.length === 0 ? (
        <div className={cn("rounded-2xl bg-card px-6 py-16 text-center", SOMBRA)}>
          <p className="text-[1.05rem] font-medium">Sin personas activas</p>
          <p className={cn("mx-auto mt-2 max-w-xl text-[0.95rem]", GRIS)}>Agrega a las personas en Personal para llevar su asistencia.</p>
        </div>
      ) : (
        // Al cambiar de día, las marcas pendientes de confirmar quedan atrás: el cuerpo se arma de nuevo.
        <Cuerpo key={dia} dia={dia} filas={filas} grilla={grilla} horasExtraMes={horasExtraMes} vista={vista} setVista={setVista} calendario={calendario} setCalendario={setCalendario} ir={ir} />
      )}
    </div>
  );
}

function Cuerpo({
  dia,
  filas,
  grilla,
  horasExtraMes,
  vista,
  setVista,
  calendario,
  setCalendario,
  ir,
}: {
  dia: string;
  filas: AsistenciaDia[];
  grilla: Grilla;
  horasExtraMes: Record<string, number>;
  vista: "dia" | "semana" | "mes";
  setVista: (v: "dia" | "semana" | "mes") => void;
  calendario: boolean;
  setCalendario: (v: boolean | ((v: boolean) => boolean)) => void;
  ir: (d: string) => void;
}) {
  const [, iniciar] = useTransition();
  const hoy = hoyEnChile();
  const personas: Persona[] = filas.map((f) => ({ id: f.trabajadorId, nombre: f.nombre, cargo: f.cargo }));
  // Lo que se marcó en este día y todavía no vuelve del servidor.
  const [marcas, setMarcas] = useState<Record<string, Estado | null>>({});
  const [extras, setExtras] = useState<Record<string, number>>({});

  const delDia = (id: string) => filas.find((f) => f.trabajadorId === id);
  const estadoDelDia = (id: string): Estado | null => (id in marcas ? marcas[id] : (delDia(id)?.estado ?? null));
  /** Lo que pasó ese día con esa persona: en el día abierto, lo que se acaba de marcar; en los demás, la planilla. */
  const estadoDe = (id: string, fecha: string): Estado | null => (fecha === dia ? estadoDelDia(id) : (grilla[id]?.[fecha] ?? null));

  const futuro = dia > hoy;
  const sinMarcar = personas.filter((p) => estadoDelDia(p.id) === null);
  const cuenta = (e: Estado) => personas.filter((p) => estadoDelDia(p.id) === e).length;

  function marcar(p: Persona, nuevo: Estado | null) {
    const antes = estadoDelDia(p.id);
    setMarcas((m) => ({ ...m, [p.id]: nuevo }));
    if (nuevo !== "PRESENTE" && nuevo !== "ATRASO") setExtras((x) => ({ ...x, [p.id]: 0 }));
    iniciar(async () => {
      const r = await marcarAsistencia(p.id, dia, nuevo);
      if (!r.ok) {
        toast.error(r.error);
        setMarcas((m) => ({ ...m, [p.id]: antes }));
      }
    });
  }

  function todosPresentes() {
    const lista = [...sinMarcar];
    setMarcas((m) => ({ ...m, ...Object.fromEntries(lista.map((p) => [p.id, "PRESENTE" as Estado])) }));
    iniciar(async () => {
      const resultados = await Promise.all(lista.map((p) => marcarAsistencia(p.id, dia, "PRESENTE")));
      const fallo = resultados.find((r) => !r.ok);
      if (fallo && !fallo.ok) {
        toast.error(fallo.error);
        const falladas = lista.filter((_, i) => !resultados[i].ok);
        setMarcas((m) => ({ ...m, ...Object.fromEntries(falladas.map((p) => [p.id, null])) }));
      }
    });
  }

  function horasExtra(p: Persona, n: number) {
    const antes = extras[p.id] ?? delDia(p.id)?.horasExtra ?? 0;
    setExtras((x) => ({ ...x, [p.id]: n }));
    iniciar(async () => {
      const r = await guardarHorasExtra(p.id, dia, n);
      if (!r.ok) {
        toast.error(r.error);
        setExtras((x) => ({ ...x, [p.id]: antes }));
      }
    });
  }

  // Los días hábiles de este mes, hasta hoy, en que falta marcar a alguien. Hoy no cuenta: todavía se puede marcar.
  const pendientes = diasDelMes(hoy).filter((d) => d < hoy && !finde(d) && personas.some((p) => !estadoDe(p.id, d)));

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
        <VistaMes dia={dia} hoy={hoy} personas={personas} estadoDe={estadoDe} horasExtraMes={horasExtraMes} onDia={verDia} onMes={irAlMes} />
      ) : vista === "semana" ? (
        <VistaSemana dia={dia} hoy={hoy} personas={personas} estadoDe={estadoDe} onDia={verDia} onMover={mover} />
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
            <div className={cn("overflow-hidden rounded-2xl bg-card", SOMBRA)}>
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
                    {personas.length - sinMarcar.length} de {personas.length} marcados
                  </span>
                </button>
                <Button variant="ghost" size="icon" aria-label="Día siguiente" onClick={() => mover(1)} className="size-10 rounded-lg">
                  <ChevronRight />
                </Button>
              </div>

              {(finde(dia) || futuro) && (
                <p className={cn("flex items-center gap-2 bg-[#F7F6FC] px-4 py-2 text-[13px] lg:px-5", GRIS)}>
                  <CalendarCheck2 className="size-4 shrink-0" aria-hidden />
                  {futuro ? "Día futuro: solo puedes registrar permisos." : "Fin de semana: marca solo si hubo turno."}
                </p>
              )}

              <ul className="divide-y divide-[#F0EEF6]">
                {personas.map((p) => (
                  <FilaPersona
                    key={p.id}
                    persona={p}
                    estado={estadoDelDia(p.id)}
                    automatico={delDia(p.id)?.automatico ?? false}
                    extras={extras[p.id] ?? delDia(p.id)?.horasExtra ?? 0}
                    futuro={futuro}
                    onEstado={(e) => marcar(p, e)}
                    onExtras={(n) => horasExtra(p, n)}
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
