"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, ClipboardList, Clock3, Droplet, MapPin, Package, Wrench, type LucideIcon } from "lucide-react";
import { cambiarEstadoLabor } from "@/app/panel/labores/actions";
import { avisarCambio } from "@/lib/avisos-datos";
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

/** La franja de color de cada tarjeta según su estado (todas con buen contraste con el texto blanco). */
const BANDA: Record<EstadoLabor, string> = {
  PROGRAMADA: "bg-sky-700",
  EN_CURSO: "bg-amber-700",
  HECHA: "bg-emerald-700",
};

const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function iconoDe(tipo: string): LucideIcon {
  if (tipo === "CLORACION") return Droplet;
  if (tipo === "REPARACION") return Wrench;
  return ClipboardList;
}

/** Un número del resumen, con su ícono en un recuadro de color (el ícono se oculta en pantallas chicas). */
function Kpi({ etiqueta, valor, icono: Icono, tono, destacado = false }: { etiqueta: string; valor: string; icono: LucideIcon; tono: string; destacado?: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <span aria-hidden className={cn("hidden size-11 shrink-0 items-center justify-center rounded-xl text-white lg:flex", tono)}>
        <Icono className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.8rem] leading-tight font-medium text-muted-foreground">{etiqueta}</p>
        <p className={cn("mt-0.5 text-[1.5rem] leading-tight font-bold tabular-nums", destacado && "text-primary")}>{valor}</p>
      </div>
    </div>
  );
}

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
        if (l.materiales.length > 0 && (destino === "HECHA" || origen === "HECHA")) avisarCambio("inventario");
        if (destino === "HECHA" && l.materiales.length > 0) toast.success("Materiales descontados del inventario");
        if (origen === "HECHA" && l.materiales.length > 0) toast.success("Materiales devueltos al inventario");
      } else {
        toast.error(r.error);
        setMovidas((m) => ({ ...m, [l.id]: origen }));
      }
    });
  }

  const hoy = hoyEnChile();
  const mes = hoy.slice(0, 7);
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
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-tour="lab-kpis">
        <Kpi etiqueta="Programadas" valor={String(programadas)} icono={CalendarDays} tono="bg-sky-600" />
        <Kpi etiqueta="En curso" valor={String(enCurso)} icono={Clock3} tono="bg-amber-600" />
        <Kpi etiqueta="Hechas este mes" valor={String(hechasMes.length)} icono={Check} tono="bg-emerald-600" />
        <Kpi etiqueta="Materiales usados este mes" valor={clp.format(costoMes)} icono={Package} tono="bg-primary" destacado />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número, título, lugar, responsable o material…"
          className={cn(alto, "rounded-full px-5 text-[0.95rem] sm:w-96")}
          aria-label="Buscar"
        />
        <Button data-tour="lab-nueva" className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
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
                  const Icono = iconoDe(l.tipo);
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
                        "cursor-grab overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-opacity hover:border-foreground/30 active:cursor-grabbing",
                        arrastrando === l.id && "opacity-40",
                        col.estado === "HECHA" && "opacity-80"
                      )}
                    >
                      <div className={cn("flex items-center justify-between gap-2 px-4 py-2 text-white", BANDA[col.estado])}>
                        <span className="flex min-w-0 items-center gap-2 text-[0.85rem] font-semibold">
                          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/20">
                            <Icono className="size-3.5" />
                          </span>
                          <span className="truncate">
                            L-{l.numero} · {textoTipoLabor(l.tipo)}
                          </span>
                        </span>
                        {col.estado !== "HECHA" && l.fecha === hoy && <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[0.7rem] font-bold text-sky-800">Hoy</span>}
                        {col.estado === "HECHA" && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[0.7rem] font-bold text-emerald-800">
                            <Check className="size-3" aria-hidden />
                            Hecha
                          </span>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="text-[0.95rem] leading-snug font-semibold">{l.titulo}</h3>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-muted/60 px-3 py-2">
                            <p className="flex items-center gap-1 text-[0.72rem] text-muted-foreground">
                              <CalendarDays className="size-3.5" aria-hidden />
                              {col.estado === "HECHA" && l.fechaTermino ? "Terminada" : "Fecha"}
                            </p>
                            <p className="mt-0.5 text-[0.85rem] font-semibold tabular-nums">
                              {fechaCorta(col.estado === "HECHA" && l.fechaTermino ? l.fechaTermino : l.fecha)}
                              {col.estado !== "HECHA" && l.hora && <span className="font-normal text-muted-foreground"> · {l.hora}</span>}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/60 px-3 py-2">
                            <p className="flex items-center gap-1 text-[0.72rem] text-muted-foreground">
                              <Package className="size-3.5" aria-hidden />
                              Materiales
                            </p>
                            <p className="mt-0.5 text-[0.85rem] font-semibold">
                              {l.materiales.length === 0 ? "Sin materiales" : `${l.materiales.length}${l.descontada ? " · usados" : ""}`}
                            </p>
                          </div>
                        </div>
                        {col.estado !== "HECHA" && l.fechaTermino && (
                          <p className={cn("mt-3 flex items-center gap-1.5 text-[0.8rem]", l.vencida ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                            <Clock3 className="size-3.5 shrink-0" aria-hidden />
                            {l.vencida ? "Ya debía terminar: revisa el stock de sus materiales" : `Termina ${fechaCorta(l.fechaTermino)}${l.horaFin ? ` · ${l.horaFin}` : ""}`}
                          </p>
                        )}
                        {l.lugar && (
                          <p className="mt-3 flex items-center gap-1.5 text-[0.8rem] text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{l.lugar}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-2.5">
                        {l.responsable ? (
                          <span className="flex min-w-0 items-center gap-2 text-[0.8rem] font-medium">
                            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.65rem] font-bold text-primary">
                              {iniciales(l.responsable)}
                            </span>
                            <span className="truncate">{l.responsable}</span>
                          </span>
                        ) : (
                          <span className="text-[0.8rem] text-muted-foreground">Sin responsable</span>
                        )}
                        {costo > 0 && <span className="shrink-0 text-[0.95rem] font-bold tabular-nums">{clp.format(costo)}</span>}
                      </div>

                      {col.estado !== "HECHA" && (
                        <Button
                          variant="outline"
                          className="m-4 mt-0 h-8 w-[calc(100%-2rem)] rounded-full text-[0.8rem] lg:hidden"
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
