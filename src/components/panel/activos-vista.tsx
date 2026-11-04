"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActivoDialog } from "@/components/panel/activo-dialog";
import { CATEGORIAS_ACTIVO, TEXTO_ESTADO_ACTIVO, textoCategoriaActivo, valorActual, type ActivoFila, type EstadoActivo } from "@/lib/activos-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const alto = "h-10";
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";

const COLOR_ESTADO: Record<EstadoActivo, string> = {
  OPERATIVO: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  EN_REPARACION: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  BAJA: "bg-muted text-muted-foreground",
};

/** Los activos fijos del comité y cuánto vale cada uno hoy (depreciación lineal según su vida útil). */
export function ActivosVista({ activos }: { activos: ActivoFila[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<ActivoFila | null>(null);
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
  }, []);

  const hoy = hoyEnChile();
  const vigentes = activos.filter((a) => a.estado !== "BAJA");
  const costoTotal = vigentes.reduce((s, a) => s + a.costo, 0);
  const valorTotal = vigentes.reduce((s, a) => s + valorActual(a, hoy).valorLibro, 0);
  const enReparacion = vigentes.filter((a) => a.estado === "EN_REPARACION").length;

  const q = busqueda.trim().toLowerCase();
  const filtrados = activos.filter((a) => {
    if (categoria !== "todas" && a.categoria !== categoria) return false;
    if (!q) return true;
    return a.nombre.toLowerCase().includes(q) || (a.codigo ?? "").toLowerCase().includes(q) || (a.ubicacion ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Bienes</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{vigentes.length}</p>
          {activos.length > vigentes.length && <p className="mt-2 text-[0.8rem] text-muted-foreground">{activos.length - vigentes.length} dados de baja</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Costo de adquisición</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{clp.format(costoTotal)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className={cn(etiquetaKpi, "text-emerald-800 dark:text-emerald-300")}>Valor actual</p>
          <p className="mt-3 text-[2rem] leading-none font-bold text-emerald-800 tabular-nums dark:text-emerald-300">{clp.format(valorTotal)}</p>
        </div>
        <div className={cn("rounded-xl border p-5", enReparacion > 0 ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10" : "border-border bg-card")}>
          <p className={cn(etiquetaKpi, enReparacion > 0 ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>En reparación</p>
          <p className={cn("mt-3 text-[2rem] leading-none font-bold tabular-nums", enReparacion > 0 && "text-amber-800 dark:text-amber-300")}>{enReparacion}</p>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, código o ubicación…"
          className={cn(alto, "rounded-full px-5 text-[0.95rem] sm:w-96")}
          aria-label="Buscar"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            aria-label="Categoría"
            className={cn(
              alto,
              "rounded-xl border border-input bg-transparent px-4 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            )}
          >
            <option value="todas">Todas las categorías</option>
            {CATEGORIAS_ACTIVO.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.texto}
              </option>
            ))}
          </select>
          <Button className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
            + Nuevo bien
          </Button>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">{activos.length === 0 ? "Sin bienes registrados" : "Nada coincide con la búsqueda"}</p>
          {activos.length === 0 && (
            <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
              Registra la bomba, el estanque, el terreno y demás bienes del comité para saber qué tienes y cuánto vale.
            </p>
          )}
        </div>
      ) : (
        <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-200 border-collapse text-[0.95rem]">
            <thead>
              <tr className="border-b border-border bg-card">
                {["Bien", "Categoría", "Adquirido", "Costo", "Valor actual", "Estado"].map((c) => (
                  <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => {
                const v = valorActual(a, hoy);
                return (
                  <tr key={a.id} onClick={() => setEditando(a)} className={cn("cursor-pointer border-b border-border last:border-0 hover:bg-card/50", a.estado === "BAJA" && "opacity-60")}>
                    <td className="px-5 py-4">
                      <div className="font-medium">{a.nombre}</div>
                      {(a.codigo || a.ubicacion) && <div className="text-[0.8rem] text-muted-foreground">{[a.codigo, a.ubicacion].filter(Boolean).join(" · ")}</div>}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{textoCategoriaActivo(a.categoria)}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{fechaCorta(a.fechaAdquisicion)}</td>
                    <td className="px-5 py-4 whitespace-nowrap tabular-nums">{clp.format(a.costo)}</td>
                    <td className="px-5 py-4 font-medium whitespace-nowrap tabular-nums">
                      {a.estado === "BAJA" ? "—" : clp.format(v.valorLibro)}
                      {a.vidaUtilAnios > 0 && a.estado !== "BAJA" && v.valorLibro === 0 && <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground">vida útil cumplida</span>}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={cn("rounded-full px-3 py-1 text-[0.8rem] font-medium", COLOR_ESTADO[a.estado])}>{TEXTO_ESTADO_ACTIVO[a.estado]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(creando || editando) && <ActivoDialog key={editando?.id ?? "nuevo"} activo={editando} onCerrar={cerrar} />}
    </div>
  );
}
