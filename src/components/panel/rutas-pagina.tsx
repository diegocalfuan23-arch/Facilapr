"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArrowDown, ArrowUp, Check, ChevronRight, ClipboardList, Clock, Copy, Gauge, MapPin, MapPinOff, Navigation, Pencil, Plus, RotateCcw, Route, Search, Trash2, Users, X, Loader2 } from "lucide-react";
import { aprobarRuta, archivarRuta, asignarLaborARuta, eliminarRuta, guardarRuta, quitarLaborDeRuta } from "@/app/panel/lecturas/rutas-actions";
import { CroquisRuta } from "@/components/panel/croquis-ruta";
import { Editor, guardarRutaElegida, type SocioRuta } from "@/components/panel/rutas-panel";
import { LaborDialog } from "@/components/panel/labor-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Insumo } from "@/lib/inventario-comun";
import { TEXTO_ESTADO_LABOR, textoTipoLabor, type EstadoLabor, type RutaOpcion } from "@/lib/labores-comun";
import { colorRuta, fechaCorta, medirRuta, textoKm, textoMinutos, ubicacionPorConfirmar, type ArranqueRuta, type LaborEnRuta, type RutaVista } from "@/lib/rutas-comun";

const GRIS = "text-[#5B5970]";
const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type LaborAsignable = { id: string; numero: number; titulo: string; tipo: string; fecha: string; estado: EstadoLabor };
type Pestana = "activas" | "porAprobar" | "archivadas";

const iniciales = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

const IconoLabor = ({ tipo, className }: { tipo: string; className?: string }) => (tipo === "LECTURA" ? <Gauge className={className} aria-hidden /> : <ClipboardList className={className} aria-hidden />);

/** La labor que se muestra de una ruta: la que está en curso o, si no hay, la próxima programada. */
function laborActual(ls: LaborEnRuta[]): { l: LaborEnRuta; programada: boolean } | null {
  const curso = ls.find((l) => l.estado === "EN_CURSO");
  if (curso) return { l: curso, programada: false };
  const prox = ls.filter((l) => l.estado === "PROGRAMADA").sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  return prox ? { l: prox, programada: true } : null;
}

