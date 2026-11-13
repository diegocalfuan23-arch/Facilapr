"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Box,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Droplets,
  Gauge,
  MapPin,
  Pencil,
  Play,
  Plus,
  Search,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { cambiarEstadoLabor } from "@/app/panel/labores/actions";
import { avisarCambio } from "@/lib/avisos-datos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LaborDialog } from "@/components/panel/labor-dialog";
import { costoMateriales, textoTipoLabor, TEXTO_ESTADO_LABOR, type EstadoLabor, type LaborFila, type MaterialLabor } from "@/lib/labores-comun";
import { formatoCantidad, unidadCorta, type Insumo } from "@/lib/inventario-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

/** El ícono de cada tipo de labor. */
function IconoTipo({ tipo, className }: { tipo: string; className?: string }) {
  if (tipo === "CLORACION") return <Droplets className={className} />;
  if (tipo === "REPARACION") return <Wrench className={className} />;
  if (tipo === "MANTENCION") return <Gauge className={className} />;
  return <ClipboardList className={className} />;
}

const ESTADO: Record<EstadoLabor, { chip: string; punto: string; icono: LucideIcon }> = {
  PROGRAMADA: { chip: "bg-[#E2F2FC] text-[#0A5F91]", punto: "bg-[#0B8BD3]", icono: CalendarClock },
  EN_CURSO: { chip: "bg-[#FFF3E5] text-[#8F4400]", punto: "bg-[#E58200]", icono: Clock3 },
  HECHA: { chip: "bg-[#E6F6EF] text-[#075A3C]", punto: "bg-[#0A9B68]", icono: CheckCircle2 },
};

/** Primero lo que se está haciendo, después lo que viene y al final lo ya hecho. */
const ORDEN: Record<EstadoLabor, number> = { EN_CURSO: 0, PROGRAMADA: 1, HECHA: 2 };

function Chip({ e }: { e: EstadoLabor }) {
  const I = ESTADO[e].icono;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", ESTADO[e].chip)}>
      <I className="size-3.5" aria-hidden />
      {TEXTO_ESTADO_LABOR[e]}
    </span>
  );
}

