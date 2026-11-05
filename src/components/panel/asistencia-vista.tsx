"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { marcarAsistencia } from "@/app/panel/asistencia/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ESTADOS_ASISTENCIA_MANUAL,
  TEXTO_ESTADO_ASISTENCIA,
  type AsistenciaDia,
  type EstadoAsistencia,
} from "@/lib/rrhh-comun";
import { cn } from "@/lib/utils";

const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";

const COLOR_ACTIVO: Record<EstadoAsistencia, string> = {
  PRESENTE: "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  ATRASO: "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  AUSENTE: "border-red-500 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  PERMISO: "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  VACACIONES: "border-border bg-muted text-muted-foreground",
  LICENCIA: "border-border bg-muted text-muted-foreground",
};

const COLOR_CELDA: Record<EstadoAsistencia, string> = {
  PRESENTE: "bg-emerald-500",
  ATRASO: "bg-amber-400",
  AUSENTE: "bg-red-500",
  PERMISO: "bg-sky-500",
  VACACIONES: "bg-violet-400",
  LICENCIA: "bg-slate-400",
};

const LEYENDA: { estado: EstadoAsistencia; color: string }[] = (["PRESENTE", "ATRASO", "AUSENTE", "PERMISO", "VACACIONES", "LICENCIA"] as EstadoAsistencia[]).map((estado) => ({
  estado,
  color: COLOR_CELDA[estado],
}));

const primeraMayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const LETRAS = ["D", "L", "M", "M", "J", "V", "S"];

/**
 * La asistencia de un día: cada persona activa con sus botones Presente / Atraso / Ausente / Permiso.
 * Quien está de vacaciones o con licencia aprobada aparece solo con ese estado. Abajo, el resumen del mes.
 */
