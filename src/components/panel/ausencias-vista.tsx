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
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";

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

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>{esLicencia ? "Con licencia hoy" : "De vacaciones hoy"}</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{vigentes.length}</p>
          {vigentes.length > 0 && <p className="mt-2 truncate text-[0.8rem] text-muted-foreground">{vigentes.map((v) => v.trabajador).join(", ")}</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>{esLicencia ? "Días de licencia este año" : "Días tomados este año"}</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{diasAnio}</p>
        </div>
        <div className={cn("rounded-xl border p-5", solicitadas > 0 ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10" : "border-border bg-card")}>
          <p className={cn(etiquetaKpi, solicitadas > 0 ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>Por aprobar</p>
          <p className={cn("mt-3 text-[2rem] leading-none font-bold tabular-nums", solicitadas > 0 && "text-amber-800 dark:text-amber-300")}>{solicitadas}</p>
        </div>
      </section>

      {!esLicencia && saldos && saldos.length > 0 && (
        <section aria-label="Saldo de vacaciones">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[0.95rem] font-semibold">Saldo de vacaciones</h2>
            <p className="text-[0.75rem] text-muted-foreground">1,25 días hábiles por mes trabajado (15 al año)</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saldos.map((p) => {
              const sinFecha = p.saldo === null;
              const sinAcumular = !sinFecha && (p.ganados ?? 0) === 0;
              const uso = p.ganados && p.ganados > 0 ? Math.min(100, Math.round((p.tomados / p.ganados) * 100)) : 0;
              const negativo = p.saldo !== null && p.saldo < 0;
              return (
                <div key={p.id} className="rounded-xl border border-border bg-card p-5">
                  <p className="truncate text-[0.95rem] font-medium">{p.nombre}</p>
                  {sinFecha ? (
                    <p className="mt-3 text-[0.85rem] text-muted-foreground">Agrega su fecha de ingreso en Personal para calcular sus días.</p>
                  ) : sinAcumular ? (
                    <p className="mt-3 text-[0.85rem] text-muted-foreground">Aún no acumula días: lleva menos de un mes en el comité.</p>
                  ) : (
                    <>
                      <p className={cn("mt-3 text-[2rem] leading-none font-bold tabular-nums", negativo && "text-red-600 dark:text-red-400")}>
                        {p.saldo}
                        <span className="ml-1.5 text-[0.85rem] font-normal text-muted-foreground">días disponibles</span>
                      </p>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${uso} % de los días ganados ya se tomó`}>
                        <div className={cn("h-full rounded-full", negativo ? "bg-red-500" : "bg-primary")} style={{ width: `${uso}%` }} />
                      </div>
                      <p className="mt-2 text-[0.75rem] text-muted-foreground tabular-nums">
                        {p.tomados} tomados de {p.ganados} ganados
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por persona o detalle…"
          className={cn(alto, "rounded-full px-5 text-[0.95rem] sm:w-96")}
          aria-label="Buscar"
        />
        <Button className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)} disabled={personas.length === 0}>
          {esLicencia ? "+ Nueva licencia" : "+ Nuevas vacaciones o permiso"}
        </Button>
      </div>

      {personas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">Primero agrega personas en Personal</p>
        </div>
      ) : ausencias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[1.05rem] font-medium">{esLicencia ? "Aún no hay licencias registradas" : "Aún no hay vacaciones ni permisos"}</p>
          <p className="mx-auto mt-2 max-w-md px-4 text-[0.95rem] text-muted-foreground">
            {esLicencia
              ? "Cuando alguien presente una licencia médica, regístrala aquí con su folio y sus fechas."
              : "Registra las vacaciones o permisos de tu equipo y arrástralos entre Solicitadas, Aprobadas y Rechazadas."}
          </p>
          <Button className="mt-5 h-10 rounded-full px-5 text-[0.95rem]" onClick={() => setCreando(true)}>
            {esLicencia ? "+ Nueva licencia" : "+ Nuevas vacaciones o permiso"}
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
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
                className={cn("flex min-h-48 flex-col gap-3 rounded-xl border bg-card/40 p-3 transition-colors", alReceptor ? "border-primary bg-primary/5" : "border-border")}
              >
                <header className="flex items-center gap-2 px-1.5 pt-1">
                  <span className={cn("size-2.5 rounded-full", col.punto)} />
                  <h2 className="text-[0.95rem] font-semibold">{col.titulo}</h2>
                  <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-[0.8rem] font-medium text-muted-foreground tabular-nums">{tarjetas.length}</span>
                </header>

                {tarjetas.length === 0 ? (
                  <p className="px-2 py-8 text-center text-[0.85rem] text-muted-foreground">{col.vacio}</p>
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
                        "cursor-grab rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-opacity hover:border-foreground/30 active:cursor-grabbing",
                        arrastrando === a.id && "opacity-40",
                        col.estado === "RECHAZADA" && "opacity-70"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[0.95rem] leading-snug font-medium">{a.trabajador}</h3>
                        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[0.75rem] font-medium text-muted-foreground">
                          {TEXTO_TIPO_AUSENCIA[a.tipo as TipoAusencia]}
                        </span>
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-[0.85rem] text-muted-foreground tabular-nums">
                        <CalendarDays className="size-3.5 shrink-0" />
                        {fechaCorta(a.desde)} → {fechaCorta(a.hasta)}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-[0.8rem]">
                        <span className="font-medium tabular-nums">
                          {a.dias} {a.dias === 1 ? "día" : "días"}
                        </span>
                        {a.detalle && <span className="truncate text-muted-foreground">{a.detalle}</span>}
                      </div>

                      {/* Los botones sirven donde no se puede arrastrar (celular). */}
                      {col.estado === "SOLICITADA" && (
                        <div className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
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
      )}

      {(creando || editando) && <AusenciaDialog key={editando?.id ?? "nueva"} ausencia={editando} tipo={tipo} personas={personas} onCerrar={cerrar} />}
    </div>
  );
}
