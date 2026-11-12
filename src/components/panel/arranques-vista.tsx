"use client";

import dynamic from "next/dynamic";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Droplet, Droplets, List, Loader2, Map as MapIcon, MapPin, Navigation, Pencil, Plus, Search, Trash2, TriangleAlert, UserPlus, Users, X } from "lucide-react";
import { asignarSocios, eliminarArranque, quitarSocioDeArranque, ubicarArranque } from "@/app/panel/arranques/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArranqueDialog } from "@/components/panel/arranque-dialog";
import { AsignarSociosDialog } from "@/components/panel/asignar-socios-dialog";
import { AvatarSocio } from "@/components/panel/avatar-socio";
import { NuevoArranqueDialog } from "@/components/panel/nuevo-arranque-dialog";
import { useConfirmar } from "@/components/ui/confirmar";
import { linkRuta, type ArranqueFila, type Punto, type SocioAsignable } from "@/lib/arranques-comun";
import { cn } from "@/lib/utils";

// Leaflet necesita `window`: los mapas se cargan solo en el navegador.
const cargando = (alto: number) => <div className="rounded-xl bg-[#EEF0F4]" style={{ height: alto }} aria-hidden />;
const MapaArranque = dynamic(() => import("@/components/panel/mapa-arranques").then((m) => m.MapaArranque), { ssr: false, loading: () => cargando(180) });
const MapaRed = dynamic(() => import("@/components/panel/mapa-arranques").then((m) => m.MapaRed), { ssr: false, loading: () => cargando(460) });

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lo que muestra el panel de un arranque: su ubicación en el mapa y los socios que abastece. */
function Detalle({
  a,
  totalSocios,
  ocupado,
  onEditar,
  onAgregar,
  onQuitar,
  onEliminar,
  onCerrar,
  onUbicar,
}: {
  a: ArranqueFila;
  totalSocios: number;
  ocupado: boolean;
  onEditar: () => void;
  onAgregar: () => void;
  onQuitar: (socioId: string) => void;
  onEliminar: () => void;
  onCerrar: () => void;
  onUbicar: (p: Punto) => void;
}) {
  const [temp, setTemp] = useState<Punto | null>(null);
  const [editando, setEditando] = useState(false);
  const punto = a.lat !== null && a.lng !== null ? { lat: a.lat, lng: a.lng } : undefined;
  const marcando = !punto || editando;
  const [buscaSocio, setBuscaSocio] = useState("");
  const q = sinTildes(buscaSocio.trim());
  const sociosVistos = q ? a.socios.filter((s) => sinTildes(`${s.nombre} ${s.numero ?? ""}`).includes(q)) : a.socios;
  const conBuscador = a.socios.length > 8;

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3 border-b border-[#F0EEF6] p-5">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E2F2FC] text-[#0A5F91]">
          <Droplets className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg leading-tight font-semibold">{a.nombre}</h2>
          <p className={cn("mt-0.5 text-[13px]", GRIS)}>
            {a.socios.length} socio{a.socios.length === 1 ? "" : "s"} abastecido{a.socios.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Editar arranque" onClick={onEditar} className="size-9 rounded-lg">
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onCerrar} className="size-9 rounded-lg lg:hidden">
          <X />
        </Button>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-[#F0EEF6] border-b border-[#F0EEF6] text-center">
        {[
          ["Socios", String(a.socios.length)],
          ["Ubicación", punto ? "Sí" : "Falta"],
          ["De la red", `${totalSocios ? Math.round((a.socios.length / totalSocios) * 100) : 0}%`],
        ].map(([k, v]) => (
          <div key={k} className="px-2 py-3">
            <dt className={cn("text-[11px] tracking-wide uppercase", GRIS)}>{k}</dt>
            <dd className={cn("mt-0.5 text-[15px] font-semibold tabular-nums", v === "Falta" && "text-[#B86400]")}>{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Ubicación" className="border-b border-[#F0EEF6] p-5">
        <p className={cn("mb-2 text-xs font-semibold tracking-wide uppercase", GRIS)}>Ubicación</p>
        {!marcando && punto ? (
          <>
            <MapaArranque punto={punto} />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-start gap-2 text-[13px]">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[#6B46F5]" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.ubicacion ?? "Marcado en el mapa"}</span>
                  <span className={cn("block text-xs tabular-nums", GRIS)}>
                    {punto.lat.toFixed(5)}, {punto.lng.toFixed(5)}
                  </span>
                </span>
              </p>
              <div className="flex shrink-0 gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setEditando(true)} className="h-8 rounded-lg px-2 text-xs font-semibold">
                  Mover
                </Button>
                <Button size="sm" className="h-8 rounded-lg px-2.5 text-xs font-semibold" render={<a href={linkRuta(punto)} target="_blank" rel="noreferrer" />}>
                  <Navigation className="size-3.5" />
                  Cómo llegar
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <MapaArranque punto={temp ?? punto} editable onElegir={setTemp} />
            {temp ? (
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className={cn("text-xs tabular-nums", GRIS)}>
                  {temp.lat.toFixed(5)}, {temp.lng.toFixed(5)}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTemp(null);
                      setEditando(false);
                    }}
                    className="h-8 rounded-lg px-2.5 text-xs font-semibold"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    disabled={ocupado}
                    onClick={() => {
                      onUbicar(temp);
                      setTemp(null);
                      setEditando(false);
                    }}
                    className="h-8 rounded-lg px-3 text-xs font-semibold"
                  >
                    Guardar ubicación
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-2.5 flex items-start gap-2 text-[13px] leading-snug text-[#7A3B00]">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {punto ? (
                    "Toca el mapa en el nuevo lugar."
                  ) : (
                    <>
                      <strong className="font-semibold">Sin ubicación.</strong> Toca el mapa donde está el arranque o usa tu GPS en terreno.
                    </>
                  )}
                </span>
              </p>
            )}
          </>
        )}
      </section>

      <section aria-label="Socios abastecidos" className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className={cn("text-xs font-semibold tracking-wide uppercase", GRIS)}>Socios que abastece</p>
          <Button variant="ghost" size="sm" onClick={onAgregar} className="-mr-2 h-8 rounded-lg px-2 text-[13px] font-semibold text-[#2A07A8]">
            <UserPlus className="size-4" />
            Agregar
          </Button>
        </div>
        {conBuscador && (
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8A8799]" aria-hidden />
            <Input value={buscaSocio} onChange={(e) => setBuscaSocio(e.target.value)} placeholder="Buscar socio o número" aria-label="Buscar entre los socios del arranque" className="h-9 pl-9 text-sm" />
          </div>
        )}
        {a.socios.length ? (
          <ul className="-mx-2 flex max-h-[26rem] flex-col overflow-y-auto">
            {sociosVistos.length === 0 && <li className={cn("px-2 py-4 text-center text-sm", GRIS)}>Ningún socio coincide.</li>}
            {sociosVistos.map((s) => (
              <li key={s.id} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#F8F7FC]">
                <AvatarSocio id={s.id} nombre={s.nombre} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.nombre}</span>
                  {s.numero && <span className={cn("block text-xs", GRIS)}>Socio N° {s.numero}</span>}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={ocupado}
                  aria-label={`Quitar a ${s.nombre} de ${a.nombre}`}
                  onClick={() => onQuitar(s.id)}
                  className="size-8 rounded-lg text-[#8A8799] opacity-100 hover:bg-[#FDECEC] hover:text-[#A32020] lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl bg-[#F8F7FC] px-4 py-6 text-center">
            <p className="text-sm font-medium">Este arranque no abastece a nadie todavía</p>
            <Button onClick={onAgregar} className="mt-3 h-9 rounded-lg font-semibold">
              <UserPlus />
              Asignar socios
            </Button>
          </div>
        )}
      </section>
      <div className="border-t border-[#F0EEF6] px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={a.socios.length > 0 || ocupado}
          onClick={onEliminar}
          title={a.socios.length ? "Quita primero sus socios" : undefined}
          className="-ml-2 h-8 rounded-lg px-2 text-xs font-semibold text-[#A32020] hover:bg-[#FDECEC] hover:text-[#A32020]"
        >
          <Trash2 className="size-3.5" />
          Eliminar arranque
        </Button>
        {a.socios.length > 0 && <span className={cn("ml-1 text-xs", GRIS)}>Quita sus socios antes de eliminarlo.</span>}
      </div>
    </div>
  );
}

/** Los arranques del comité (plan Grande): cada conexión de la red, dónde está y qué socios abastece. */
export function ArranquesVista({ arranques, socios, sinTablas }: { arranques: ArranqueFila[]; socios: SocioAsignable[]; sinTablas: boolean }) {
  const { confirmar, dialogo } = useConfirmar();
  const [ocupado, iniciar] = useTransition();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [movil, setMovil] = useState(false);
  const [vista, setVista] = useState<"lista" | "mapa">("lista");
  const [asignando, setAsignando] = useState<{ destino?: string } | null>(null);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<ArranqueFila | null>(null);
  const cerrarEdicion = useCallback(() => setEditando(null), []);
  const cerrarCreacion = useCallback(() => setCreando(false), []);
  const cerrarAsignar = useCallback(() => setAsignando(null), []);

  const libres = socios.filter((s) => s.arranqueId === null);
  const nAsignados = socios.length - libres.length;
  const nLibres = libres.length;
  const cobertura = socios.length ? Math.round((nAsignados / socios.length) * 100) : 0;
  const sinUbicacion = arranques.filter((a) => a.lat === null || a.lng === null).length;

  const t = sinTildes(q.trim());
  const visibles = arranques.filter((a) => !t || sinTildes(`${a.nombre} ${a.ubicacion ?? ""} ${a.socios.map((s) => s.nombre).join(" ")}`).includes(t));
  const actual = arranques.find((a) => a.id === sel) ?? arranques[0] ?? null;
  const sinPunto = visibles.filter((a) => a.lat === null || a.lng === null);

  function ejecutar(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, mensaje: string) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) toast.success(mensaje);
      else toast.error(r.error);
    });
  }

  async function eliminar(a: ArranqueFila) {
    if (!(await confirmar({ titulo: `¿Borrar «${a.nombre}»?`, descripcion: "No tiene socios asignados. Esto no se puede deshacer.", boton: "Borrar" }))) return;
    ejecutar(() => eliminarArranque(a.id), "Arranque borrado");
  }

  const encabezado = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Arranques</h1>
        <p className={cn("mt-0.5 text-[15px]", GRIS)}>Los arranques de tu red y los socios que abastece cada uno.</p>
      </div>
      {!sinTablas && (
        <div className="flex gap-2" data-tour="arr-acciones">
          <Button variant="outline" onClick={() => setAsignando({})} disabled={arranques.length === 0 || nLibres === 0} className="h-10 flex-1 rounded-lg border-[#E4E1F0] bg-white font-semibold sm:flex-none">
            <UserPlus />
            Asignar socios
          </Button>
          <Button onClick={() => setCreando(true)} className="h-10 flex-1 rounded-lg px-4 font-semibold sm:flex-none">
            <Plus />
            Nuevo arranque
          </Button>
        </div>
      )}
    </div>
  );

  if (sinTablas) {
    return (
      <div className="flex flex-col gap-4">
        {encabezado}
        <div className={cn("flex items-start gap-3 rounded-2xl bg-[#FFF3E5] p-5 text-[#8F4400]", SOMBRA)}>
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-[15px]">Falta actualizar la base de datos para usar esta sección. Avisa a soporte.</p>
        </div>
      </div>
    );
  }

  const panel = (alMostrar: "pc" | "movil") =>
    actual && (
      <Detalle
        key={`${alMostrar}-${actual.id}`}
        a={actual}
        totalSocios={socios.length}
        ocupado={ocupado}
        onEditar={() => setEditando(actual)}
        onAgregar={() => setAsignando({ destino: actual.id })}
        onQuitar={(socioId) => ejecutar(() => quitarSocioDeArranque(actual.id, socioId), "Socio quitado del arranque")}
        onEliminar={() => void eliminar(actual)}
        onCerrar={() => setMovil(false)}
        onUbicar={(p) => ejecutar(() => ubicarArranque(actual.id, p), "Ubicación guardada")}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      {encabezado}

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className={cn("rounded-2xl bg-card p-4 sm:p-5", SOMBRA)}>
          <div className="flex items-center justify-between">
            <p className={cn("text-[13px]", GRIS)}>Arranques</p>
            <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-[#E2F2FC] text-[#0A5F91]">
              <Droplet className="size-4" />
            </span>
          </div>
          <p className="mt-1 text-[28px] leading-none font-semibold tabular-nums">{arranques.length}</p>
          <p className={cn("mt-2 text-xs", GRIS)}>{arranques.length === 0 ? "—" : sinUbicacion ? `${sinUbicacion} sin ubicación` : "Todos con ubicación"}</p>
        </div>
        <div className={cn("rounded-2xl bg-card p-4 sm:p-5", SOMBRA)}>
          <div className="flex items-center justify-between">
            <p className={cn("text-[13px]", GRIS)}>Con arranque</p>
            <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-[#ECE8FD] text-[#3A0CE3]">
              <Users className="size-4" />
            </span>
          </div>
          <p className="mt-1 text-[28px] leading-none font-semibold tabular-nums">{nAsignados}</p>
          <p className={cn("mt-2 text-xs", GRIS)}>{arranques.length ? `${Math.round(nAsignados / arranques.length)} por arranque en promedio` : "—"}</p>
        </div>
        <div className={cn("col-span-2 rounded-2xl bg-card p-4 sm:p-5", SOMBRA)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={cn("text-[13px]", GRIS)}>Cobertura de la red</p>
              <p className="mt-1 text-[28px] leading-none font-semibold tabular-nums">{cobertura}%</p>
            </div>
            {nLibres > 0 && arranques.length > 0 && (
              <button type="button" onClick={() => setAsignando({})} className="flex items-center gap-1 rounded-lg bg-[#FFF3E5] px-2.5 py-1.5 text-xs font-semibold text-[#8F4400] hover:bg-[#FFE9D1] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <AlertTriangle className="size-3.5" aria-hidden />
                {nLibres} sin arranque
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          <div role="progressbar" aria-label="Socios con arranque" aria-valuenow={nAsignados} aria-valuemin={0} aria-valuemax={socios.length} className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEEBF7]">
            <span className="block h-full rounded-full bg-[#6B46F5]" style={{ width: `${Math.max(cobertura, nAsignados > 0 ? 1.5 : 0)}%` }} />
          </div>
          <p className={cn("mt-2 text-xs", GRIS)}>
            {nAsignados} de {socios.length} socios tienen un arranque asignado
          </p>
        </div>
      </div>

      {/* Lista + detalle */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className={cn("min-w-0 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
            <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold">
                  Arranques <span className={cn("font-normal", GRIS)}>· {visibles.length}</span>
                </h2>
                <div role="radiogroup" aria-label="Vista" data-tour="arr-vista" className="flex rounded-lg bg-[#F4F3F9] p-0.5">
                  {(
                    [
                      ["lista", "Lista", List],
                      ["mapa", "Mapa", MapIcon],
                    ] as const
                  ).map(([v, texto, Icono]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={vista === v}
                      onClick={() => setVista(v)}
                      className={cn("flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", vista === v ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}
                    >
                      <Icono className="size-3.5" aria-hidden />
                      {texto}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative min-w-0 sm:w-[300px]">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input aria-label="Buscar arranque" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Arranque, lugar o socio" className="h-9 rounded-lg border-[#E4E1F0] bg-white pl-9 shadow-none" />
              </div>
            </div>

            {vista === "mapa" ? (
              <>
                <MapaRed arranques={visibles.map((a) => ({ id: a.id, nombre: a.nombre, lat: a.lat, lng: a.lng, socios: a.socios.length }))} sel={actual?.id ?? null} onElegir={(id) => { setSel(id); setMovil(true); }} />
                {sinPunto.length > 0 && (
                  <div className="flex items-center gap-2 border-t border-[#F0EEF6] bg-[#FFF9F1] px-4 py-2.5 text-[13px] text-[#7A3B00] sm:px-5">
                    <MapPin className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1">
                      {sinPunto.length} arranque{sinPunto.length === 1 ? "" : "s"} sin ubicación no aparece{sinPunto.length === 1 ? "" : "n"} en el mapa.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSel(sinPunto[0].id);
                        setMovil(true);
                      }}
                      className="font-semibold underline underline-offset-2"
                    >
                      Ubicar
                    </button>
                  </div>
                )}
              </>
            ) : visibles.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="font-semibold">{arranques.length ? "Sin resultados" : "Aún no hay arranques"}</p>
                <p className={cn("mt-1 text-sm", GRIS)}>{arranques.length ? "Prueba con otro nombre, lugar o socio." : "Crea el primero para empezar a asignar socios. Así sabes a quién afecta si hay que cortar el agua en uno."}</p>
                {arranques.length === 0 && (
                  <Button onClick={() => setCreando(true)} className="mt-4 h-10 rounded-lg px-4 font-semibold">
                    <Plus />
                    Registrar el primer arranque
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-[#F3F1F8]">
                {visibles.map((a) => {
                  const activo = actual?.id === a.id;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSel(a.id);
                          setMovil(true);
                        }}
                        aria-current={activo ? "true" : undefined}
                        className={cn("flex w-full items-center gap-4 px-4 py-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[#C4B7FA] focus-visible:outline-none focus-visible:ring-inset sm:px-5", activo ? "bg-[#F5F3FE] shadow-[inset_3px_0_0_#3A0CE3]" : "hover:bg-[#FBFAFF]")}
                      >
                        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E2F2FC] text-[#0A5F91]">
                          <Droplets className="size-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{a.nombre}</span>
                          {a.lat !== null ? (
                            <span className={cn("flex items-center gap-1 truncate text-[13px]", GRIS)}>
                              <MapPin className="size-3.5 shrink-0 text-[#6B46F5]" aria-hidden />
                              {a.ubicacion ?? "Ubicado en el mapa"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#B86400]">
                              <MapPin className="size-3.5" aria-hidden />
                              Sin ubicación{a.ubicacion ? ` · ${a.ubicacion}` : ""}
                            </span>
                          )}
                        </span>
                        <span className="hidden min-w-0 items-center gap-3 sm:flex">
                          <span className="flex -space-x-1.5">
                            {a.socios.slice(0, 4).map((s) => (
                              <AvatarSocio key={s.id} id={s.id} nombre={s.nombre} className="size-8 ring-2 ring-white" />
                            ))}
                            {a.socios.length > 4 && <span className="flex size-8 items-center justify-center rounded-full bg-[#F0EFF4] text-[11px] font-bold text-[#4A4760] ring-2 ring-white">+{a.socios.length - 4}</span>}
                          </span>
                        </span>
                        <span className="w-[72px] shrink-0 text-right">
                          <span className="block text-[15px] font-semibold tabular-nums">{a.socios.length}</span>
                          <span className={cn("block text-xs", GRIS)}>socio{a.socios.length === 1 ? "" : "s"}</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-[#B4B2C4] lg:hidden" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {nLibres > 0 && arranques.length > 0 && (
            <div className={cn("min-w-0 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
              <div className="flex flex-col gap-1 border-b border-[#F0EEF6] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h2 className="text-[15px] font-semibold">
                    Socios sin arranque <span className="ml-1 rounded-full bg-[#FFF3E5] px-2 py-0.5 text-xs font-semibold text-[#8F4400]">{nLibres}</span>
                  </h2>
                  <p className={cn("mt-0.5 text-[13px]", GRIS)}>Asígnalos uno a uno aquí, o varios a la vez.</p>
                </div>
                <Button variant="ghost" onClick={() => setAsignando({})} className="-ml-2 h-9 self-start rounded-lg px-2 font-semibold text-[#2A07A8] sm:ml-0 sm:self-auto">
                  <UserPlus />
                  Asignar varios
                </Button>
              </div>
              <ul className="divide-y divide-[#F3F1F8]">
                {libres.slice(0, 5).map((s, i) => (
                  <li key={s.id} className={cn("flex items-center gap-3 px-4 py-2.5 sm:px-5", i > 2 && "max-sm:hidden")}>
                    <AvatarSocio id={s.id} nombre={s.nombre} className="size-8" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.nombre}</span>
                      {s.numero && <span className={cn("block text-xs", GRIS)}>Socio N° {s.numero}</span>}
                    </span>
                    <Select value={null} onValueChange={(v) => v && ejecutar(() => asignarSocios(v as string, [s.id]), `${s.nombre} asignado`)}>
                      <SelectTrigger aria-label={`Asignar a ${s.nombre}`} disabled={ocupado} className="h-8 w-[150px] rounded-lg border-[#E4E1F0] bg-white px-2.5 text-[13px] sm:w-[170px]">
                        <SelectValue placeholder="Asignar a…" />
                      </SelectTrigger>
                      <SelectContent>
                        {arranques.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                ))}
              </ul>
              {nLibres > 5 && (
                <button type="button" onClick={() => setAsignando({})} className="w-full border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3 text-center text-[13px] font-semibold text-[#2A07A8] hover:bg-[#F5F3FE] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset">
                  Ver los {nLibres} socios sin arranque
                </button>
              )}
            </div>
          )}
        </div>

        {actual ? (
          <div className={cn("hidden overflow-hidden rounded-2xl bg-card lg:sticky lg:top-4 lg:block", SOMBRA)}>{panel("pc")}</div>
        ) : (
          <div className={cn("hidden rounded-2xl bg-card p-8 text-center lg:block", SOMBRA)}>
            <p className={cn("text-sm", GRIS)}>Crea un arranque para ver sus socios.</p>
          </div>
        )}
      </div>

      {actual && movil && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Cerrar detalle" onClick={() => setMovil(false)} className="absolute inset-0 bg-[#15132B]/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white">
            <span aria-hidden className="mx-auto mt-2 block h-1 w-10 rounded-full bg-[#DCD9E8]" />
            {panel("movil")}
          </div>
        </div>
      )}

      {ocupado && (
        <span className="sr-only" role="status">
          <Loader2 className="animate-spin" /> Guardando…
        </span>
      )}

      {creando && <NuevoArranqueDialog onCerrar={cerrarCreacion} />}
      {asignando && <AsignarSociosDialog arranques={arranques} libres={libres} destinoInicial={asignando.destino} onCerrar={cerrarAsignar} />}
      {editando && <ArranqueDialog key={editando.id} arranque={editando} arranques={arranques} socios={socios} onCerrar={cerrarEdicion} />}
      {dialogo}
    </div>
  );
}
