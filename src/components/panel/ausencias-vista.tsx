"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AusenciaDialog } from "@/components/panel/ausencia-dialog";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { TEXTO_ESTADO_AUSENCIA, TEXTO_TIPO_AUSENCIA, type AusenciaFila, type EstadoAusencia, type TipoAusencia } from "@/lib/rrhh-comun";
import { cn } from "@/lib/utils";

const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const alto = "h-10";
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";

const COLOR_ESTADO: Record<EstadoAusencia, string> = {
  APROBADA: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  SOLICITADA: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  RECHAZADA: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
};

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
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
  }, []);

  const hoy = hoyEnChile();
  const vigentes = ausencias.filter((a) => a.estado === "APROBADA" && a.desde <= hoy && a.hasta >= hoy);
  const solicitadas = ausencias.filter((a) => a.estado === "SOLICITADA").length;
  const esLicencia = tipo === "LICENCIA";
  const delAnio = ausencias.filter((a) => a.estado === "APROBADA" && a.desde.startsWith(hoy.slice(0, 4)));
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
          <h2 className="mb-3 text-[0.95rem] font-semibold">Saldo de vacaciones</h2>
          <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-120 border-collapse text-[0.95rem]">
              <thead>
                <tr className="border-b border-border bg-card">
                  {["Persona", "Ganados", "Tomados", "Saldo"].map((c) => (
                    <th key={c} className="px-5 py-3 text-left font-medium whitespace-nowrap text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {saldos.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-medium">{s.nombre}</td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{s.ganados === null ? "—" : s.ganados}</td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{s.tomados}</td>
                    <td className={cn("px-5 py-3 font-medium tabular-nums", s.saldo !== null && s.saldo < 0 && "text-red-600 dark:text-red-400")}>
                      {s.saldo === null ? <span className="text-[0.8rem] font-normal text-muted-foreground">Falta su fecha de ingreso</span> : `${s.saldo} días`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[0.75rem] text-muted-foreground">Se ganan 1,25 días hábiles por mes trabajado (15 al año). No descuenta feriados.</p>
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

      {filtradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">
            {personas.length === 0 ? "Primero agrega personas en Personal" : ausencias.length === 0 ? "Sin registros" : "Nada coincide con la búsqueda"}
          </p>
        </div>
      ) : (
        <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-160 border-collapse text-[0.95rem]">
            <thead>
              <tr className="border-b border-border bg-card">
                {["Persona", "Tipo", "Desde", "Hasta", "Días", "Estado"].map((c) => (
                  <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((a) => (
                <tr key={a.id} onClick={() => setEditando(a)} className="cursor-pointer border-b border-border last:border-0 hover:bg-card/50">
                  <td className="px-5 py-4">
                    <div className="font-medium">{a.trabajador}</div>
                    {a.detalle && <div className="text-[0.8rem] text-muted-foreground">{a.detalle}</div>}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{TEXTO_TIPO_AUSENCIA[a.tipo as TipoAusencia]}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{fechaCorta(a.desde)}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{fechaCorta(a.hasta)}</td>
                  <td className="px-5 py-4 font-medium whitespace-nowrap tabular-nums">{a.dias}</td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={cn("rounded-full px-3 py-1 text-[0.8rem] font-medium", COLOR_ESTADO[a.estado])}>{TEXTO_ESTADO_AUSENCIA[a.estado]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creando || editando) && <AusenciaDialog key={editando?.id ?? "nueva"} ausencia={editando} tipo={tipo} personas={personas} onCerrar={cerrar} />}
    </div>
  );
}
