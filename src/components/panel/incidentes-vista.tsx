"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IncidenteDialog } from "@/components/panel/incidente-dialog";
import {
  TEXTO_ESTADO_INCIDENTE,
  TEXTO_PRIORIDAD,
  textoTipoIncidente,
  type EstadoIncidente,
  type IncidenteFila,
} from "@/lib/incidentes-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const alto = "h-10";
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";

const COLOR_ESTADO: Record<EstadoIncidente, string> = {
  ABIERTO: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  EN_REPARACION: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  RESUELTO: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

const COLOR_PRIORIDAD: Record<string, string> = {
  ALTA: "font-medium text-red-600 dark:text-red-400",
  MEDIA: "text-foreground",
  BAJA: "text-muted-foreground",
};

type Filtro = "todos" | "activos" | EstadoIncidente;

/** Los incidentes del sistema de agua: lo que sigue abierto arriba, y el costo de cada reparación. */
export function IncidentesVista({ incidentes }: { incidentes: IncidenteFila[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<IncidenteFila | null>(null);
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
  }, []);

  const mes = hoyEnChile().slice(0, 7);
  const abiertos = incidentes.filter((i) => i.estado === "ABIERTO").length;
  const enReparacion = incidentes.filter((i) => i.estado === "EN_REPARACION").length;
  const resueltosMes = incidentes.filter((i) => i.estado === "RESUELTO" && (i.fechaResolucion ?? "").startsWith(mes)).length;
  const costoMes = incidentes.filter((i) => (i.fechaResolucion ?? i.fecha).startsWith(mes)).reduce((s, i) => s + i.costo, 0);

  const q = busqueda.trim().toLowerCase();
  const filtrados = incidentes.filter((i) => {
    if (filtro === "activos" && i.estado === "RESUELTO") return false;
    if (filtro !== "todos" && filtro !== "activos" && i.estado !== filtro) return false;
    if (!q) return true;
    return (
      `i-${i.numero}`.includes(q) ||
      i.titulo.toLowerCase().includes(q) ||
      (i.lugar ?? "").toLowerCase().includes(q) ||
      (i.responsable ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-4">
        <div className={cn("rounded-xl border p-5", abiertos > 0 ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10" : "border-border bg-card")}>
          <p className={cn(etiquetaKpi, abiertos > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>Abiertos</p>
          <p className={cn("mt-3 text-[2rem] leading-none font-bold tabular-nums", abiertos > 0 && "text-red-600 dark:text-red-400")}>{abiertos}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>En reparación</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{enReparacion}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Resueltos este mes</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{resueltosMes}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Costo este mes</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{clp.format(costoMes)}</p>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número, título, lugar o responsable…"
          className={cn(alto, "rounded-full px-5 text-[0.95rem] sm:w-96")}
          aria-label="Buscar"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as Filtro)}
            aria-label="Estado"
            className={cn(
              alto,
              "rounded-xl border border-input bg-transparent px-4 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            )}
          >
            <option value="activos">Sin resolver</option>
            <option value="todos">Todos</option>
            <option value="ABIERTO">Abiertos</option>
            <option value="EN_REPARACION">En reparación</option>
            <option value="RESUELTO">Resueltos</option>
          </select>
          <Button className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
            + Nuevo incidente
          </Button>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">{incidentes.length === 0 ? "Sin incidentes registrados" : "Nada coincide con la búsqueda"}</p>
          {incidentes.length === 0 && (
            <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
              Anota las fugas, fallas de bomba o cortes del sistema para llevar su historial y lo que costó repararlos.
            </p>
          )}
        </div>
      ) : (
        <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-160 border-collapse text-[0.95rem]">
            <thead>
              <tr className="border-b border-border bg-card">
                {["N°", "Incidente", "Tipo", "Prioridad", "Fecha", "Estado", "Costo"].map((c) => (
                  <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => (
                <tr key={i.id} onClick={() => setEditando(i)} className="cursor-pointer border-b border-border last:border-0 hover:bg-card/50">
                  <td className="px-5 py-4 font-medium whitespace-nowrap">I-{i.numero}</td>
                  <td className="px-5 py-4">
                    <div className="font-medium">{i.titulo}</div>
                    {i.lugar && <div className="text-[0.8rem] text-muted-foreground">{i.lugar}</div>}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{textoTipoIncidente(i.tipo)}</td>
                  <td className={cn("px-5 py-4 whitespace-nowrap", COLOR_PRIORIDAD[i.prioridad])}>{TEXTO_PRIORIDAD[i.prioridad]}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{fechaCorta(i.fecha)}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={cn("rounded-full px-3 py-1 text-[0.8rem] font-medium", COLOR_ESTADO[i.estado])}>{TEXTO_ESTADO_INCIDENTE[i.estado]}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap tabular-nums">{i.costo > 0 ? clp.format(i.costo) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creando || editando) && <IncidenteDialog key={editando?.id ?? "nuevo"} incidente={editando} onCerrar={cerrar} />}
    </div>
  );
}