export function AsistenciaVista({
  dia,
  anterior,
  siguiente,
  filas,
  grilla,
  mes,
  mesTexto,
}: {
  dia: string;
  anterior: string;
  siguiente: string;
  filas: AsistenciaDia[];
  /** Por persona y por día (AAAA-MM-DD), lo que pasó. */
  grilla: Record<string, Record<string, EstadoAsistencia>>;
  mes: string;
  mesTexto: string;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  // Las marcas se muestran al instante y se confirman con el servidor; si falla, se vuelve atrás.
  const [marcas, setMarcas] = useState<Record<string, EstadoAsistencia | null>>({});

    const conId = filas.map((f) => ({ ...f, id: f.trabajadorId }));

  function marcar(f: { trabajadorId: string; id: string; estado: EstadoAsistencia | null }, nuevo: EstadoAsistencia) {
    const actual = f.id in marcas ? marcas[f.id] : f.estado;
    const destino = actual === nuevo ? null : nuevo; // tocar de nuevo el mismo estado quita la marca
    setMarcas((m) => ({ ...m, [f.id]: destino }));
    iniciar(async () => {
      const r = await marcarAsistencia(f.trabajadorId, dia, destino);
      if (!r.ok) {
        toast.error(r.error);
        setMarcas((m) => ({ ...m, [f.id]: actual }));
      }
    });
  }

  const cuenta = (e: EstadoAsistencia) => conId.filter((f) => (f.id in marcas ? marcas[f.id] : f.estado) === e).length;
  const sinMarcar = conId.filter((f) => (f.id in marcas ? marcas[f.id] : f.estado) === null).length;
  const [a, m, d] = dia.split("-").map(Number);
  const textoDia = primeraMayuscula(new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, d))));

  const [am, mm] = mes.split("-").map(Number);
  const totalDias = new Date(Date.UTC(am, mm, 0)).getUTCDate();
  const diasDelMes = Array.from({ length: totalDias }, (_, i) => {
    const numero = i + 1;
    const semana = new Date(Date.UTC(am, mm - 1, numero)).getUTCDay();
    return { numero, dia: `${mes}-${String(numero).padStart(2, "0")}`, letra: LETRAS[semana], finDeSemana: semana === 0 || semana === 6 };
  });

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen del día" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className={cn(etiquetaKpi, "text-emerald-800 dark:text-emerald-300")}>Presentes</p>
          <p className="mt-3 text-[2rem] leading-none font-bold text-emerald-800 tabular-nums dark:text-emerald-300">{cuenta("PRESENTE") + cuenta("ATRASO")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Atrasos</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{cuenta("ATRASO")}</p>
        </div>
        <div className={cn("rounded-xl border p-5", cuenta("AUSENTE") > 0 ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10" : "border-border bg-card")}>
          <p className={cn(etiquetaKpi, cuenta("AUSENTE") > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>Ausentes</p>
          <p className={cn("mt-3 text-[2rem] leading-none font-bold tabular-nums", cuenta("AUSENTE") > 0 && "text-red-600 dark:text-red-400")}>{cuenta("AUSENTE")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Sin marcar</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{sinMarcar}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Día anterior" className="size-10 rounded-full" onClick={() => router.push(`/panel/asistencia?dia=${anterior}`)}>
          <ChevronLeft />
        </Button>
        <Input type="date" value={dia} onChange={(e) => e.target.value && router.push(`/panel/asistencia?dia=${e.target.value}`)} className="h-10 w-44 rounded-full px-4 text-[0.95rem]" aria-label="Día" />
        <Button variant="outline" size="icon" aria-label="Día siguiente" className="size-10 rounded-full" onClick={() => router.push(`/panel/asistencia?dia=${siguiente}`)}>
          <ChevronRight />
        </Button>
        <span className="ml-2 text-[0.95rem] font-medium">{textoDia}</span>
      </div>

      {conId.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">Sin personas activas</p>
          <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">Agrega a las personas en Personal para llevar su asistencia.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {conId.map((f) => {
            const estado = f.id in marcas ? marcas[f.id] : f.estado;
            return (
              <div key={f.id} className="flex flex-col gap-3 border-b border-border px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">{f.nombre}</div>
                  <div className="text-[0.8rem] text-muted-foreground">{f.cargo}</div>
                </div>
                {f.automatico && estado ? (
                  <span className={cn("w-fit rounded-full border px-4 py-1.5 text-[0.85rem] font-medium", COLOR_ACTIVO[estado])}>
                    {TEXTO_ESTADO_ASISTENCIA[estado]} (aprobada)
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2" role="group" aria-label={`Asistencia de ${f.nombre}`}>
                    {ESTADOS_ASISTENCIA_MANUAL.map((e) => (
                      <button
                        key={e}
                        type="button"
                        aria-pressed={estado === e}
                        onClick={() => marcar(f, e)}
                        className={cn(
                          "rounded-full border px-4 py-1.5 text-[0.85rem] font-medium transition-colors",
                          estado === e ? COLOR_ACTIVO[e] : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {TEXTO_ESTADO_ASISTENCIA[e]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {conId.length > 0 && (
        <section aria-label="Planilla del mes">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[0.95rem] font-semibold">{primeraMayuscula(mesTexto)}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-muted-foreground">
              {LEYENDA.map((l) => (
                <span key={l.estado} className="flex items-center gap-1.5">
                  <span className={cn("size-3 rounded-[4px]", l.color)} />
                  {TEXTO_ESTADO_ASISTENCIA[l.estado]}
                </span>
              ))}
            </div>
          </div>
          <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
            <table className="border-collapse text-[0.8rem]">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="sticky left-0 z-10 min-w-40 bg-card px-4 py-2 text-left font-medium text-muted-foreground">Persona</th>
                  {diasDelMes.map((x) => (
                    <th key={x.dia} className={cn("w-8 min-w-8 px-0.5 py-2 text-center font-medium", x.finDeSemana ? "text-muted-foreground/60" : "text-muted-foreground", x.dia === dia && "text-primary")}>
                      <div className="text-[0.65rem] leading-none">{x.letra}</div>
                      <div className="mt-0.5 tabular-nums">{x.numero}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-muted-foreground">Asistió</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-muted-foreground">Faltó</th>
                </tr>
              </thead>
              <tbody>
                {conId.map((f) => {
                  const dias = grilla[f.trabajadorId] ?? {};
                  const asistio = Object.values(dias).filter((e) => e === "PRESENTE" || e === "ATRASO").length;
                  const falto = Object.values(dias).filter((e) => e === "AUSENTE").length;
                  return (
                    <tr key={f.id} className="border-b border-border last:border-0">
                      <td className="sticky left-0 z-10 bg-card px-4 py-2 font-medium whitespace-nowrap">{f.nombre}</td>
                      {diasDelMes.map((x) => {
                        const e = dias[x.dia];
                        return (
                          <td key={x.dia} className={cn("p-0.5 text-center", x.finDeSemana && "bg-muted/40", x.dia === dia && "bg-primary/5")}>
                            <button
                              type="button"
                              onClick={() => router.push(`/panel/asistencia?dia=${x.dia}`)}
                              title={`${f.nombre} · ${x.numero}: ${e ? TEXTO_ESTADO_ASISTENCIA[e] : "sin marca"}`}
                              aria-label={`${f.nombre}, día ${x.numero}: ${e ? TEXTO_ESTADO_ASISTENCIA[e] : "sin marca"}`}
                              className={cn("block size-7 rounded-md transition-opacity hover:opacity-70", e ? COLOR_CELDA[e] : "border border-dashed border-border/70")}
                            />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-medium text-emerald-700 tabular-nums dark:text-emerald-400">{asistio}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", falto > 0 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>{falto}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[0.75rem] text-muted-foreground">Toca un día para marcarlo. Las vacaciones y licencias aprobadas aparecen solas.</p>
        </section>
      )}
    </div>
  );
}
