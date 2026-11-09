"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronRight, Plus, Search, X } from "lucide-react";
import { cambiarEstadoIncidente } from "@/app/panel/incidentes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IncidenteDialog } from "@/components/panel/incidente-dialog";
import { TEXTO_PRIORIDAD, afectaUnBien, textoTipoIncidente, type ActivoAfectable, type EstadoIncidente, type IncidenteFila, type PrioridadIncidente } from "@/lib/incidentes-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const clp = (n: number) => "$" + n.toLocaleString("es-CL");
const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";

const TEXTO_ESTADO: Record<EstadoIncidente, string> = { ABIERTO: "Abierto", EN_REPARACION: "En reparación", RESUELTO: "Resuelto" };
const PUNTO: Record<EstadoIncidente, string> = { ABIERTO: "bg-[#D6403D]", EN_REPARACION: "bg-[#E58200]", RESUELTO: "bg-[#0A9B68]" };
const SIGUIENTE: Partial<Record<EstadoIncidente, { a: EstadoIncidente; texto: string }>> = {
  ABIERTO: { a: "EN_REPARACION", texto: "Iniciar reparación" },
  EN_REPARACION: { a: "RESUELTO", texto: "Marcar resuelto" },
};
const ESTADOS: EstadoIncidente[] = ["ABIERTO", "EN_REPARACION", "RESUELTO"];
const ORDEN_PRIORIDAD: Record<PrioridadIncidente, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// ---- fechas como texto AAAA-MM-DD
const aUtc = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};
const diasEntre = (desde: string, hasta: string) => Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000);
const hace = (n: number) => (n <= 0 ? "hoy" : n === 1 ? "hace 1 día" : `hace ${n} días`);
const corto = (iso: string) => `${Number(iso.slice(8))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Filtro = "activos" | EstadoIncidente | "todos";

function Stat({ label, valor, detalle, aviso = false }: { label: string; valor: string; detalle: string; aviso?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-2xl bg-card p-4 lg:p-5", SOMBRA)}>
      <p className={cn("text-[13px] font-medium", GRIS)}>{label}</p>
      <p className="mt-1 text-[24px] leading-tight font-semibold tracking-tight tabular-nums lg:text-[28px]">{valor}</p>
      <p className={cn("mt-1 text-[13px]", aviso ? "font-medium text-[#A32020]" : GRIS)}>{detalle}</p>
    </div>
  );
}

function Prioridad({ p }: { p: PrioridadIncidente }) {
  const estilo = p === "ALTA" ? "bg-[#FDECEC] text-[#A32020]" : p === "MEDIA" ? "bg-[#FFEEDC] text-[#8F4400]" : "bg-[#F1F0F7] text-[#55526A]";
  return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", estilo)}>{TEXTO_PRIORIDAD[p]}</span>;
}

function EstadoTexto({ e }: { e: EstadoIncidente }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[#3F3C55]">
      <span aria-hidden className={cn("size-2 rounded-full", PUNTO[e])} />
      {TEXTO_ESTADO[e]}
    </span>
  );
}

/** El detalle de un incidente: sus datos, su seguimiento y el botón que lo lleva a la siguiente etapa. */
function Detalle({
  inc,
  estado,
  hoy,
  onAvanzar,
  onEditar,
  onCerrar,
}: {
  inc: IncidenteFila;
  estado: EstadoIncidente;
  hoy: string;
  onAvanzar: (a: EstadoIncidente) => void;
  onEditar: () => void;
  onCerrar: () => void;
}) {
  const sig = SIGUIENTE[estado];
  const actual = ESTADOS.indexOf(estado);
  const pasos: { e: EstadoIncidente; f?: string | null }[] = [
    { e: "ABIERTO", f: inc.fecha },
    { e: "EN_REPARACION" },
    { e: "RESUELTO", f: estado === "RESUELTO" ? inc.fechaResolucion : null },
  ];
  return (
    <div className="flex h-full max-h-[85vh] flex-col lg:max-h-none">
      <div className="flex items-start justify-between gap-3 border-b border-[#F0EEF6] px-5 py-4">
        {/* Tocar el título abre el formulario para editar: no hay un botón aparte, como en la maqueta. */}
        <button type="button" onClick={onEditar} title="Editar incidente" className="min-w-0 rounded-md text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <p className={cn("text-xs font-semibold tabular-nums", GRIS)}>I-{inc.numero}</p>
          <h2 className="mt-0.5 text-lg leading-snug font-semibold tracking-tight">{capitalizar(inc.titulo)}</h2>
        </button>
        <Button variant="ghost" size="icon" aria-label="Cerrar detalle" onClick={onCerrar} className="size-9 shrink-0 rounded-lg lg:hidden">
          <X />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className={GRIS}>Estado</dt>
            <dd className="mt-0.5">
              <EstadoTexto e={estado} />
            </dd>
          </div>
          <div>
            <dt className={GRIS}>Prioridad</dt>
            <dd className="mt-0.5">
              <Prioridad p={inc.prioridad} />
            </dd>
          </div>
          <div className="col-span-2">
            <dt className={GRIS}>Tipo</dt>
            <dd className="mt-0.5 font-medium">{textoTipoIncidente(inc.tipo)}</dd>
          </div>
          <div>
            <dt className={GRIS}>Reportado</dt>
            <dd className="mt-0.5 font-medium">
              {corto(inc.fecha)} · {hace(diasEntre(inc.fecha, hoy))}
            </dd>
          </div>
          <div>
            <dt className={GRIS}>Costo</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{inc.costo ? clp(inc.costo) : "Sin costo"}</dd>
          </div>
          {afectaUnBien(inc.tipo) && (
            <>
              <div>
                <dt className={GRIS}>Bien afectado</dt>
                <dd className="mt-0.5 font-medium">{inc.activoNombre ?? "No indicado"}</dd>
              </div>
              <div>
                <dt className={GRIS}>Valor perdido</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{inc.valorPerdido ? clp(inc.valorPerdido) : "Sin valorar"}</dd>
              </div>
            </>
          )}
        </dl>

        <h3 className={cn("mt-6 text-[13px] font-semibold", GRIS)}>Seguimiento</h3>
        <ol className="mt-2">
          {pasos.map((p, i) => {
            const hecho = i <= actual;
            return (
              <li key={p.e} className="relative flex gap-3 pb-4 last:pb-0">
                {i < pasos.length - 1 && <span aria-hidden className={cn("absolute top-4 left-[7px] h-full w-px", i < actual ? "bg-primary" : "bg-[#E4E1F0]")} />}
                <span aria-hidden className={cn("relative mt-0.5 flex size-[15px] shrink-0 items-center justify-center rounded-full", hecho ? "bg-primary" : "border-2 border-[#DAD6E6] bg-white")}>
                  {hecho && <Check className="size-2.5 text-white" strokeWidth={4} />}
                </span>
                <span className="text-sm">
                  <span className={hecho ? "font-semibold" : GRIS}>{TEXTO_ESTADO[p.e]}</span>
                  {p.f && <span className={cn("block text-[13px]", GRIS)}>{corto(p.f)}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {sig && (
        <div className="border-t border-[#F0EEF6] p-4">
          <Button onClick={() => onAvanzar(sig.a)} className="h-11 w-full rounded-lg font-semibold">
            {sig.a === "RESUELTO" ? <Check /> : <ArrowRight />}
            {sig.texto}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Los incidentes del sistema de agua: una lista ordenada por prioridad y antigüedad, con el detalle y
 * el seguimiento del elegido al lado. Se cambia su estado con el botón del detalle.
 */
export function IncidentesVista({ incidentes, activos: bienes }: { incidentes: IncidenteFila[]; activos: ActivoAfectable[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [prioridad, setPrioridad] = useState<"todas" | PrioridadIncidente>("todas");
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const [sel, setSel] = useState<string | null>(null);
  const [detalleMovil, setDetalleMovil] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<IncidenteFila | null>(null);
  // El estado se ve cambiar al instante; si el servidor falla, se vuelve atrás.
  const [movidos, setMovidos] = useState<Record<string, EstadoIncidente>>({});
  const [, iniciar] = useTransition();
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
    // Lo que se editó en el diálogo manda sobre lo que se movió antes.
    setMovidos({});
  }, []);

  const hoy = hoyEnChile();
  const mes = hoy.slice(0, 7);
  const estadoDe = (i: IncidenteFila) => movidos[i.id] ?? i.estado;

  function avanzar(i: IncidenteFila, destino: EstadoIncidente) {
    const origen = estadoDe(i);
    setMovidos((m) => ({ ...m, [i.id]: destino }));
    iniciar(async () => {
      const r = await cambiarEstadoIncidente(i.id, destino);
      if (!r.ok) {
        toast.error(r.error);
        setMovidos((m) => ({ ...m, [i.id]: origen }));
      }
    });
  }

  const de = (e: EstadoIncidente) => incidentes.filter((i) => estadoDe(i) === e);
  const activos = incidentes.filter((i) => estadoDe(i) !== "RESUELTO");
  const altas = activos.filter((i) => i.prioridad === "ALTA").length;
  const masAntiguo = activos.reduce((m, i) => Math.max(m, diasEntre(i.fecha, hoy)), 0);
  const delMes = incidentes.filter((i) => (i.fechaResolucion ?? i.fecha).startsWith(mes));
  const resueltosMes = delMes.filter((i) => estadoDe(i) === "RESUELTO");
  const costoMes = delMes.reduce((s, i) => s + i.costo, 0);
  const promedio = (() => {
    const con = resueltosMes.filter((i) => i.fechaResolucion);
    return con.length ? Math.round(con.reduce((t, i) => t + diasEntre(i.fecha, i.fechaResolucion as string), 0) / con.length) : 0;
  })();

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return incidentes
      .filter((i) => {
        const e = movidos[i.id] ?? i.estado;
        if (filtro !== "todos" && (filtro === "activos" ? e === "RESUELTO" : e !== filtro)) return false;
        if (prioridad !== "todas" && i.prioridad !== prioridad) return false;
        if (!t) return true;
        return `i-${i.numero}`.includes(t) || i.titulo.toLowerCase().includes(t) || textoTipoIncidente(i.tipo).toLowerCase().includes(t) || (i.lugar ?? "").toLowerCase().includes(t) || (i.responsable ?? "").toLowerCase().includes(t);
      })
      .sort((a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  }, [incidentes, busqueda, prioridad, filtro, movidos]);

  const seleccionado = incidentes.find((i) => i.id === sel) ?? visibles[0] ?? null;

  const pestanas: [Filtro, string, number][] = [
    ["activos", "Sin resolver", activos.length],
    ["ABIERTO", "Abiertos", de("ABIERTO").length],
    ["EN_REPARACION", "En reparación", de("EN_REPARACION").length],
    ["RESUELTO", "Resueltos", de("RESUELTO").length],
    ["todos", "Todos", incidentes.length],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Incidentes</h1>
          <p className={cn("mt-1 text-[15px]", GRIS)}>Fugas, fallas y cortes del sistema de agua, y lo que costó repararlos.</p>
        </div>
        <Button className="h-11 w-full rounded-full px-4 font-semibold sm:h-10 sm:w-auto sm:rounded-lg" onClick={() => setCreando(true)}>
          <Plus />
          Nuevo incidente
        </Button>
      </div>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Sin resolver" valor={String(activos.length)} detalle={altas ? `${altas} de prioridad alta` : "Ninguno de prioridad alta"} aviso={altas > 0} />
        <Stat label="Más antiguo abierto" valor={activos.length ? `${masAntiguo} ${masAntiguo === 1 ? "día" : "días"}` : "—"} detalle={activos.length ? "Desde que se reportó" : "Todo al día"} />
        <Stat label="Resueltos este mes" valor={String(resueltosMes.length)} detalle={resueltosMes.length ? `${promedio} ${promedio === 1 ? "día" : "días"} en promedio` : "Aún ninguno"} />
        <Stat label="Costo este mes" valor={clp(costoMes)} detalle={`${delMes.filter((i) => i.costo > 0).length} incidentes con gasto`} />
      </section>

      {/* Celular: el buscador y, debajo, dos selectores (estado y prioridad). */}
      <div className="flex flex-col gap-2 md:hidden">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Buscar incidente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar incidente" className="h-11 rounded-full border-[#E4E1F0] bg-white pl-10 shadow-none" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <SelectTrigger aria-label="Filtrar por estado" className="h-11 w-full rounded-full border-[#E4E1F0] bg-white px-4">
              <SelectValue>{(v: Filtro | null) => { const p = pestanas.find(([x]) => x === v); return p ? `${p[1]} (${p[2]})` : ""; }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {pestanas.map(([v, n, c]) => (
                <SelectItem key={v} value={v}>
                  {n} ({c})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prioridad} onValueChange={(v) => setPrioridad(v as typeof prioridad)}>
            <SelectTrigger aria-label="Filtrar por prioridad" className="h-11 w-full rounded-full border-[#E4E1F0] bg-white px-4">
              <SelectValue>{(v: string | null) => (v && v !== "todas" ? TEXTO_PRIORIDAD[v as PrioridadIncidente] : "Prioridad")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Prioridad</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="MEDIA">Media</SelectItem>
              <SelectItem value="BAJA">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Computador y tableta: las pestañas con contador, el buscador y el filtro de prioridad. */}
      <div className="mt-2 hidden flex-col gap-3 md:flex xl:flex-row xl:items-center xl:justify-between">
        <div role="tablist" aria-label="Estado" className="flex gap-1 overflow-x-auto rounded-lg bg-white/80 p-1">
          {pestanas.map(([v, n, c]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={filtro === v}
              onClick={() => setFiltro(v)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                filtro === v ? "bg-white text-[#2A07A8] shadow-sm" : GRIS
              )}
            >
              {n}
              <span className={cn("text-xs tabular-nums", filtro === v ? "text-[#2A07A8]" : "text-[#8A8799]")}>{c}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1 xl:w-[300px] xl:flex-none">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Buscar incidente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar incidente" className="h-10 rounded-lg border-[#E4E1F0] bg-white pl-9 shadow-none" />
          </div>
          <Select value={prioridad} onValueChange={(v) => setPrioridad(v as typeof prioridad)}>
            <SelectTrigger aria-label="Filtrar por prioridad" className="h-10 w-[150px] shrink-0 rounded-lg border-[#E4E1F0] px-3">
              <SelectValue>{(v: string | null) => (v && v !== "todas" ? TEXTO_PRIORIDAD[v as PrioridadIncidente] : "Prioridad")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Prioridad</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="MEDIA">Media</SelectItem>
              <SelectItem value="BAJA">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className={cn("min-w-0 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
          {visibles.length === 0 ? (
            <p className={cn("px-6 py-14 text-center text-sm", GRIS)}>
              {incidentes.length === 0 ? "Todavía no hay incidentes. Registra el primero con «Nuevo incidente»." : busqueda || prioridad !== "todas" ? "No hay incidentes con ese filtro." : "No hay incidentes aquí."}
            </p>
          ) : (
            <ul className="divide-y divide-[#F0EEF6]">
              {visibles.map((i) => {
                const e = estadoDe(i);
                const activo = seleccionado?.id === i.id;
                const antiguedad = diasEntre(i.fecha, hoy);
                const atrasado = e !== "RESUELTO" && antiguedad >= 3;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      aria-current={activo ? "true" : undefined}
                      onClick={() => {
                        setSel(i.id);
                        setDetalleMovil(true);
                      }}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_130px_110px_auto] sm:px-5",
                        activo ? "bg-[#F4F2FD]" : "hover:bg-[#FBFAFF]"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className={cn("text-xs font-semibold tabular-nums", GRIS)}>I-{i.numero}</span>
                          <Prioridad p={i.prioridad} />
                        </span>
                        <span className="mt-1 block truncate text-[15px] font-semibold">{capitalizar(i.titulo)}</span>
                        <span className={cn("block truncate text-[13px]", GRIS)}>{textoTipoIncidente(i.tipo)}</span>
                      </span>
                      <span className="hidden sm:block">
                        <EstadoTexto e={e} />
                      </span>
                      <span className={cn("hidden text-[13px] sm:block", atrasado ? "font-semibold text-[#8F4400]" : GRIS)}>{e === "RESUELTO" && i.fechaResolucion ? `Resuelto ${corto(i.fechaResolucion)}` : hace(antiguedad)}</span>
                      <span className="mt-6 flex items-center gap-2 justify-self-end self-start sm:mt-0 sm:self-center">
                        <span className={cn("text-sm font-semibold tabular-nums", !i.costo && "text-[#A5A3B5]")}>{i.costo ? clp(i.costo) : "—"}</span>
                        <ChevronRight className="size-4 text-[#A5A3B5]" aria-hidden />
                      </span>
                      <span className={cn("col-span-2 text-[13px] sm:hidden", atrasado ? "font-semibold text-[#8F4400]" : GRIS)}>
                        {TEXTO_ESTADO[e]} · {e === "RESUELTO" && i.fechaResolucion ? `resuelto ${corto(i.fechaResolucion)}` : hace(antiguedad)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {seleccionado ? (
          <div className={cn("hidden overflow-hidden rounded-2xl bg-card lg:sticky lg:top-4 lg:block", SOMBRA)}>
            <Detalle inc={seleccionado} estado={estadoDe(seleccionado)} hoy={hoy} onAvanzar={(a) => avanzar(seleccionado, a)} onEditar={() => setEditando(seleccionado)} onCerrar={() => setSel(null)} />
          </div>
        ) : (
          <div className={cn("hidden rounded-2xl bg-card px-6 py-14 text-center text-sm lg:block", GRIS, SOMBRA)}>Elige un incidente para ver su detalle.</div>
        )}
      </div>

      {seleccionado && detalleMovil && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Cerrar detalle" onClick={() => setDetalleMovil(false)} className="absolute inset-0 bg-[#15132B]/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-2xl bg-white">
            <Detalle
              inc={seleccionado}
              estado={estadoDe(seleccionado)}
              hoy={hoy}
              onAvanzar={(a) => avanzar(seleccionado, a)}
              onEditar={() => {
                setDetalleMovil(false);
                setEditando(seleccionado);
              }}
              onCerrar={() => setDetalleMovil(false)}
            />
          </div>
        </div>
      )}

      {(creando || editando) && <IncidenteDialog key={editando?.id ?? "nuevo"} incidente={editando} activos={bienes} onCerrar={cerrar} />}
    </div>
  );
}
