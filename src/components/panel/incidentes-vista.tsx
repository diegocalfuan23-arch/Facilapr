"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { MapPin, User } from "lucide-react";
import { cambiarEstadoIncidente } from "@/app/panel/incidentes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IncidenteDialog } from "@/components/panel/incidente-dialog";
import { TEXTO_PRIORIDAD, textoTipoIncidente, type EstadoIncidente, type IncidenteFila } from "@/lib/incidentes-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const alto = "h-10";
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";

const COLUMNAS: { estado: EstadoIncidente; titulo: string; punto: string; vacio: string }[] = [
  { estado: "ABIERTO", titulo: "Abiertos", punto: "bg-red-500", vacio: "Sin incidentes abiertos" },
  { estado: "EN_REPARACION", titulo: "En reparación", punto: "bg-amber-500", vacio: "Nada en reparación" },
  { estado: "RESUELTO", titulo: "Resueltos", punto: "bg-emerald-500", vacio: "Aún no hay resueltos" },
];

const COLOR_PRIORIDAD: Record<string, string> = {
  ALTA: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  MEDIA: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  BAJA: "bg-muted text-muted-foreground",
};

/**
 * Los incidentes del sistema de agua como tablero: una columna por estado. Se arrastra una tarjeta a
 * otra columna para cambiar su estado (o se usa el botón de la tarjeta, que sirve en el celular).
 */
export function IncidentesVista({ incidentes }: { incidentes: IncidenteFila[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<IncidenteFila | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<EstadoIncidente | null>(null);
  // El estado se ve cambiar al instante; si el servidor falla, se vuelve atrás.
  const [movidos, setMovidos] = useState<Record<string, EstadoIncidente>>({});
  const [, iniciar] = useTransition();
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
    // Lo que se editó en el diálogo manda sobre lo que se movió antes en el tablero.
    setMovidos({});
  }, []);

  const estadoDe = (i: IncidenteFila) => movidos[i.id] ?? i.estado;

  function mover(i: IncidenteFila, destino: EstadoIncidente) {
    const origen = estadoDe(i);
    if (origen === destino) return;
    setMovidos((m) => ({ ...m, [i.id]: destino }));
    iniciar(async () => {
      const r = await cambiarEstadoIncidente(i.id, destino);
      if (!r.ok) {
        toast.error(r.error);
        setMovidos((m) => ({ ...m, [i.id]: origen }));
      }
    });
  }

  const mes = hoyEnChile().slice(0, 7);
  const abiertos = incidentes.filter((i) => estadoDe(i) === "ABIERTO").length;
  const enReparacion = incidentes.filter((i) => estadoDe(i) === "EN_REPARACION").length;
  const resueltosMes = incidentes.filter((i) => estadoDe(i) === "RESUELTO" && (i.fechaResolucion ?? i.fecha).startsWith(mes)).length;
  const costoMes = incidentes.filter((i) => (i.fechaResolucion ?? i.fecha).startsWith(mes)).reduce((s, i) => s + i.costo, 0);

  const q = busqueda.trim().toLowerCase();
  const filtrados = incidentes.filter(
    (i) =>
      !q ||
      `i-${i.numero}`.includes(q) ||
      i.titulo.toLowerCase().includes(q) ||
      (i.lugar ?? "").toLowerCase().includes(q) ||
      (i.responsable ?? "").toLowerCase().includes(q)
  );

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
        <Button className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
          + Nuevo incidente
        </Button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {COLUMNAS.map((col) => {
          const tarjetas = filtrados.filter((i) => estadoDe(i) === col.estado);
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
                const inc = incidentes.find((i) => i.id === arrastrando);
                if (inc) mover(inc, col.estado);
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
                tarjetas.map((i) => (
                  <article
                    key={i.id}
                    draggable
                    onDragStart={() => setArrastrando(i.id)}
                    onDragEnd={() => {
                      setArrastrando(null);
                      setSobre(null);
                    }}
                    onClick={() => setEditando(i)}
                    className={cn(
                      "cursor-grab rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-opacity hover:border-foreground/30 active:cursor-grabbing",
                      arrastrando === i.id && "opacity-40",
                      col.estado === "RESUELTO" && "opacity-80"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[0.8rem] font-medium text-muted-foreground">I-{i.numero}</span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium", COLOR_PRIORIDAD[i.prioridad])}>{TEXTO_PRIORIDAD[i.prioridad]}</span>
                    </div>
                    <h3 className="mt-2 text-[0.95rem] leading-snug font-medium">{i.titulo}</h3>
                    <p className="mt-1 text-[0.8rem] text-muted-foreground">{textoTipoIncidente(i.tipo)}</p>

                    <div className="mt-3 flex flex-col gap-1 text-[0.8rem] text-muted-foreground">
                      {i.lugar && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0" />
                          <span className="truncate">{i.lugar}</span>
                        </span>
                      )}
                      {i.responsable && (
                        <span className="flex items-center gap-1.5">
                          <User className="size-3.5 shrink-0" />
                          <span className="truncate">{i.responsable}</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-[0.8rem]">
                      <span className="text-muted-foreground tabular-nums">
                        {col.estado === "RESUELTO" && i.fechaResolucion ? `Resuelto ${fechaCorta(i.fechaResolucion)}` : fechaCorta(i.fecha)}
                      </span>
                      {i.costo > 0 && <span className="font-medium tabular-nums">{clp.format(i.costo)}</span>}
                    </div>

                    {/* El botón sirve donde no se puede arrastrar (celular) y lleva a la siguiente etapa. */}
                    {col.estado !== "RESUELTO" && (
                      <Button
                        variant="outline"
                        className="mt-3 h-8 w-full rounded-full text-[0.8rem] lg:hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          mover(i, col.estado === "ABIERTO" ? "EN_REPARACION" : "RESUELTO");
                        }}
                      >
                        {col.estado === "ABIERTO" ? "Pasar a en reparación" : "Marcar resuelto"}
                      </Button>
                    )}
                  </article>
                ))
              )}
            </section>
          );
        })}
      </div>

      {(creando || editando) && <IncidenteDialog key={editando?.id ?? "nuevo"} incidente={editando} onCerrar={cerrar} />}
    </div>
  );
}
