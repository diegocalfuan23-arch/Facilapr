"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { guardarHorasExtra, marcarAsistencia } from "@/app/panel/asistencia/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { ESTADOS_ASISTENCIA_MANUAL, TEXTO_ESTADO_ASISTENCIA, type AsistenciaDia, type EstadoAsistencia } from "@/lib/rrhh-comun";
import { cn } from "@/lib/utils";

const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Los colores de cada estado: el punto de la agenda y el botón activo del panel. */
const PUNTO: Record<EstadoAsistencia, string> = {
  PRESENTE: "bg-emerald-500",
  ATRASO: "bg-amber-400",
  AUSENTE: "bg-red-500",
  PERMISO: "bg-sky-500",
  VACACIONES: "bg-violet-400",
  LICENCIA: "bg-slate-400",
};

const BOTON_ACTIVO: Record<EstadoAsistencia, string> = {
  PRESENTE: "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  ATRASO: "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  AUSENTE: "border-red-500 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  PERMISO: "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  VACACIONES: "border-border bg-muted text-muted-foreground",
  LICENCIA: "border-border bg-muted text-muted-foreground",
};

const LEYENDA: EstadoAsistencia[] = ["PRESENTE", "ATRASO", "AUSENTE", "PERMISO", "VACACIONES", "LICENCIA"];

const primeraMayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const primerNombre = (n: string) => n.trim().split(/\s+/)[0] ?? n;