function Avance({ hechos, total, color }: { hechos: number; total: number; color: string }) {
  const pct = total ? Math.round((hechos / total) * 100) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#EFEDF7]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** El recorrido de la ruta dibujado con las ubicaciones marcadas de sus socios. */
function Croquis({ ruta, porId }: { ruta: RutaVista; porId: Map<string, SocioRuta> }) {
  const puntos = ruta.socioIds.flatMap((id, i) => {
    const s = porId.get(id);
    return s?.lat != null && s.lng != null ? [{ n: i + 1, lat: s.lat, lng: s.lng }] : [];
  });
  return <CroquisRuta nombre={ruta.nombre} color={colorRuta(ruta.id)} puntos={puntos} faltan={ruta.socioIds.length - puntos.length} />;
}

export function RutasPagina({
  socios,
  rutas,
  arranques,
  laboresPorRuta,
  laboresAsignables,
  insumos,
  conLabores,
  operadores,
}: {
  socios: SocioRuta[];
  rutas: RutaVista[];
  /** Los operadores del comité, para elegir el habitual de cada ruta. */
  operadores: { id: string; nombre: string }[];
  arranques: ArranqueRuta[];
  laboresPorRuta: Record<string, LaborEnRuta[]>;
  laboresAsignables: LaborAsignable[];
  insumos: Insumo[];
  /** El plan incluye Labores (desde Estándar). */
  conLabores: boolean;
}) {
  const router = useRouter();
  const [pestana, setPestana] = useState<Pestana>("activas");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [hoja, setHoja] = useState(false);
  const [editando, setEditando] = useState<{ id: string | null; nombre: string; ids: string[]; operadorId?: string | null } | null>(null);
  const [agregando, setAgregando] = useState<RutaVista | null>(null);
  const [asignando, setAsignando] = useState<RutaVista | null>(null);
  const [nuevaEn, setNuevaEn] = useState<string | null>(null);
  const [trabajando, iniciar] = useTransition();

  const porId = useMemo(() => new Map(socios.map((s) => [s.id, s])), [socios]);
  const opciones: RutaOpcion[] = rutas.filter((r) => r.aprobada && !r.archivada).map((r) => ({ id: r.id, nombre: r.nombre }));
  const activas = rutas.filter((r) => r.aprobada && !r.archivada);
  const porAprobar = rutas.filter((r) => !r.aprobada);
  const archivadas = rutas.filter((r) => r.archivada);

  // Resumen
  const cubiertos = new Set(activas.flatMap((r) => r.socioIds.filter((id) => porId.has(id))));
  const sinRuta = socios.length - cubiertos.size;
  const entradas = activas.flatMap((r) => laboresPorRuta[r.id] ?? []);
  const enCurso = entradas.filter((l) => l.estado === "EN_CURSO");
  const cursoIds = new Set(enCurso.map((l) => l.id));
  const cursoHechas = enCurso.reduce((t, l) => t + l.hechas, 0);
  const cursoParadas = enCurso.reduce((t, l) => t + l.paradas, 0);
  const programadas = [...new Map(entradas.filter((l) => l.estado === "PROGRAMADA").map((l) => [l.id, l])).values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const sinLabor = activas.filter((r) => !(laboresPorRuta[r.id] ?? []).some((l) => l.estado !== "HECHA")).length;

  const buscado = sinTildes(q.trim());
  const lista = (pestana === "activas" ? activas : pestana === "porAprobar" ? porAprobar : archivadas).filter((r) => !buscado || sinTildes(r.nombre).includes(buscado));
  const sel = lista.find((r) => r.id === selId) ?? lista[0] ?? null;

  function abrir(r: RutaVista) {
    setSelId(r.id);
    if (window.matchMedia("(max-width: 1023px)").matches) setHoja(true);
  }

  function cambiarSocios(r: RutaVista, ids: string[], aviso?: string) {
    iniciar(async () => {
      const res = await guardarRuta(r.id, r.nombre, ids);
      if (res.ok) {
        if (aviso) toast.success(aviso);
      } else toast.error(res.error);
    });
  }

  function aprobar(r: RutaVista) {
    iniciar(async () => {
      const res = await aprobarRuta(r.id);
      if (res.ok) {
        toast.success(`«${r.nombre}» aprobada y lista para usar`);
        setPestana("activas");
        setSelId(r.id);
      } else toast.error(res.error);
    });
  }

  function borrar(r: RutaVista) {
    if (!window.confirm(`¿Borrar la ruta «${r.nombre}»?`)) return;
    iniciar(async () => {
      const res = await eliminarRuta(r.id);
      if (res.ok) {
        setHoja(false);
        toast.success("Ruta borrada");
      } else toast.error(res.error);
    });
  }

  function archivar(r: RutaVista, archivar: boolean) {
    iniciar(async () => {
      const res = await archivarRuta(r.id, archivar);
      if (res.ok) {
        setHoja(false);
        setPestana(archivar ? "archivadas" : "activas");
        setSelId(r.id);
        toast.success(archivar ? `«${r.nombre}» archivada` : `«${r.nombre}» restaurada`);
      } else toast.error(res.error);
    });
  }

  function duplicar(r: RutaVista) {
    iniciar(async () => {
      const res = await guardarRuta(null, `${r.nombre} (copia)`, r.socioIds);
      if (res.ok) toast.success("Ruta duplicada");
      else toast.error(res.error);
    });
  }

  function tomarLecturas(r: RutaVista) {
    guardarRutaElegida(r.id);
    router.push("/panel/lecturas/terreno");
  }

  function quitarLabor(laborId: string, rutaId: string) {
    iniciar(async () => {
      const res = await quitarLaborDeRuta(laborId, rutaId);
      if (res.ok) toast.success("Labor quitada de la ruta");
      else toast.error(res.error);
    });
  }

  const detalle = (r: RutaVista, enHoja: boolean) => (
    <Detalle
      key={r.id}
      ruta={r}
      porId={porId}
      labores={laboresPorRuta[r.id] ?? []}
      conLabores={conLabores}
      trabajando={trabajando}
      enHoja={enHoja}
      onCerrar={() => setHoja(false)}
      onMover={(ids) => cambiarSocios(r, ids)}
      onAgregar={() => {
        setHoja(false);
        setAgregando(r);
      }}
      onEditar={() => {
        setHoja(false);
        setEditando({ id: r.id, nombre: r.nombre, ids: r.socioIds, operadorId: r.operadorId });
      }}
      onArchivar={() => archivar(r, true)}
      onRestaurar={() => archivar(r, false)}
      onDuplicar={() => duplicar(r)}
      onBorrar={() => borrar(r)}
      onAprobar={() => aprobar(r)}
      onAsignar={() => {
        setHoja(false);
        setAsignando(r);
      }}
      onTomar={() => tomarLecturas(r)}
      onQuitarLabor={(laborId) => quitarLabor(laborId, r.id)}
    />
  );

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[28px]">Rutas</h1>
          <p className={`mt-0.5 text-[15px] ${GRIS}`}>El recorrido de los socios en terreno. Las usa quien toma las lecturas, también sin señal.</p>
        </div>
        <Button onClick={() => setEditando({ id: null, nombre: "", ids: [] })} className="h-10 rounded-lg px-4 font-semibold">
          <Plus className="size-4" />
          Nueva ruta
        </Button>
      </div>

      <div className={`mt-5 grid grid-cols-2 overflow-hidden rounded-2xl bg-white ${conLabores ? "lg:grid-cols-4" : ""} ${SOMBRA}`}>
        <div className="p-4 sm:p-5">
          <p className={`text-[13px] ${GRIS}`}>Rutas activas</p>
          <p className="mt-0.5 text-[24px] leading-tight font-semibold tabular-nums">{activas.length}</p>
          {conLabores ? <p className={`mt-0.5 text-xs ${GRIS}`}>{sinLabor ? `${sinLabor} sin labor asignada` : "Todas con labor"}</p> : null}
        </div>
        <div className="border-l border-[#F0EEF6] p-4 sm:p-5">
          <p className={`text-[13px] ${GRIS}`}>Socios con ruta</p>
          <p className="mt-0.5 text-[24px] leading-tight font-semibold tabular-nums">
            {cubiertos.size}
            <span className={`text-[15px] font-normal ${GRIS}`}> de {socios.length}</span>
          </p>
          {sinRuta > 0 ? <p className="mt-0.5 text-xs font-medium text-[#8A4B00]">{sinRuta} sin ruta</p> : <p className="mt-0.5 text-xs text-[#075A3C]">Todos cubiertos</p>}
        </div>
        {conLabores ? (
          <>
            <div className="border-t border-[#F0EEF6] p-4 sm:p-5 lg:border-t-0 lg:border-l">
              <p className={`text-[13px] ${GRIS}`}>Labores en curso</p>
              <p className="mt-0.5 text-[24px] leading-tight font-semibold tabular-nums">
                {cursoIds.size}
                <span className={`text-[13px] font-normal ${GRIS}`}> · {cursoHechas} de {cursoParadas} socios</span>
              </p>
              <div className="mt-2">
                <Avance hechos={cursoHechas} total={cursoParadas} color="#3A0CE3" />
              </div>
            </div>
            <div className="border-t border-l border-[#F0EEF6] p-4 sm:p-5 lg:border-t-0">
              <p className={`text-[13px] ${GRIS}`}>Programadas</p>
              <p className="mt-0.5 text-[24px] leading-tight font-semibold tabular-nums">{programadas.length}</p>
              <p className={`mt-0.5 truncate text-xs ${GRIS}`}>{programadas[0] ? `${programadas[0].titulo} · ${fechaCorta(programadas[0].fecha)}` : "Nada programado"}</p>
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className={`min-w-0 overflow-hidden rounded-2xl bg-white ${SOMBRA}`}>
          <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4 sm:flex-row sm:items-center sm:px-5">
            <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-[#F4F3F9] p-1 sm:w-[380px]">
              {(
                [
                  ["activas", "Activas", activas.length],
                  ["porAprobar", "Por aprobar", porAprobar.length],
                  ["archivadas", "Archivadas", archivadas.length],
                ] as const
              ).map(([k, t, n]) => (
                <button key={k} role="tab" aria-selected={pestana === k} onClick={() => setPestana(k)} className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-[13px] font-semibold ${pestana === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS}`}>
                  {t}
                  {n ? <span className={`rounded-full px-1.5 text-[11px] leading-4 ${k === "porAprobar" ? "bg-[#F5A524] text-white" : pestana === k ? "bg-[#ECE8FD]" : "bg-white/70"}`}>{n}</span> : null}
                </button>
              ))}
            </div>
            <div className="relative sm:ml-auto sm:w-[200px]">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8B89A0]" />
              <Input aria-label="Buscar ruta" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ruta" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
            </div>
          </div>

          <div className={`hidden grid-cols-[minmax(0,1fr)_140px_190px_20px] gap-4 border-b border-[#F3F1F8] bg-[#FAFAFD] px-5 py-2.5 text-xs font-medium md:grid ${GRIS}`}>
            <span>Ruta</span>
            <span>Operador habitual</span>
            <span>{pestana === "activas" ? "Labor actual" : pestana === "porAprobar" ? "Propuesta" : "Creada"}</span>
            <span />
          </div>

          <ul className="divide-y divide-[#F3F1F8]">
            {lista.map((r) => {
              const color = colorRuta(r.id);
              const { km, minutos, sinUbicacion } = medirRuta(r.socioIds, porId);
              const act = conLabores ? laborActual(laboresPorRuta[r.id] ?? []) : null;
              const activo = sel?.id === r.id;
              return (
                <li key={r.id}>
                  <button onClick={() => abrir(r)} aria-current={activo ? "true" : undefined} className={`relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left md:grid-cols-[minmax(0,1fr)_140px_190px_20px] md:px-5 ${activo ? "bg-[#F7F5FF]" : "hover:bg-[#FAFAFD]"}`}>
                    {activo ? <span aria-hidden className="absolute inset-y-2 left-0 hidden w-[3px] rounded-r-full bg-[#3A0CE3] lg:block" /> : null}
                    <span className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}14`, color }}>
                        <Route className="size-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold">{r.nombre}</span>
                        <span className={`block truncate text-[13px] ${GRIS}`}>
                          {r.socioIds.length} {r.socioIds.length === 1 ? "socio" : "socios"}
                          {km > 0 ? ` · ${textoKm(km)} · ${textoMinutos(minutos)}` : ""}
                          {sinUbicacion > 0 ? <span className="font-medium text-[#8A4B00]"> · {sinUbicacion} sin ubicación</span> : null}
                          {r.socioIds.filter((id) => ubicacionPorConfirmar(porId.get(id))).length > 0 ? <span className="font-medium text-[#8A4B00]"> · {r.socioIds.filter((id) => ubicacionPorConfirmar(porId.get(id))).length} por confirmar</span> : null}
                        </span>
                      </span>
                    </span>
                    <span className="hidden min-w-0 items-center gap-2 md:flex">
                      {r.operadorNombre ? (
                        <>
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#ECE8FD] text-[11px] font-bold text-[#2A07A8]">{iniciales(r.operadorNombre)}</span>
                          <span className="truncate text-[13px]">{r.operadorNombre.split(" ")[0]}</span>
                        </>
                      ) : (
                        <span className={`text-[13px] ${GRIS}`}>—</span>
                      )}
                    </span>
                    <span className="min-w-0 text-right md:text-left">
                      {pestana === "activas" ? (
                        act ? (
                          <span className="flex flex-col items-end gap-1 md:items-stretch">
                            <span className="flex items-center justify-end gap-1.5 text-[13px] md:justify-start">
                              <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-md bg-[#ECE8FD] text-[#3A0CE3]">
                                <IconoLabor tipo={act.l.tipo} className="size-3" />
                              </span>
                              <span className="hidden truncate font-medium md:inline">{act.l.titulo}</span>
                              <span className={`shrink-0 tabular-nums md:ml-auto ${GRIS}`}>{act.programada ? fechaCorta(act.l.fecha) : `${act.l.hechas}/${act.l.paradas}`}</span>
                            </span>
                            {!act.programada ? (
                              <span className="hidden w-full md:block">
                                <Avance hechos={act.l.hechas} total={act.l.paradas} color={color} />
                              </span>
                            ) : (
                              <span className={`hidden text-[11px] md:block ${GRIS}`}>Programada</span>
                            )}
                          </span>
                        ) : (
                          <span className={`text-[13px] ${GRIS}`}>{conLabores ? "Sin labor" : "—"}</span>
                        )
                      ) : pestana === "porAprobar" ? (
                        <span className="rounded-full bg-[#FFF3E0] px-2 py-0.5 text-[12px] font-semibold text-[#8A4B00]">Por aprobar</span>
                      ) : (
                        <span className={`text-[13px] ${GRIS}`}>{fechaCorta(r.creada)}</span>
                      )}
                    </span>
                    <ChevronRight className="hidden size-4 text-[#A19FB2] md:block" aria-hidden />
                  </button>
                </li>
              );
            })}
            {lista.length === 0 ? (
              <li className="px-6 py-14 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#ECE8FD] text-[#3A0CE3]">
                  <Route className="size-6" aria-hidden />
                </span>
                <p className="mt-3 text-sm font-semibold">{q ? "Ninguna ruta coincide" : pestana === "porAprobar" ? "No hay rutas por aprobar" : pestana === "archivadas" ? "No hay rutas archivadas" : "Aún no hay rutas"}</p>
                <p className={`mx-auto mt-1 max-w-[340px] text-xs ${GRIS}`}>Crea un recorrido con los socios de un sector. Sin ruta, se recorren todos por orden alfabético.</p>
                {pestana === "activas" && !q ? (
                  <Button onClick={() => setEditando({ id: null, nombre: "", ids: [] })} className="mt-4 h-10 rounded-lg font-semibold">
                    <Plus className="size-4" />
                    Nueva ruta
                  </Button>
                ) : null}
              </li>
            ) : null}
          </ul>

          {pestana === "activas" && sinRuta > 0 && activas.length > 0 ? (
            <button onClick={() => setEditando({ id: null, nombre: "", ids: [] })} className="flex w-full items-center gap-2 border-t border-[#F0EEF6] bg-[#FFFBF3] px-5 py-2.5 text-left text-xs text-[#7A4A00] hover:bg-[#FFF6E8]">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="flex-1">{sinRuta} {sinRuta === 1 ? "socio no está" : "socios no están"} en ninguna ruta.</span>
              <span className="shrink-0 font-semibold underline">Crear ruta</span>
            </button>
          ) : null}
        </div>

        <aside className={`sticky top-4 hidden h-[calc(100vh-32px)] max-h-[860px] min-h-[560px] overflow-hidden rounded-2xl bg-white lg:block ${SOMBRA}`}>
          {sel ? detalle(sel, false) : <div className={`flex h-full items-center justify-center p-8 text-center text-sm ${GRIS}`}>Elige una ruta para ver su recorrido.</div>}
        </aside>
      </div>

      {/* Detalle en el celular */}
      <Dialog open={hoja && !!sel} onOpenChange={setHoja}>
        <DialogContent showCloseButton={false} className="top-auto bottom-0 left-0 flex h-[90dvh] max-h-[90dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:p-0 lg:hidden">
          <DialogTitle className="sr-only">{sel?.nombre ?? "Ruta"}</DialogTitle>
          {sel ? detalle(sel, true) : null}
        </DialogContent>
      </Dialog>

      {/* Crear o editar */}
      {editando ? (
        <Dialog open onOpenChange={(v) => !v && setEditando(null)}>
          <DialogContent showCloseButton={false} className="top-auto bottom-0 left-0 flex max-h-[94dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[90vh] sm:w-[560px] sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0">
            <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-semibold">{editando.id ? "Editar ruta" : "Nueva ruta"}</DialogTitle>
                <p className={`mt-0.5 text-[13px] ${GRIS}`}>Los socios en el orden en que se visitan.</p>
              </div>
              <DialogClose aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
                <X className="size-[18px]" />
              </DialogClose>
            </div>
            <Editor socios={socios} arranques={arranques} porId={porId} inicial={editando} esAdmin operadores={operadores} onVolver={() => setEditando(null)} />
          </DialogContent>
        </Dialog>
      ) : null}

      {agregando ? (
        <AgregarSocios
          ruta={agregando}
          socios={socios}
          arranques={arranques}
          enOtra={(id) => activas.find((x) => x.id !== agregando.id && x.socioIds.includes(id))?.nombre ?? null}
          onCerrar={() => setAgregando(null)}
          onAgregar={(ids, pos) => {
            const c = [...agregando.socioIds];
            c.splice(pos, 0, ...ids);
            cambiarSocios(agregando, c, ids.length === 1 ? `${porId.get(ids[0])?.nombre ?? "Socio"} agregado a la ruta` : `${ids.length} socios agregados a la ruta`);
            setAgregando(null);
          }}
        />
      ) : null}

      {asignando ? (
        <AsignarLabor
          ruta={asignando}
          labores={laboresAsignables.filter((l) => l.estado !== "HECHA" && !(laboresPorRuta[asignando.id] ?? []).some((x) => x.id === l.id))}
          onNueva={() => {
            setNuevaEn(asignando.id);
            setAsignando(null);
          }}
          onCerrar={() => setAsignando(null)}
        />
      ) : null}
      {nuevaEn ? <LaborDialog key={nuevaEn} labor={null} insumos={insumos} rutas={opciones} responsables={operadores.map((o) => o.nombre)} rutaInicial={nuevaEn} onCerrar={() => setNuevaEn(null)} /> : null}
    </div>
  );
}

function Detalle({
  ruta,
  porId,
  labores,
  conLabores,
  trabajando,
  enHoja,
  onCerrar,
  onMover,
  onAgregar,
  onEditar,
  onArchivar,
  onRestaurar,
  onDuplicar,
  onBorrar,
  onAprobar,
  onAsignar,
  onTomar,
  onQuitarLabor,
}: {
  ruta: RutaVista;
  porId: Map<string, SocioRuta>;
  labores: LaborEnRuta[];
  conLabores: boolean;
  trabajando: boolean;
  enHoja: boolean;
  onCerrar: () => void;
  onMover: (ids: string[]) => void;
  onAgregar: () => void;
  onEditar: () => void;
  onArchivar: () => void;
  onRestaurar: () => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  onAprobar: () => void;
  onAsignar: () => void;
  onTomar: () => void;
  onQuitarLabor: (laborId: string) => void;
}) {
  const [ver, setVer] = useState<"recorrido" | "labores">("recorrido");
  const color = colorRuta(ruta.id);
  const { km, minutos } = medirRuta(ruta.socioIds, porId);
  const act = conLabores && ruta.aprobada && !ruta.archivada ? laborActual(labores) : null;
  const editable = !ruta.archivada;
  const dudosas = ruta.socioIds.filter((id) => ubicacionPorConfirmar(porId.get(id))).length;
  const ids = ruta.socioIds;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-3 px-5 pt-5 pb-4">
        <span aria-hidden className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: color }}>
          <Route className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[18px] leading-tight font-semibold">{ruta.nombre}</h2>
          <p className={`mt-0.5 text-[13px] ${GRIS}`}>{ruta.archivada ? "Archivada" : !ruta.aprobada ? "Propuesta desde terreno" : ruta.operadorNombre ? `Operador habitual: ${ruta.operadorNombre}` : "Sin operador habitual"}</p>
        </div>
        {enHoja ? (
          <Button type="button" variant="ghost" size="icon" aria-label="Cerrar" onClick={onCerrar} className="size-9 text-[#5B5970]">
            <X className="size-[18px]" />
          </Button>
        ) : null}
      </div>
      {!ruta.aprobada ? (
        <p className="mx-5 mb-4 rounded-xl bg-[#FFF6E8] p-3.5 text-[13px] text-[#6B4300]">Revisa el recorrido: al aprobarla queda lista para usar.</p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <Croquis ruta={ruta} porId={porId} />
        <dl className="mt-3 grid grid-cols-3 divide-x divide-[#F0EEF6] rounded-xl ring-1 ring-[#F0EEF6]">
          {[
            [Users, "Socios", String(ids.length)],
            [Navigation, "Distancia", km > 0 ? textoKm(km) : "—"],
            [Clock, "Tiempo est.", textoMinutos(minutos)],
          ].map(([I, l, v]) => {
            const Ico = I as typeof Users;
            return (
              <div key={l as string} className="px-3 py-2.5">
                <dt className={`flex items-center gap-1 text-[11px] ${GRIS}`}>
                  <Ico className="size-3" aria-hidden />
                  {l as string}
                </dt>
                <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{v as string}</dd>
              </div>
            );
          })}
        </dl>

        {act ? (
          <div className="mt-3 rounded-xl bg-[#FAFAFD] p-3.5 ring-1 ring-[#F0EEF6]">
            <button type="button" onClick={() => setVer("labores")} className="flex w-full items-center gap-3 text-left">
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#ECE8FD] text-[#3A0CE3]">
                <IconoLabor tipo={act.l.tipo} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate font-semibold">
                    {act.programada ? "Próxima" : "En curso"}: {act.l.titulo}
                  </span>
                  {act.programada ? (
                    <span className={`shrink-0 ${GRIS}`}>{fechaCorta(act.l.fecha)}</span>
                  ) : (
                    <span className="shrink-0 tabular-nums">
                      <b>{act.l.hechas}</b>
                      <span className={GRIS}> de {act.l.paradas}</span>
                    </span>
                  )}
                </span>
                {!act.programada ? (
                  <span className="mt-1.5 block">
                    <Avance hechos={act.l.hechas} total={act.l.paradas} color={color} />
                  </span>
                ) : null}
              </span>
            </button>
            {act.l.tipo === "LECTURA" && !act.programada ? (
              <Button type="button" onClick={onTomar} className="mt-3 h-10 w-full rounded-lg font-semibold">
                <Gauge className="size-4" />
                Tomar lecturas
              </Button>
            ) : null}
          </div>
        ) : null}

        {dudosas > 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#FFF6E8] p-3 text-[13px] text-[#6B4300]">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {dudosas} {dudosas === 1 ? "ubicación quedó" : "ubicaciones quedaron"} con poca precisión. El técnico las repite con «Volver a marcar» cuando pase por ahí.
            </span>
          </p>
        ) : null}

        {ruta.aprobada && !ruta.archivada && conLabores ? (
          <div role="tablist" className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-[#F4F3F9] p-1">
            {(
              [
                ["recorrido", `Recorrido (${ids.length})`],
                ["labores", `Labores (${labores.length})`],
              ] as const
            ).map(([k, t]) => (
              <button key={k} role="tab" aria-selected={ver === k} onClick={() => setVer(k)} className={`h-8 rounded-md text-[13px] font-semibold ${ver === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS}`}>
                {t}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-[13px] font-semibold">Recorrido ({ids.length})</p>
        )}

        {ver === "recorrido" || !ruta.aprobada || ruta.archivada || !conLabores ? (
          <>
            {editable ? <button type="button" onClick={onAgregar} disabled={trabajando} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#C9BCFB] text-[13px] font-semibold text-[#2A07A8] hover:bg-[#FAF8FF] disabled:opacity-50">
              <Plus className="size-4" aria-hidden />
              Agregar socio
            </button> : null}
            <ol className="mt-3">
              {ids.map((id, i) => {
                const s = porId.get(id);
                const mover = (d: number) => {
                  const c = [...ids];
                  [c[i], c[i + d]] = [c[i + d], c[i]];
                  onMover(c);
                };
                return (
                  <li key={id} className="group/p relative flex gap-3 pb-3 last:pb-0">
                    {i < ids.length - 1 ? <span aria-hidden className="absolute top-7 left-[13px] h-[calc(100%-22px)] w-px bg-[#E6E3F1]" /> : null}
                    <span className="relative flex size-[27px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="flex items-center gap-2 text-[14px] font-semibold">
                        <span className="truncate">{s?.nombre ?? "Socio"}</span>
                        {s?.numeroCliente ? <span className={`shrink-0 text-xs font-normal ${GRIS}`}>N° {s.numeroCliente}</span> : null}
                      </p>
                      {s?.lat != null ? (
                        ubicacionPorConfirmar(s) ? (
                          <p className="flex items-center gap-1 truncate text-xs font-medium text-[#8A4B00]">
                            <MapPin className="size-3 shrink-0" aria-hidden />
                            Por confirmar · error de {s.precision} m
                          </p>
                        ) : null
                      ) : (
                        <p className="flex items-center gap-1 truncate text-xs font-medium text-[#8A4B00]">
                          <MapPinOff className="size-3 shrink-0" aria-hidden />
                          Sin ubicación · se marca en terreno
                        </p>
                      )}
                    </div>
                    {editable ? <span className="flex shrink-0 items-start opacity-100 lg:opacity-0 lg:group-focus-within/p:opacity-100 lg:group-hover/p:opacity-100">
                      <button type="button" aria-label={`Subir a ${s?.nombre ?? "socio"}`} disabled={i === 0 || trabajando} onClick={() => mover(-1)} className="flex size-7 items-center justify-center rounded-md text-[#5B5970] hover:bg-[#F4F3F9] disabled:opacity-30">
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button type="button" aria-label={`Bajar a ${s?.nombre ?? "socio"}`} disabled={i === ids.length - 1 || trabajando} onClick={() => mover(1)} className="flex size-7 items-center justify-center rounded-md text-[#5B5970] hover:bg-[#F4F3F9] disabled:opacity-30">
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button type="button" aria-label={`Quitar a ${s?.nombre ?? "socio"}`} disabled={ids.length === 1 || trabajando} onClick={() => onMover(ids.filter((x) => x !== id))} className="flex size-7 items-center justify-center rounded-md text-[#5B5970] hover:bg-[#FDF3F3] hover:text-[#A32020] disabled:opacity-30">
                        <X className="size-3.5" />
                      </button>
                    </span> : null}
                  </li>
                );
              })}
            </ol>
          </>
        ) : labores.length ? (
          <ul className="mt-3 space-y-2">
            {labores.map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-[#F0EEF6]">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#ECE8FD] text-[#3A0CE3]">
                  <IconoLabor tipo={l.tipo} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    L-{l.numero} · {l.titulo}
                  </p>
                  <p className={`truncate text-xs ${GRIS}`}>
                    {TEXTO_ESTADO_LABOR[l.estado]} · {fechaCorta(l.fecha)}
                  </p>
                  {l.estado !== "PROGRAMADA" ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1">
                        <Avance hechos={l.hechas} total={l.paradas} color={color} />
                      </div>
                      <span className={`text-[11px] tabular-nums ${GRIS}`}>
                        {l.hechas}/{l.paradas}
                      </span>
                    </div>
                  ) : null}
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${l.titulo} de la ruta`} disabled={trabajando} onClick={() => onQuitarLabor(l.id)} className="size-8 shrink-0 text-[#A32020]">
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-[#D9D4F0] px-4 py-6 text-center">
            <p className="text-sm font-semibold">Sin labores asignadas</p>
            <p className={`mt-1 text-xs ${GRIS}`}>Asígnala a una labor para que se haga en cada socio del recorrido.</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3">
        {ruta.archivada ? (
          <>
            <Button type="button" variant="outline" onClick={onBorrar} disabled={trabajando} className="h-10 rounded-lg border-[#F3D1D1] bg-white font-semibold text-[#A32020] hover:bg-[#FDF3F3]">
              <Trash2 className="size-4" />
              Eliminar
            </Button>
            <Button type="button" onClick={onRestaurar} disabled={trabajando} className="ml-auto h-10 rounded-lg px-4 font-semibold">
              <RotateCcw className="size-4" />
              Restaurar
            </Button>
          </>
        ) : ruta.aprobada ? (
          <>
            <Button type="button" variant="ghost" size="icon" aria-label="Duplicar ruta" title="Duplicar" disabled={trabajando} onClick={onDuplicar} className="size-10 shrink-0 rounded-lg text-[#46435C]">
              <Copy className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Archivar ruta" title="Archivar" disabled={trabajando} onClick={onArchivar} className="size-10 shrink-0 rounded-lg text-[#46435C]">
              <Archive className="size-4" />
            </Button>
            <Button type="button" variant="outline" onClick={onEditar} disabled={trabajando} className="ml-auto h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold">
              <Pencil className="size-4" />
              Editar
            </Button>
            {conLabores ? (
              <Button type="button" onClick={onAsignar} disabled={trabajando} className="h-10 rounded-lg px-4 font-semibold">
                <ClipboardList className="size-4" />
                Asignar labor
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={onEditar} disabled={trabajando} className="h-10 rounded-lg font-semibold text-[#46435C]">
              <Pencil className="size-4" />
              Ajustar
            </Button>
            <Button type="button" variant="outline" onClick={onBorrar} disabled={trabajando} className="ml-auto h-10 rounded-lg border-[#F3D1D1] bg-white font-semibold text-[#A32020] hover:bg-[#FDF3F3]">
              Rechazar
            </Button>
            <Button type="button" onClick={onAprobar} disabled={trabajando} className="h-10 rounded-lg px-4 font-semibold">
              {trabajando ? <Loader2 className="animate-spin" /> : <Check className="size-4" />}
              Aprobar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Suma un socio, o un arranque completo, al recorrido de la ruta, en la posición que se elija. */
function AgregarSocios({
  ruta,
  socios,
  arranques,
  enOtra,
  onCerrar,
  onAgregar,
}: {
  ruta: RutaVista;
  socios: SocioRuta[];
  arranques: ArranqueRuta[];
  enOtra: (id: string) => string | null;
  onCerrar: () => void;
  onAgregar: (ids: string[], posicion: number) => void;
}) {
  const [fuente, setFuente] = useState<"socio" | "arranque">("socio");
  const [q, setQ] = useState("");
  const [socioId, setSocioId] = useState<string | null>(null);
  const [arranqueId, setArranqueId] = useState<string | null>(null);
  const [pos, setPos] = useState("fin");
  const porId = useMemo(() => new Map(socios.map((s) => [s.id, s])), [socios]);
  const yaEsta = new Set(ruta.socioIds);

  const t = sinTildes(q.trim());
  const disponibles = socios.filter((s) => !yaEsta.has(s.id) && (!t || sinTildes(`${s.nombre} ${s.numeroCliente ?? ""}`).includes(t)));
  const nuevosArranque = (arranqueId ? (arranques.find((a) => a.id === arranqueId)?.socioIds ?? []) : []).filter((id) => porId.has(id) && !yaEsta.has(id));
  const listo = fuente === "socio" ? socioId !== null : nuevosArranque.length > 0;
  const indice = pos === "fin" ? ruta.socioIds.length : pos === "inicio" ? 0 : Number(pos) + 1;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent showCloseButton={false} className="top-auto bottom-0 left-0 flex h-[88dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:h-[min(600px,90vh)] sm:w-[520px] sm:max-w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0">
        <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold">Agregar a la ruta</DialogTitle>
            <p className={`mt-0.5 text-[13px] ${GRIS}`}>
              {ruta.nombre} · hoy tiene {ruta.socioIds.length} {ruta.socioIds.length === 1 ? "socio" : "socios"}
            </p>
          </div>
          <DialogClose aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
            <X className="size-[18px]" />
          </DialogClose>
        </div>

        <div role="tablist" aria-label="Agregar" className="mx-6 mt-4 grid grid-cols-2 gap-1 rounded-lg bg-[#F4F3F9] p-1">
          {(
            [
              ["socio", "Un socio"],
              ["arranque", "Arranque completo"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={fuente === k} onClick={() => setFuente(k)} className={`h-9 rounded-md text-[13px] font-semibold ${fuente === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS}`}>
              {l}
            </button>
          ))}
        </div>

        {fuente === "arranque" ? (
          <ul role="radiogroup" aria-label="Arranque" className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-6 py-3">
            {arranques.length === 0 ? <li className={`py-8 text-center text-sm ${GRIS}`}>Aún no hay arranques con socios.</li> : null}
            {arranques.map((a) => {
              const n = a.socioIds.filter((id) => porId.has(id) && !yaEsta.has(id)).length;
              const on = arranqueId === a.id;
              return (
                <li key={a.id}>
                  <button type="button" role="radio" aria-checked={on} disabled={n === 0} onClick={() => setArranqueId(a.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 disabled:opacity-50 ${on ? "bg-[#F4F1FF] ring-[#3A0CE3]" : "ring-[#EFEDF6] hover:bg-[#F8F7FC]"}`}>
                    <span aria-hidden className={`flex size-4 shrink-0 rounded-full border ${on ? "border-[5px] border-[#3A0CE3]" : "border-[#CFCBE0]"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{a.nombre}</span>
                      <span className={`block text-xs ${GRIS}`}>
                        {a.socioIds.length} {a.socioIds.length === 1 ? "socio" : "socios"} · {n ? `se suman ${n}` : "todos ya están en la ruta"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <>
            <div className="px-6 py-3">
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8B89A0]" />
                <Input aria-label="Buscar socio" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o N° de cliente" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
              </div>
            </div>
            <ul role="radiogroup" aria-label="Socio" className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
              {disponibles.slice(0, 100).map((s) => {
                const on = socioId === s.id;
                const otra = enOtra(s.id);
                return (
                  <li key={s.id}>
                    <button type="button" role="radio" aria-checked={on} onClick={() => setSocioId(s.id)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${on ? "bg-[#F4F1FF] ring-1 ring-[#C9BCFB]" : "hover:bg-[#F8F7FC]"}`}>
                      <span aria-hidden className={`flex size-4 shrink-0 rounded-full border ${on ? "border-[5px] border-[#3A0CE3]" : "border-[#CFCBE0]"}`} />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                        {s.nombre}
                        {s.numeroCliente ? <span className={`ml-1.5 text-xs font-normal ${GRIS}`}>N° {s.numeroCliente}</span> : null}
                      </span>
                      {otra ? <span className="shrink-0 rounded-full bg-[#F4F3F9] px-2 py-0.5 text-[11px] font-medium text-[#46435C]">{otra}</span> : null}
                    </button>
                  </li>
                );
              })}
              {disponibles.length === 0 ? <li className={`px-4 py-8 text-center text-sm ${GRIS}`}>{q.trim() ? "Ningún socio coincide." : "Todos los socios ya están en la ruta."}</li> : null}
            </ul>
          </>
        )}

        <div className="flex flex-col gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className={`shrink-0 text-[13px] ${GRIS}`}>Ubicar</span>
            <select aria-label="Posición en el recorrido" value={pos} onChange={(e) => setPos(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-[#E4E1F0] bg-white px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="fin">Al final del recorrido</option>
              <option value="inicio">Al inicio</option>
              {ruta.socioIds.slice(0, -1).map((id, i) => (
                <option key={id} value={String(i)}>
                  Después de {i + 1}. {porId.get(id)?.nombre ?? "socio"}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" variant="outline" onClick={onCerrar} className="h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold">
              Cancelar
            </Button>
            <Button type="button" disabled={!listo} onClick={() => onAgregar(fuente === "socio" && socioId ? [socioId] : nuevosArranque, indice)} className="h-10 rounded-lg px-4 font-semibold">
              {fuente === "arranque" && nuevosArranque.length ? `Agregar ${nuevosArranque.length}` : "Agregar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Elegir la labor que va a recorrer la ruta: una que ya existe o una nueva. */
function AsignarLabor({ ruta, labores, onNueva, onCerrar }: { ruta: RutaVista; labores: LaborAsignable[]; onNueva: () => void; onCerrar: () => void }) {
  const [laborId, setLaborId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [trabajando, iniciar] = useTransition();
  const t = sinTildes(q.trim());
  const lista = labores.filter((l) => !t || sinTildes(`L-${l.numero} ${l.titulo} ${textoTipoLabor(l.tipo)}`).includes(t));

  function asignar() {
    if (!laborId) return;
    iniciar(async () => {
      const r = await asignarLaborARuta(laborId, ruta.id);
      if (r.ok) {
        toast.success("Labor asignada a los socios de la ruta");
        onCerrar();
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent showCloseButton={false} className="top-auto bottom-0 left-0 flex h-[90dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:h-[min(620px,90vh)] sm:w-[560px] sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0">
        <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
          <span aria-hidden className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: colorRuta(ruta.id) }}>
            <Route className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg leading-snug font-semibold">Asignar labor</DialogTitle>
            <p className={`mt-0.5 text-[13px] ${GRIS}`}>Se hará en cada socio de «{ruta.nombre}».</p>
          </div>
          <DialogClose aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
            <X className="size-[18px]" />
          </DialogClose>
        </div>

        <div className="px-6 py-3">
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8B89A0]" />
            <Input aria-label="Buscar labor" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar labor" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
          </div>
        </div>

        <ul role="radiogroup" aria-label="Labor" className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 pb-4">
          <li>
            <button type="button" onClick={onNueva} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[#C9BCFB] p-3 text-left hover:bg-[#FBFAFF]">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ECE8FD] text-[#3A0CE3]">
                <Plus className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[#2A07A8]">Nueva labor con esta ruta</span>
                <span className={`block text-xs ${GRIS}`}>Se crea aquí y aparece también en Labores</span>
              </span>
            </button>
          </li>
          <li className="px-1 pt-2 text-xs font-semibold tracking-wide text-[#8F8CA3] uppercase">O una labor que ya existe</li>
          {lista.map((l) => {
            const on = laborId === l.id;
            return (
              <li key={l.id}>
                <button type="button" role="radio" aria-checked={on} onClick={() => setLaborId(l.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${on ? "border-[#3A0CE3] bg-[#F7F5FF] ring-1 ring-[#3A0CE3]" : "border-[#ECEAF4] hover:bg-[#FBFAFE]"}`}>
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ECE8FD] text-[#3A0CE3]">
                    <IconoLabor tipo={l.tipo} className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14px] font-semibold ${on ? "text-[#2A07A8]" : ""}`}>{l.titulo}</span>
                    <span className={`block truncate text-xs ${GRIS}`}>
                      L-{l.numero} · {textoTipoLabor(l.tipo)} · {fechaCorta(l.fecha)}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${l.estado === "EN_CURSO" ? "bg-[#FFF3E5] text-[#8F4400]" : "bg-[#E2F2FC] text-[#0A5F91]"}`}>{TEXTO_ESTADO_LABOR[l.estado]}</span>
                </button>
              </li>
            );
          })}
          {lista.length === 0 ? <li className={`py-8 text-center text-sm ${GRIS}`}>{q.trim() ? "Ninguna labor coincide." : "No hay otras labores por asignar."}</li> : null}
        </ul>

        <div className="flex items-center justify-end gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
          <Button type="button" variant="outline" onClick={onCerrar} disabled={trabajando} className="h-11 rounded-xl border-[#E4E1F0] bg-white font-semibold">
            Cancelar
          </Button>
          <Button type="button" onClick={asignar} disabled={trabajando || !laborId} className="h-11 rounded-xl px-5 font-semibold">
            {trabajando ? <Loader2 className="animate-spin" /> : <Check className="size-4" />}
            Asignar ruta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
