"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { cambiarEstadoAusencia } from "@/app/panel/ausencias/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AusenciaDialog } from "@/components/panel/ausencia-dialog";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { TEXTO_TIPO_AUSENCIA, type AusenciaFila, type EstadoAusencia, type TipoAusencia } from "@/lib/rrhh-comun";
import { cn } from "@/lib/utils";

const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const alto = "h-10";

const COLUMNAS: { estado: EstadoAusencia; titulo: string; punto: string; vacio: string }[] = [
  { estado: "SOLICITADA", titulo: "Solicitadas", punto: "bg-amber-500", vacio: "Nada por aprobar" },
  { estado: "APROBADA", titulo: "Aprobadas", punto: "bg-emerald-500", vacio: "Sin registros aprobados" },
  { estado: "RECHAZADA", titulo: "Rechazadas", punto: "bg-red-500", vacio: "Sin registros rechazados" },
];

export type SaldoVacaciones = { id: string; nombre: string; ganados: number | null; tomados: number; saldo: number | null };

/**
 * Vacaciones (con permisos) o licencias médicas del personal. En vacaciones se ve además el saldo de
 * cada persona: lo que ganó desde su ingreso menos lo que ya tomó.
 */
export function AusenciasVista({
  tipo,
  ausencias,
  personas,
  saldos,
}: {
  tipo: "VACACIONES" | "LICENCIA";
  ausencias: AusenciaFila[];
  personas: { id: string; nombre: string }[];
  /** Solo en vacaciones. */
  saldos?: SaldoVacaciones[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<AusenciaFila | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<EstadoAusencia | null>(null);
  // El estado se ve cambiar al instante; si el servidor falla, se vuelve atrás.
  const [movidas, setMovidas] = useState<Record<string, EstadoAusencia>>({});
  const [, iniciar] = useTransition();
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
    // Lo que se editó en el diálogo manda sobre lo que se movió antes en el tablero.
    setMovidas({});
  }, []);

  const estadoDe = (a: AusenciaFila) => movidas[a.id] ?? a.estado;

  function mover(a: AusenciaFila, destino: EstadoAusencia) {
    const origen = estadoDe(a);
    if (origen === destino) return;
    setMovidas((m) => ({ ...m, [a.id]: destino }));
    iniciar(async () => {
      const r = await cambiarEstadoAusencia(a.id, destino);
      if (!r.ok) {
        toast.error(r.error);
        setMovidas((m) => ({ ...m, [a.id]: origen }));
      }
    });
  }

  const hoy = hoyEnChile();
  const vigentes = ausencias.filter((a) => estadoDe(a) === "APROBADA" && a.desde <= hoy && a.hasta >= hoy);
  const solicitadas = ausencias.filter((a) => estadoDe(a) === "SOLICITADA").length;
  const esLicencia = tipo === "LICENCIA";
  const delAnio = ausencias.filter((a) => estadoDe(a) === "APROBADA" && a.desde.startsWith(hoy.slice(0, 4)));
  const diasAnio = delAnio.reduce((s, a) => s + a.dias, 0);

  const q = busqueda.trim().toLowerCase();
  const filtradas = ausencias.filter((a) => !q || a.trabajador.toLowerCase().includes(q) || (a.detalle ?? "").toLowerCase().includes(q));

  const conSaldos = !esLicencia && saldos && saldos.length > 0;

  const kanban = (
    <div className="grid items-start gap-4 md:grid-cols-3">
      {COLUMNAS.map((col) => {
        const tarjetas = filtradas.filter((a) => estadoDe(a) === col.estado);
        const alReceptor = sobre === col.estado && arrastrando !== null;
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
            className={cn("flex min-h-40 flex-col gap-2 rounded-xl border bg-muted/30 p-2 transition-colors", alReceptor ? "border-foreground/40 bg-muted/60" : "border-border")}
          >
            <header className="flex items-center gap-2 px-2 pt-2 pb-1">
              <span className={cn("size-2 rounded-full", col.punto)} />
              <h2 className="text-[0.85rem] font-semibold">{col.titulo}</h2>
              <span className="ml-auto text-[0.8rem] font-medium text-muted-foreground tabular-nums">{tarjetas.length}</span>
            </header>

            {tarjetas.length === 0 ? (
              <p className="px-2 py-6 text-center text-[0.8rem] text-muted-foreground">{col.vacio}</p>
            ) : (
              tarjetas.map((a) => (
                <article
                  key={a.id}
                  draggable
                  onDragStart={() => setArrastrando(a.id)}
                  onDragEnd={() => {
                    setArrastrando(null);
                    setSobre(null);
                  }}
                  onClick={() => setEditando(a)}
                  className={cn(
                    "cursor-grab rounded-lg border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-opacity hover:border-foreground/30 active:cursor-grabbing",
                    arrastrando === a.id && "opacity-40",
                    col.estado === "RECHAZADA" && "opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[0.9rem] leading-snug font-medium">{a.trabajador}</h3>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                      {TEXTO_TIPO_AUSENCIA[a.tipo as TipoAusencia]}
                    </span>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[0.8rem] text-muted-foreground tabular-nums">
                    <CalendarDays className="size-3.5 shrink-0" />
                    {fechaCorta(a.desde)} → {fechaCorta(a.hasta)}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[0.8rem]">
                    <span className="font-semibold tabular-nums">
                      {a.horas != null ? `${String(a.horas).replace(".", ",")} h` : `${a.dias} ${a.dias === 1 ? "día" : "días"}`}
                    </span>
                    {a.detalle && <span className="truncate text-muted-foreground">{a.detalle}</span>}
                  </div>

                  {/* Los botones sirven donde no se puede arrastrar (celular). */}
                  {col.estado === "SOLICITADA" && (
                    <div className="mt-2 grid grid-cols-2 gap-2 lg:hidden">
                      <Button
                        variant="outline"
                        className="h-8 rounded-full text-[0.8rem]"
                        onClick={(e) => {
                          e.stopPropagation();
                          mover(a, "RECHAZADA");
                        }}
                      >
                        Rechazar
                      </Button>
                      <Button
                        className="h-8 rounded-full text-[0.8rem]"
                        onClick={(e) => {
                          e.stopPropagation();
                          mover(a, "APROBADA");
                        }}
                      >
                        Aprobar
                      </Button>
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Un solo recuadro con los tres números: ocupa una fila, no tres tarjetas. */}
      <section aria-label="Resumen" data-tour="aus-kpis" className="grid divide-y divide-border rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-6 py-4">
          <p className="text-[0.8rem] text-muted-foreground">{esLicencia ? "Con licencia hoy" : "De vacaciones hoy"}</p>
          <p className="mt-1 text-[1.5rem] leading-none font-bold tabular-nums">{vigentes.length}</p>
          {vigentes.length > 0 && <p className="mt-2 truncate text-[0.8rem] text-muted-foreground">{vigentes.map((v) => v.trabajador).join(", ")}</p>}
        </div>
        <div className="px-6 py-4">
          <p className="text-[0.8rem] text-muted-foreground">{esLicencia ? "Días de licencia este año" : "Días tomados este año"}</p>
          <p className="mt-1 text-[1.5rem] leading-none font-bold tabular-nums">{diasAnio}</p>
        </div>
        <div className="px-6 py-4">
          <p className="text-[0.8rem] text-muted-foreground">Por aprobar</p>
          <p className={cn("mt-1 text-[1.5rem] leading-none font-bold tabular-nums", solicitadas > 0 && "text-amber-700 dark:text-amber-300")}>{solicitadas}</p>
        </div>
      </section>

      {personas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[1rem] font-medium">Primero agrega personas en Personal</p>
        </div>
      ) : (
        <div className={cn("grid items-start gap-6", conSaldos && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por persona o detalle…"
                className={cn(alto, "rounded-full px-4 text-[0.9rem] sm:w-80")}
                aria-label="Buscar"
              />
              <Button data-tour="aus-nueva" className={cn(alto, "rounded-full px-4 text-[0.9rem]")} onClick={() => setCreando(true)}>
                {esLicencia ? "+ Nueva licencia" : "+ Vacaciones o permiso"}
              </Button>
            </div>
            {ausencias.length === 0 && (
              <p className="text-[0.85rem] text-muted-foreground">
                {esLicencia
                  ? "Cuando alguien presente una licencia médica, regístrala con su folio y sus fechas."
                  : "Registra las vacaciones o permisos y arrástralos entre Solicitadas, Aprobadas y Rechazadas."}
              </p>
            )}
            {kanban}
          </div>

          {conSaldos && (
            <aside aria-label="Saldo de vacaciones" data-tour="aus-saldo" className="rounded-xl border border-border bg-card p-4 xl:sticky xl:top-4">
              <h2 className="text-[0.9rem] font-semibold">Saldo de vacaciones</h2>
              <p className="mt-1 text-[0.75rem] text-muted-foreground">1,25 días hábiles por mes trabajado (15 al año)</p>
              <ul className="mt-4 flex flex-col gap-4">
                {saldos.map((p) => {
                  const negativo = p.saldo !== null && p.saldo < 0;
                  const uso = p.ganados && p.ganados > 0 ? Math.min(100, Math.round((p.tomados / p.ganados) * 100)) : 0;
                  return (
                    <li key={p.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[0.9rem] font-medium">{p.nombre}</span>
                        {p.saldo === null ? null : (p.ganados ?? 0) === 0 ? (
                          <span className="shrink-0 text-[0.8rem] text-muted-foreground">Sin días aún</span>
                        ) : (
                          <span className={cn("shrink-0 text-[0.9rem] font-semibold tabular-nums", negativo && "text-red-600 dark:text-red-400")}>
                            {p.saldo} <span className="text-[0.75rem] font-normal text-muted-foreground">días</span>
                          </span>
                        )}
                      </div>
                      {p.saldo === null ? (
                        <p className="mt-1 text-[0.75rem] text-muted-foreground">Falta su fecha de ingreso en Personal.</p>
                      ) : (p.ganados ?? 0) > 0 ? (
                        <>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${uso} % de los días ganados ya se tomó`}>
                            <div className={cn("h-full rounded-full", negativo ? "bg-red-500" : "bg-foreground/60")} style={{ width: `${uso}%` }} />
                          </div>
                          <p className="mt-1 text-[0.75rem] text-muted-foreground tabular-nums">
                            {p.tomados} tomados de {p.ganados}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-[0.75rem] text-muted-foreground">Lleva menos de un mes en el comité.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}
        </div>
      )}

      {(creando || editando) && <AusenciaDialog key={editando?.id ?? "nueva"} ausencia={editando} tipo={tipo} personas={personas} onCerrar={cerrar} />}
    </div>
  );
}