/** El primer día (AAAA-MM-01) del mes a `delta` meses de `mes` (AAAA-MM). */
function mesVecino(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * La asistencia como agenda: el calendario del mes, con quién faltó, estuvo de vacaciones o con licencia
 * en cada día, y a un lado el día elegido para marcar a cada persona. Las vacaciones y licencias
 * aprobadas se pintan solas.
 */
export function AsistenciaVista({
  dia,
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
  // Las marcas se ven al instante y se confirman con el servidor; si falla, se vuelve atrás.
  const [marcas, setMarcas] = useState<Record<string, EstadoAsistencia | null>>({});
  const hoy = hoyEnChile();

  const estadoDelDia = (f: AsistenciaDia) => (f.trabajadorId in marcas ? marcas[f.trabajadorId] : f.estado);
  const ir = (d: string) => router.push(`/panel/asistencia?dia=${d}`);

  function marcar(f: AsistenciaDia, nuevo: EstadoAsistencia) {
    const actual = estadoDelDia(f);
    const destino = actual === nuevo ? null : nuevo; // tocar de nuevo el mismo estado quita la marca
    setMarcas((m) => ({ ...m, [f.trabajadorId]: destino }));
    iniciar(async () => {
      const r = await marcarAsistencia(f.trabajadorId, dia, destino);
      if (!r.ok) {
        toast.error(r.error);
        setMarcas((m) => ({ ...m, [f.trabajadorId]: actual }));
      }
    });
  }

  const cuenta = (e: EstadoAsistencia) => filas.filter((f) => estadoDelDia(f) === e).length;
  const sinMarcar = filas.filter((f) => estadoDelDia(f) === null).length;

  // El calendario: semanas de lunes a domingo; los huecos antes y después del mes quedan en gris.
  const [am, mm] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(am, mm - 1, 1));
  const desfase = (primero.getUTCDay() + 6) % 7; // lunes = 0
  const totalDias = new Date(Date.UTC(am, mm, 0)).getUTCDate();
  const celdas: ({ numero: number; dia: string } | null)[] = [
    ...Array.from({ length: desfase }, () => null),
    ...Array.from({ length: totalDias }, (_, i) => ({ numero: i + 1, dia: `${mes}-${String(i + 1).padStart(2, "0")}` })),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  /** Lo que pasó ese día con cada persona (las marcas del panel pisan a las de la agenda en el día abierto). */
  function delDia(d: string) {
    const lista: { nombre: string; estado: EstadoAsistencia }[] = [];
    for (const f of filas) {
      const estado = d === dia ? estadoDelDia(f) : (grilla[f.trabajadorId]?.[d] ?? null);
      if (estado) lista.push({ nombre: f.nombre, estado });
    }
    return lista;
  }

  const [a, m, d] = dia.split("-").map(Number);
  const textoDia = primeraMayuscula(new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, d))));

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

      {filas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">Sin personas activas</p>
          <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">Agrega a las personas en Personal para llevar su asistencia.</p>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          {/* La agenda del mes */}
          <section aria-label="Agenda del mes" className="overflow-hidden rounded-xl border border-border bg-card lg:col-span-2">
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-[1.05rem] font-semibold">{primeraMayuscula(mesTexto)}</h2>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" className="h-9 rounded-full px-4 text-[0.85rem]" onClick={() => ir(hoy)}>
                  Hoy
                </Button>
                <Button variant="outline" size="icon" aria-label="Mes anterior" className="size-9 rounded-full" onClick={() => ir(mesVecino(mes, -1))}>
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="icon" aria-label="Mes siguiente" className="size-9 rounded-full" onClick={() => ir(mesVecino(mes, 1))}>
                  <ChevronRight />
                </Button>
              </div>
            </header>

            <div className="grid grid-cols-7 border-b border-border text-center text-[0.75rem] font-medium text-muted-foreground">
              {DIAS_SEMANA.map((x, i) => (
                <div key={x} className={cn("py-2", i >= 5 && "text-muted-foreground/60")}>
                  {x}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {celdas.map((c, i) => {
                if (!c) return <div key={`v${i}`} className="min-h-16 border-r border-b border-border/60 bg-muted/30 sm:min-h-24" />;
                const lista = delDia(c.dia);
                const finDeSemana = i % 7 >= 5;
                const abierto = c.dia === dia;
                const esHoy = c.dia === hoy;
                return (
                  <button
                    key={c.dia}
                    type="button"
                    onClick={() => ir(c.dia)}
                    aria-label={`${c.numero} de ${mesTexto.split(" ")[0]}${lista.length ? ": " + lista.map((x) => `${x.nombre} ${TEXTO_ESTADO_ASISTENCIA[x.estado].toLowerCase()}`).join(", ") : ""}`}
                    aria-current={abierto ? "date" : undefined}
                    className={cn(
                      "flex min-h-16 flex-col items-start gap-1 border-r border-b border-border/60 p-1.5 text-left transition-colors hover:bg-muted/50 sm:min-h-24 sm:p-2",
                      finDeSemana && "bg-muted/30",
                      abierto && "bg-primary/10 ring-2 ring-primary ring-inset"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-[0.8rem] tabular-nums",
                        esHoy ? "bg-primary font-semibold text-primary-foreground" : finDeSemana ? "text-muted-foreground" : "font-medium"
                      )}
                    >
                      {c.numero}
                    </span>

                    {/* En pantallas chicas solo los puntos; en grandes, el nombre de cada uno. */}
                    <div className="flex flex-wrap gap-1 sm:hidden">
                      {lista.slice(0, 4).map((x) => (
                        <span key={x.nombre} className={cn("size-2 rounded-full", PUNTO[x.estado])} />
                      ))}
                    </div>
                    <div className="hidden w-full flex-col gap-0.5 sm:flex">
                      {lista.slice(0, 3).map((x) => (
                        <span key={x.nombre} className="flex items-center gap-1.5 text-[0.7rem] leading-tight">
                          <span className={cn("size-2 shrink-0 rounded-full", PUNTO[x.estado])} />
                          <span className="truncate">{primerNombre(x.nombre)}</span>
                        </span>
                      ))}
                      {lista.length > 3 && <span className="text-[0.7rem] text-muted-foreground">+{lista.length - 3} más</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <footer className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-[0.75rem] text-muted-foreground">
              {LEYENDA.map((e) => (
                <span key={e} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-full", PUNTO[e])} />
                  {TEXTO_ESTADO_ASISTENCIA[e]}
                </span>
              ))}
            </footer>
          </section>

          {/* El día elegido: marcar a cada persona */}
          <section aria-label="Día elegido" className="rounded-xl border border-border bg-card">
            <header className="border-b border-border px-4 py-3">
              <p className="text-[0.75rem] text-muted-foreground">Día elegido</p>
              <h2 className="text-[1.05rem] font-semibold">{textoDia}</h2>
            </header>
            <div className="flex flex-col">
              {filas.map((f) => {
                const estado = estadoDelDia(f);
                return (
                  <div key={f.trabajadorId} className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5 last:border-0">
                    <div>
                      <div className="text-[0.95rem] font-medium">{f.nombre}</div>
                      <div className="text-[0.75rem] text-muted-foreground">{f.cargo}</div>
                    </div>
                    {f.automatico && estado ? (
                      <span className={cn("w-fit rounded-full border px-3.5 py-1 text-[0.8rem] font-medium", BOTON_ACTIVO[estado])}>
                        {TEXTO_ESTADO_ASISTENCIA[estado]} (aprobada)
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Asistencia de ${f.nombre}`}>
                        {ESTADOS_ASISTENCIA_MANUAL.map((e) => (
                          <button
                            key={e}
                            type="button"
                            aria-pressed={estado === e}
                            onClick={() => marcar(f, e)}
                            className={cn(
                              "rounded-full border px-3.5 py-1 text-[0.8rem] font-medium transition-colors",
                              estado === e ? BOTON_ACTIVO[e] : "border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {TEXTO_ESTADO_ASISTENCIA[e]}
                          </button>
                        ))}
                      </div>
                    )}
                    {!f.automatico && <HorasExtraDia key={`${f.trabajadorId}-${dia}`} trabajadorId={f.trabajadorId} dia={dia} inicial={f.horasExtra} />}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/** Las horas extras de una persona en el día elegido: se guardan al salir del campo y se suman solas a su liquidación del mes. */
function HorasExtraDia({ trabajadorId, dia, inicial }: { trabajadorId: string; dia: string; inicial: number }) {
  const [valor, setValor] = useState(inicial > 0 ? String(inicial).replace(".", ",") : "");
  const [, iniciar] = useTransition();

  function guardar() {
    const horas = Number(valor.replace(",", ".")) || 0;
    if (horas === inicial) return;
    iniciar(async () => {
      const r = await guardarHorasExtra(trabajadorId, dia, horas);
      if (!r.ok) toast.error(r.error);
      else toast.success(horas > 0 ? "Horas extras anotadas" : "Horas extras quitadas");
    });
  }

  return (
    <label className="flex items-center gap-2 text-[0.8rem] text-muted-foreground">
      Horas extras
      <Input
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, "").slice(0, 4))}
        onBlur={guardar}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        inputMode="decimal"
        placeholder="0"
        aria-label="Horas extras"
        className="h-8 w-16 px-2 text-center text-[0.85rem]"
      />
    </label>
  );
}