/** El detalle de una labor: su avance, sus datos, sus materiales y el botón que la hace avanzar. */
function Detalle({
  l,
  insumos,
  ocupado,
  onCerrar,
  onEditar,
  onEstado,
}: {
  l: LaborFila;
  insumos: Insumo[];
  ocupado: boolean;
  onCerrar: () => void;
  onEditar: () => void;
  onEstado: (e: EstadoLabor) => void;
}) {
  const hecha = l.estado === "HECHA";
  const terminada = l.fechaTermino ?? l.fecha;
  // Lo que hay en bodega de cada material (si el material sigue en el inventario).
  const stockDe = (m: MaterialLabor) => (m.insumoId ? insumos.find((i) => i.id === m.insumoId)?.stock : undefined);
  const faltaStock = hecha
    ? []
    : l.materiales.filter((m) => {
        const s = stockDe(m);
        return s !== undefined && m.cantidad > s;
      });
  const pasos: [string, string | undefined, boolean][] = [
    ["Programada", l.fecha, true],
    ["En curso", l.estado !== "PROGRAMADA" ? l.fecha : undefined, l.estado !== "PROGRAMADA"],
    ["Hecha", hecha ? terminada : undefined, hecha],
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-5 py-4">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#ECE8FD] text-[#3A0CE3]">
          <IconoTipo tipo={l.tipo} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-medium", GRIS)}>
            L-{l.numero} · {textoTipoLabor(l.tipo)}
          </p>
          <h2 className="text-lg leading-tight font-semibold">{l.titulo}</h2>
          <div className="mt-1.5">
            <Chip e={l.estado} />
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Editar labor" onClick={onEditar} className="size-9 rounded-lg">
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onCerrar} className="size-9 rounded-lg lg:hidden">
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-[#F0EEF6] overflow-y-auto">
        <ol className="flex items-center gap-2 px-5 py-4" aria-label="Avance">
          {pasos.map(([t, f, ok], i) => (
            <li key={t} className="flex flex-1 items-center gap-2">
              <span aria-hidden className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", ok ? "bg-primary text-white" : "border-2 border-[#DCD9E8] text-[#B4B2C4]")}>
                {ok ? <Check className="size-3.5" strokeWidth={3} /> : <span className="text-xs font-bold">{i + 1}</span>}
              </span>
              <span className="min-w-0 leading-tight">
                <span className={cn("block text-xs font-semibold", !ok && GRIS)}>{t}</span>
                <span className={cn("block text-[11px] tabular-nums", GRIS)}>{f ? fechaCorta(f) : "—"}</span>
              </span>
              {i < 2 ? <span aria-hidden className={cn("h-0.5 flex-1 rounded", pasos[i + 1][2] ? "bg-primary" : "bg-[#E4E1F0]")} /> : null}
            </li>
          ))}
        </ol>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-sm">
          <div>
            <dt className={cn("flex items-center gap-1.5 text-xs", GRIS)}>
              <CalendarDays className="size-3.5" aria-hidden />
              Fecha
            </dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {fechaCorta(l.fecha)}
              {l.hora ? <span className={cn("font-normal", GRIS)}> · {l.hora}</span> : null}
            </dd>
          </div>
          <div>
            <dt className={cn("flex items-center gap-1.5 text-xs", GRIS)}>
              <MapPin className="size-3.5" aria-hidden />
              Lugar
            </dt>
            <dd className={cn("mt-0.5 font-medium", !l.lugar && GRIS)}>{l.lugar ?? "Sin lugar"}</dd>
          </div>
          <div className="col-span-2">
            <dt className={cn("flex items-center gap-1.5 text-xs", GRIS)}>
              <UserRound className="size-3.5" aria-hidden />
              Responsable
            </dt>
            <dd className="mt-1">
              {l.responsable ? (
                <span className="inline-flex items-center gap-2 font-medium">
                  <span className="flex size-7 items-center justify-center rounded-full bg-[#ECE8FD] text-[11px] font-bold text-[#2A07A8]">{iniciales(l.responsable)}</span>
                  {l.responsable}
                </span>
              ) : (
                <button type="button" onClick={onEditar} className="text-sm font-semibold text-[#2A07A8] hover:underline">
                  Asignar responsable
                </button>
              )}
            </dd>
          </div>
          {!hecha && l.fechaTermino ? (
            <div className="col-span-2">
              <dt className={cn("flex items-center gap-1.5 text-xs", GRIS)}>
                <Clock3 className="size-3.5" aria-hidden />
                Termina
              </dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {fechaCorta(l.fechaTermino)}
                {l.horaFin ? <span className={cn("font-normal", GRIS)}> · {l.horaFin}</span> : null}
              </dd>
            </div>
          ) : null}
        </dl>

        {l.descripcion ? (
          <section className="px-5 py-4">
            <p className="mb-1.5 text-[13px] font-semibold">Descripción</p>
            <p className={cn("text-sm whitespace-pre-line", GRIS)}>{l.descripcion}</p>
          </section>
        ) : null}

        <section className="px-5 py-4">
          <p className="mb-2.5 flex items-center justify-between text-[13px] font-semibold">
            <span>Materiales {hecha ? "usados" : "a usar"}</span>
            <span className="tabular-nums">{clp.format(costoMateriales(l))}</span>
          </p>
          {l.materiales.length === 0 ? <p className={cn("rounded-xl border border-dashed border-[#E4E1F0] px-3 py-4 text-center text-xs", GRIS)}>Esta labor no usa materiales del inventario.</p> : null}
          <ul className="flex flex-col gap-2">
            {l.materiales.map((m) => {
              const s = stockDe(m);
              const falta = !hecha && s !== undefined && m.cantidad > s;
              return (
                <li key={m.insumoId ?? m.nombre} className="flex items-center gap-3 rounded-xl border border-[#EFEDF6] px-3 py-2.5">
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F3F9] text-[#5B5970]">
                    <Box className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.nombre}</span>
                    <span className={cn("block text-xs", falta ? "text-[#A32020]" : GRIS)}>
                      {formatoCantidad(m.cantidad)} {unidadCorta(m.unidad)}
                      {hecha ? (l.descontada ? " · descontado del inventario" : "") : s !== undefined ? ` · quedan ${formatoCantidad(s)} en bodega` : " · ya no está en el inventario"}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{clp.format(Math.round(m.cantidad * m.costoUnitario))}</span>
                </li>
              );
            })}
          </ul>
          {!hecha ? (
            <button type="button" onClick={onEditar} className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-[#2A07A8] hover:underline">
              <Plus className="size-4" aria-hidden />
              Agregar material
            </button>
          ) : null}
        </section>
      </div>

      <div className="border-t border-[#F0EEF6] p-4">
        {hecha ? (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-[#E6F6EF] py-3 text-sm font-semibold text-[#075A3C]">
            <CheckCircle2 className="size-4" aria-hidden />
            Terminada el {fechaCorta(terminada)}
          </p>
        ) : (
          <>
            {faltaStock.length ? (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-[#A32020]">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                No hay stock suficiente de {faltaStock.map((m) => m.nombre).join(", ")}.
              </p>
            ) : null}
            {l.vencida ? (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-[#8F4400]">
                <Clock3 className="size-3.5 shrink-0" aria-hidden />
                Ya debía terminar: revisa el stock de sus materiales.
              </p>
            ) : null}
            {l.estado === "PROGRAMADA" ? (
              <Button onClick={() => onEstado("EN_CURSO")} disabled={ocupado} className="h-11 w-full rounded-xl font-semibold">
                <Play className="size-4" />
                Iniciar labor
              </Button>
            ) : (
              <Button onClick={() => onEstado("HECHA")} disabled={ocupado || faltaStock.length > 0} className="h-11 w-full rounded-xl bg-[#0A9B68] font-semibold hover:bg-[#0A9B68]/90">
                <Check className="size-4" />
                Marcar como hecha
              </Button>
            )}
            <p className={cn("mt-2 text-center text-xs", GRIS)}>Al terminarla, los materiales se descuentan del inventario.</p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Las labores del comité: una lista con su estado y, al lado, el detalle de la que eliges (en el celular se abre
 * desde abajo). Al pasar una a «Hecha» sus materiales se descuentan del inventario; al sacarla de ahí, que se
 * hace desde el lápiz de edición, vuelven.
 */
export function LaboresVista({ labores, insumos }: { labores: LaborFila[]; insumos: Insumo[] }) {
  const [filtro, setFiltro] = useState<"todas" | EstadoLabor>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [movil, setMovil] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<LaborFila | null>(null);
  const [movidas, setMovidas] = useState<Record<string, EstadoLabor>>({});
  const [ocupado, iniciar] = useTransition();
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
    setMovidas({});
  }, []);

  const hoy = hoyEnChile();
  const mes = hoy.slice(0, 7);

  // Las labores como se ven ahora: las que se acaban de mover ya aparecen en su estado nuevo, antes de que responda el servidor.
  const lista = labores.map((l) => {
    const d = movidas[l.id];
    if (!d || d === l.estado) return l;
    return { ...l, estado: d, descontada: d === "HECHA", fechaTermino: d === "HECHA" ? (l.fechaTermino ?? hoy) : null, horaFin: null, vencida: false };
  });

  function mover(l: LaborFila, destino: EstadoLabor) {
    const origen = l.estado;
    if (origen === destino) return;
    setMovidas((m) => ({ ...m, [l.id]: destino }));
    iniciar(async () => {
      const r = await cambiarEstadoLabor(l.id, destino);
      if (r.ok) {
        if (l.materiales.length > 0 && (destino === "HECHA" || origen === "HECHA")) avisarCambio("inventario");
        if (destino === "HECHA" && l.materiales.length > 0) toast.success("Materiales descontados del inventario");
        if (origen === "HECHA" && l.materiales.length > 0) toast.success("Materiales devueltos al inventario");
      } else {
        toast.error(r.error);
        setMovidas((m) => ({ ...m, [l.id]: origen }));
      }
    });
  }

  const cuenta = (e: EstadoLabor) => lista.filter((l) => l.estado === e).length;
  const hechasMes = lista.filter((l) => l.estado === "HECHA" && (l.fechaTermino ?? l.fecha).startsWith(mes));
  const usadoMes = hechasMes.reduce((s, l) => s + costoMateriales(l), 0);

  const ordenadas = [...lista].sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado]);
  const texto = busqueda.trim().toLowerCase();
  const visibles = ordenadas.filter(
    (l) =>
      (filtro === "todas" || l.estado === filtro) &&
      (!texto || `l-${l.numero} ${l.titulo} ${textoTipoLabor(l.tipo)} ${l.lugar ?? ""} ${l.responsable ?? ""} ${l.materiales.map((m) => m.nombre).join(" ")}`.toLowerCase().includes(texto))
  );

  // El detalle muestra la labor elegida; mientras no se elige ninguna, la primera de la lista.
  const actual = lista.find((l) => l.id === sel) ?? ordenadas[0] ?? null;

  useEffect(() => {
    if (!movil) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creando && !editando) setMovil(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [movil, creando, editando]);

  const detalle = (l: LaborFila, alCerrar: () => void) => (
    <Detalle key={l.id} l={l} insumos={insumos} ocupado={ocupado} onCerrar={alCerrar} onEditar={() => setEditando(l)} onEstado={(e) => mover(l, e)} />
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Labores</h1>
          <p className={cn("mt-0.5 text-[15px]", GRIS)}>Trabajos del comité y los materiales que usan. Al terminarlos, se descuentan del inventario.</p>
        </div>
        <Button data-tour="lab-nueva" className="h-10 rounded-lg px-4 font-semibold" onClick={() => setCreando(true)}>
          <Plus />
          Nueva labor
        </Button>
      </div>

      <section aria-label="Resumen" data-tour="lab-kpis" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["Programadas", String(cuenta("PROGRAMADA")), "por iniciar", "PROGRAMADA"],
            ["En curso", String(cuenta("EN_CURSO")), "trabajándose ahora", "EN_CURSO"],
            ["Hechas este mes", String(hechasMes.length), "terminadas", "HECHA"],
            ["Materiales usados", clp.format(usadoMes), "este mes", null],
          ] as const
        ).map(([k, v, d, e]) => (
          <div key={k} className={cn("rounded-2xl bg-card p-4 sm:p-5", SOMBRA)}>
            <p className={cn("flex items-center gap-2 text-[13px]", GRIS)}>
              {e ? <span aria-hidden className={cn("size-2 rounded-full", ESTADO[e].punto)} /> : <Box className="size-3.5" aria-hidden />}
              {k}
            </p>
            <p className="mt-1 text-[26px] leading-none font-semibold tabular-nums">{v}</p>
            <p className={cn("mt-2 text-xs", GRIS)}>{d}</p>
          </div>
        ))}
      </section>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div data-tour="lab-lista" className={cn("min-w-0 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
          <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
            <div role="tablist" aria-label="Estado" className="grid grid-cols-4 gap-1 rounded-lg bg-[#F4F3F9] p-1 xl:w-[460px]">
              {(
                [
                  ["todas", "Todas", lista.length],
                  ["PROGRAMADA", "Programadas", cuenta("PROGRAMADA")],
                  ["EN_CURSO", "En curso", cuenta("EN_CURSO")],
                  ["HECHA", "Hechas", cuenta("HECHA")],
                ] as const
              ).map(([k, t, n]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={filtro === k}
                  onClick={() => setFiltro(k)}
                  className={cn("h-8 truncate rounded-md px-1 text-[13px] font-semibold", filtro === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}
                >
                  <span className="sm:hidden">{t === "Programadas" ? "Prog." : t}</span>
                  <span className="hidden sm:inline">{t}</span> <span className={cn("text-xs font-medium", filtro === k ? "text-[#6B46F5]" : "text-[#A19FB2]")}>{n}</span>
                </button>
              ))}
            </div>
            <div className="relative min-w-0 xl:w-[300px]">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Buscar labor" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="N.°, título, lugar, responsable o material" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
            </div>
          </div>

          {visibles.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <span aria-hidden className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#ECE8FD] text-[#3A0CE3]">
                <ClipboardList className="size-6" />
              </span>
              <p className="mt-3 font-semibold">{busqueda ? "Ninguna labor coincide" : filtro === "PROGRAMADA" ? "Sin labores programadas" : "Sin labores"}</p>
              <p className={cn("mt-1 text-sm", GRIS)}>{busqueda ? "Prueba con otra palabra." : "Programa la próxima cloración, mantención o reparación."}</p>
              {!busqueda ? (
                <Button className="mt-4 h-10 rounded-lg font-semibold" onClick={() => setCreando(true)}>
                  <Plus />
                  Nueva labor
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className={cn("hidden grid-cols-[minmax(0,1fr)_120px_150px_110px_120px_24px] gap-4 border-b border-[#F3F1F8] bg-[#FAFAFD] px-5 py-2.5 text-xs font-medium md:grid", GRIS)}>
                <span>Labor</span>
                <span>Fecha</span>
                <span>Responsable</span>
                <span className="text-right">Materiales</span>
                <span>Estado</span>
                <span />
              </div>
              <ul className="divide-y divide-[#F3F1F8]">
                {visibles.map((l) => {
                  const activo = actual?.id === l.id;
                  const costo = costoMateriales(l);
                  const hecha = l.estado === "HECHA";
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSel(l.id);
                          setMovil(true);
                        }}
                        aria-current={activo ? "true" : undefined}
                        className={cn(
                          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[#C4B7FA] focus-visible:outline-none focus-visible:ring-inset md:grid-cols-[minmax(0,1fr)_120px_150px_110px_120px_24px] md:px-5",
                          activo ? "bg-[#F5F3FE] shadow-[inset_3px_0_0_#3A0CE3]" : "hover:bg-[#FBFAFF]"
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EEFD] text-[#3A0CE3]">
                            <IconoTipo tipo={l.tipo} className="size-[18px]" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-semibold">{l.titulo}</span>
                            <span className={cn("block truncate text-[13px]", GRIS)}>
                              L-{l.numero} · {textoTipoLabor(l.tipo)}
                              {l.lugar ? ` · ${l.lugar}` : ""}
                            </span>
                          </span>
                        </span>
                        <span className="md:hidden">
                          <Chip e={l.estado} />
                        </span>
                        <span className="hidden text-sm tabular-nums md:block">
                          {fechaCorta(hecha ? (l.fechaTermino ?? l.fecha) : l.fecha)}
                          <span className={cn("block text-xs", GRIS)}>
                            {hecha ? "terminada" : "programada"}
                            {!hecha && l.hora ? ` · ${l.hora}` : ""}
                          </span>
                        </span>
                        <span className="hidden min-w-0 items-center gap-2 text-sm md:flex">
                          {l.responsable ? (
                            <>
                              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#ECE8FD] text-[11px] font-bold text-[#2A07A8]">
                                {iniciales(l.responsable)}
                              </span>
                              <span className="truncate">{l.responsable}</span>
                            </>
                          ) : (
                            <span className={GRIS}>Sin asignar</span>
                          )}
                        </span>
                        <span className="hidden text-right md:block">
                          <span className="block text-sm font-semibold tabular-nums">{l.materiales.length ? clp.format(costo) : "—"}</span>
                          <span className={cn("block text-xs", GRIS)}>{l.materiales.length ? `${l.materiales.length} ítem${l.materiales.length === 1 ? "" : "s"}` : "sin materiales"}</span>
                        </span>
                        <span className="hidden md:block">
                          <Chip e={l.estado} />
                        </span>
                        <ChevronRight className="hidden size-4 text-[#B4B2C4] md:block" aria-hidden />
                        <span className={cn("col-span-2 flex items-center justify-between pl-[52px] text-xs md:hidden", GRIS)}>
                          <span>
                            {l.responsable ?? "Sin asignar"} · {fechaCorta(l.fecha)}
                          </span>
                          <span className="font-semibold text-[#15132B] tabular-nums">{l.materiales.length ? clp.format(costo) : "—"}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {actual ? <div className={cn("hidden h-[min(640px,calc(100vh-2rem))] overflow-hidden rounded-2xl bg-card text-sm lg:sticky lg:top-4 lg:block", SOMBRA)}>{detalle(actual, () => setSel(null))}</div> : null}
      </div>

      {actual && movil ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={`Detalle de ${actual.titulo}`}>
          <button type="button" aria-label="Cerrar" onClick={() => setMovil(false)} className="absolute inset-0 bg-[#15132B]/40" />
          <div className="absolute inset-x-0 bottom-0 h-[86vh] overflow-hidden rounded-t-2xl bg-white text-sm">{detalle(actual, () => setMovil(false))}</div>
        </div>
      ) : null}

      {(creando || editando) && <LaborDialog key={editando?.id ?? "nueva"} labor={editando} insumos={insumos} onCerrar={cerrar} />}
    </div>
  );
}
