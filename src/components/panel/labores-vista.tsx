"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { MapPin, Package, User } from "lucide-react";
import { cambiarEstadoLabor } from "@/app/panel/labores/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LaborDialog } from "@/components/panel/labor-dialog";
import { costoMateriales, textoTipoLabor, type EstadoLabor, type LaborFila } from "@/lib/labores-comun";
import type { Insumo } from "@/lib/inventario-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const alto = "h-10";
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";

const COLUMNAS: { estado: EstadoLabor; titulo: string; punto: string; vacio: string }[] = [
  { estado: "PROGRAMADA", titulo: "Programadas", punto: "bg-sky-500", vacio: "Sin labores programadas" },
  { estado: "EN_CURSO", titulo: "En curso", punto: "bg-amber-500", vacio: "Nada en curso" },
  { estado: "HECHA", titulo: "Hechas", punto: "bg-emerald-500", vacio: "Aún no hay labores hechas" },
];

/**
 * Las labores de operación como tablero: una columna por estado. Al pasar una a «Hecha» sus materiales
 * se descuentan del inventario; al sacarla de ahí, vuelven.
 */
export function LaboresVista({ labores, insumos }: { labores: LaborFila[]; insumos: Insumo[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<LaborFila | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<EstadoLabor | null>(null);
  const [movidas, setMovidas] = useState<Record<string, EstadoLabor>>({});
  const [, iniciar] = useTransition();
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
    setMovidas({});
  }, []);

  const estadoDe = (l: LaborFila) => movidas[l.id] ?? l.estado;

  function mover(l: LaborFila, destino: EstadoLabor) {
    const origen = estadoDe(l);
    if (origen === destino) return;
    setMovidas((m) => ({ ...m, [l.id]: destino }));
    iniciar(async () => {
      const r = await cambiarEstadoLabor(l.id, destino);
      if (r.ok) {
        // La tarjeta ya se movió; lo que cambió en el inventario se avisa al pasar a/desde Hecha.
        if (destino === "HECHA" && l.materiales.length > 0) toast.success("Materiales descontados del inventario");
        if (origen === "HECHA" && l.materiales.length > 0) toast.success("Materiales devueltos al inventario");
      } else {
        toast.error(r.error);
        setMovidas((m) => ({ ...m, [l.id]: origen }));
      }
    });
  }

  const mes = hoyEnChile().slice(0, 7);
  const programadas = labores.filter((l) => estadoDe(l) === "PROGRAMADA").length;
  const enCurso = labores.filter((l) => estadoDe(l) === "EN_CURSO").length;
  const hechasMes = labores.filter((l) => estadoDe(l) === "HECHA" && (l.fechaTermino ?? l.fecha).startsWith(mes));
  const costoMes = hechasMes.reduce((s, l) => s + costoMateriales(l), 0);

  const q = busqueda.trim().toLowerCase();
  const filtradas = labores.filter(
    (l) =>
      !q ||
      `l-${l.numero}`.includes(q) ||
      l.titulo.toLowerCase().includes(q) ||
      (l.lugar ?? "").toLowerCase().includes(q) ||
      (l.responsable ?? "").toLowerCase().includes(q) ||
      l.materiales.some((m) => m.nombre.toLowerCase().includes(q))
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Programadas</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{programadas}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>En curso</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{enCurso}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Hechas este mes</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{hechasMes.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Materiales usados este mes</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{clp.format(costoMes)}</p>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número, título, lugar, responsable o material…"
          className={cn(alto, "rounded-full px-5 text-[0.95rem] sm:w-96")}
          aria-label="Buscar"
        />
        <Button className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
          + Nueva labor
        </Button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {COLUMNAS.map((col) => {
          const tarjetas = filtradas.filter((l) => estadoDe(l) === col.estado);
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
                const lab = labores.find((l) => l.id === arrastrando);
                if (lab) mover(lab, col.estado);
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
                tarjetas.map((l) => {
                  const costo = costoMateriales(l);
                  return (
                    <article
                      key={l.id}
                      draggable
                      onDragStart={() => setArrastrando(l.id)}
                      onDragEnd={() => {
                        setArrastrando(null);
                        setSobre(null);
                      }}
                      onClick={() => setEditando(l)}
                      className={cn(
                        "cursor-grab rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-opacity hover:border-foreground/30 active:cursor-grabbing",
                        arrastrando === l.id && "opacity-40",
                        col.estado === "HECHA" && "opacity-80"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.8rem] font-medium text-muted-foreground">L-{l.numero}</span>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[0.75rem] font-medium text-muted-foreground">{textoTipoLabor(l.tipo)}</span>
                      </div>
                      <h3 className="mt-2 text-[0.95rem] leading-snug font-medium">{l.titulo}</h3>

                      <div className="mt-3 flex flex-col gap-1 text-[0.8rem] text-muted-foreground">
                        {l.lugar && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="size-3.5 shrink-0" />
                            <span className="truncate">{l.lugar}</span>
                          </span>
                        )}
                        {l.responsable && (
                          <span className="flex items-center gap-1.5">
                            <User className="size-3.5 shrink-0" />
                            <span className="truncate">{l.responsable}</span>
                          </span>
                        )}
                        {l.materiales.length > 0 && (
                          <span className="flex items-center gap-1.5">
                            <Package className="size-3.5 shrink-0" />
                            <span className="truncate">
                              {l.materiales.length === 1 ? "1 material" : `${l.materiales.length} materiales`}
                              {l.descontada && " · descontados"}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-[0.8rem]">
                        <span className="text-muted-foreground tabular-nums">
                          {col.estado === "HECHA" && l.fechaTermino ? `Hecha ${fechaCorta(l.fechaTermino)}` : fechaCorta(l.fecha)}
                        </span>
                        {costo > 0 && <span className="font-medium tabular-nums">{clp.format(costo)}</span>}
                      </div>

                      {col.estado !== "HECHA" && (
                        <Button
                          variant="outline"
                          className="mt-3 h-8 w-full rounded-full text-[0.8rem] lg:hidden"
                          onClick={(e) => {
                            e.stopPropagation();
                            mover(l, col.estado === "PROGRAMADA" ? "EN_CURSO" : "HECHA");
                          }}
                        >
                          {col.estado === "PROGRAMADA" ? "Pasar a en curso" : "Marcar hecha"}
                        </Button>
                      )}
                    </article>
                  );
                })
              )}
            </section>
          );
        })}
      </div>

      {(creando || editando) && <LaborDialog key={editando?.id ?? "nueva"} labor={editando} insumos={insumos} onCerrar={cerrar} />}
    </div>
  );
}
