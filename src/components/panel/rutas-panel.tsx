"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Clock3, Loader2, Pencil, Plus, Route, Search, Trash2, X } from "lucide-react";
import { aprobarRuta, eliminarRuta, guardarRuta } from "@/app/panel/lecturas/rutas-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RutaVista } from "@/lib/rutas";

const GRIS = "text-[#5B5970]";

type SocioRuta = { id: string; nombre: string; numeroCliente?: string | null };

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---- La ruta que eligió este teléfono: se recuerda aunque se cierre la app y sirve sin señal.
const CLAVE_RUTA = "facilapr.terreno.ruta";
const EVENTO_RUTA = "facilapr-ruta-elegida";

function leerRutaElegida(): string {
  try {
    return localStorage.getItem(CLAVE_RUTA) ?? "";
  } catch {
    return "";
  }
}

export function guardarRutaElegida(id: string) {
  try {
    if (id) localStorage.setItem(CLAVE_RUTA, id);
    else localStorage.removeItem(CLAVE_RUTA);
  } catch {
    /* sin almacenamiento: la elección vale mientras la pantalla siga abierta */
  }
  window.dispatchEvent(new Event(EVENTO_RUTA));
}

/** La ruta elegida en este teléfono ("" si ninguna). Se lee en el navegador sin desajustes con el servidor. */
export function useRutaElegida(): string {
  return useSyncExternalStore(
    (aviso) => {
      window.addEventListener("storage", aviso);
      window.addEventListener(EVENTO_RUTA, aviso);
      return () => {
        window.removeEventListener("storage", aviso);
        window.removeEventListener(EVENTO_RUTA, aviso);
      };
    },
    leerRutaElegida,
    () => ""
  );
}

/** Crear, ordenar y autorizar las rutas de terreno. */
export function RutasPanel({ socios, rutas, esAdmin, elegida, onElegir, onCerrar }: { socios: SocioRuta[]; rutas: RutaVista[]; esAdmin: boolean; elegida: string; onElegir: (id: string) => void; onCerrar: () => void }) {
  const [editando, setEditando] = useState<{ id: string | null; nombre: string; ids: string[] } | null>(null);
  const [trabajando, iniciar] = useTransition();
  const porId = useMemo(() => new Map(socios.map((s) => [s.id, s])), [socios]);

  function aprobar(r: RutaVista) {
    iniciar(async () => {
      const res = await aprobarRuta(r.id);
      if (res.ok) toast.success("Ruta aprobada");
      else toast.error(res.error);
    });
  }

  function borrar(r: RutaVista) {
    if (!window.confirm(`¿Borrar la ruta «${r.nombre}»?`)) return;
    iniciar(async () => {
      const res = await eliminarRuta(r.id);
      if (res.ok) {
        if (elegida === r.id) onElegir("");
        toast.success("Ruta borrada");
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[94dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[90vh] sm:w-[560px] sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0"
      >
        <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold">{editando ? (editando.id ? "Editar ruta" : "Nueva ruta") : "Rutas de terreno"}</DialogTitle>
            <p className={`mt-0.5 text-[13px] ${GRIS}`}>{editando ? "Los socios en el orden en que se visitan." : esAdmin ? "Las que propone un operador esperan tu aprobación." : "Una ruta nueva la aprueba el administrador."}</p>
          </div>
          <DialogClose aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
            <X className="size-[18px]" />
          </DialogClose>
        </div>

        {editando ? (
          <Editor
            socios={socios}
            porId={porId}
            inicial={editando}
            esAdmin={esAdmin}
            onVolver={() => setEditando(null)}
          />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {rutas.length === 0 ? (
                <p className={`rounded-xl bg-[#F8F7FC] px-4 py-8 text-center text-sm ${GRIS}`}>Aún no hay rutas. Sin ruta, se recorren todos los socios por orden alfabético.</p>
              ) : (
                <ul className="space-y-2">
                  {rutas.map((r) => {
                    const puedeTocar = esAdmin || (r.propia && !r.aprobada);
                    return (
                      <li key={r.id} className={`rounded-xl border p-3 ${elegida === r.id ? "border-[#3A0CE3] bg-[#F4F1FF]" : "border-[#E4E1F0]"}`}>
                        <div className="flex items-center gap-2">
                          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F4F3F9] text-[#2A07A8]">
                            <Route className="size-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{r.nombre}</p>
                            <p className={`flex items-center gap-1.5 text-xs ${GRIS}`}>
                              {r.socioIds.length} {r.socioIds.length === 1 ? "socio" : "socios"}
                              {!r.aprobada ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF3E5] px-1.5 py-px text-[11px] font-semibold text-[#8F4400]">
                                  <Clock3 className="size-3" aria-hidden />
                                  Por aprobar
                                </span>
                              ) : null}
                            </p>
                          </div>
                          {r.aprobada || r.propia ? (
                            <Button type="button" size="sm" variant={elegida === r.id ? "default" : "outline"} onClick={() => onElegir(elegida === r.id ? "" : r.id)} className="h-9 rounded-lg">
                              {elegida === r.id ? "En uso" : "Usar"}
                            </Button>
                          ) : null}
                        </div>
                        {puedeTocar || (esAdmin && !r.aprobada) ? (
                          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                            {esAdmin && !r.aprobada ? (
                              <Button type="button" size="sm" disabled={trabajando} onClick={() => aprobar(r)} className="h-9 rounded-lg">
                                <Check className="size-4" />
                                Aprobar
                              </Button>
                            ) : null}
                            {puedeTocar ? (
                              <>
                                <Button type="button" size="sm" variant="outline" disabled={trabajando} onClick={() => setEditando({ id: r.id, nombre: r.nombre, ids: r.socioIds })} className="h-9 rounded-lg">
                                  <Pencil className="size-4" />
                                  Editar
                                </Button>
                                <Button type="button" size="sm" variant="outline" disabled={trabajando} onClick={() => borrar(r)} aria-label="Borrar ruta" className="h-9 rounded-lg text-[#A32020]">
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
              <Button type="button" onClick={() => setEditando({ id: null, nombre: "", ids: [] })} className="h-11 rounded-xl px-5 font-semibold">
                <Plus className="size-4" />
                Nueva ruta
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Editor({ socios, porId, inicial, esAdmin, onVolver }: { socios: SocioRuta[]; porId: Map<string, SocioRuta>; inicial: { id: string | null; nombre: string; ids: string[] }; esAdmin: boolean; onVolver: () => void }) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [ids, setIds] = useState(() => inicial.ids.filter((id) => porId.has(id)));
  const [busca, setBusca] = useState("");
  const [guardando, iniciar] = useTransition();

  const enRuta = useMemo(() => new Set(ids), [ids]);
  const t = sinTildes(busca.trim());
  const disponibles = socios.filter((s) => !enRuta.has(s.id) && (!t || sinTildes(`${s.nombre} ${s.numeroCliente ?? ""}`).includes(t)));

  function mover(i: number, d: -1 | 1) {
    setIds((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  function guardar() {
    iniciar(async () => {
      const r = await guardarRuta(inicial.id, nombre, ids);
      if (r.ok) {
        toast.success(inicial.id ? "Ruta guardada" : esAdmin ? "Ruta creada" : "Ruta propuesta: queda por aprobar");
        onVolver();
      } else toast.error(r.error);
    });
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <label className="block">
          <span className="text-[13px] font-semibold">Nombre</span>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" maxLength={60} placeholder="Ej.: Sector alto" className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] shadow-none" />
        </label>

        <div>
          <p className="text-[13px] font-semibold">En la ruta ({ids.length})</p>
          {ids.length === 0 ? (
            <p className={`mt-1.5 rounded-xl bg-[#F8F7FC] px-4 py-5 text-center text-sm ${GRIS}`}>Agrega socios de la lista de abajo.</p>
          ) : (
            <ol className="mt-1.5 max-h-60 divide-y divide-[#F0EEF6] overflow-y-auto rounded-xl border border-[#E4E1F0]">
              {ids.map((id, i) => (
                <li key={id} className="flex items-center gap-1 px-3 py-1.5">
                  <span className={`w-7 shrink-0 text-xs tabular-nums ${GRIS}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{porId.get(id)?.nombre}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="size-9">
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Bajar" disabled={i === ids.length - 1} onClick={() => mover(i, 1)} className="size-9">
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Quitar de la ruta" onClick={() => setIds((l) => l.filter((x) => x !== id))} className="size-9 text-[#A32020]">
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">Agregar socios</p>
            {disponibles.length > 0 ? (
              <button type="button" onClick={() => setIds((l) => [...l, ...disponibles.map((s) => s.id)])} className="text-xs font-semibold text-[#2A07A8] hover:underline">
                Agregar {t ? "los que se ven" : "todos"} ({disponibles.length})
              </button>
            ) : null}
          </div>
          <div className="relative mt-1.5">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8B89A0]" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" placeholder="Buscar por nombre o N° de cliente" className="h-11 rounded-xl border-[#E4E1F0] pl-9 shadow-none" />
          </div>
          <ul className="mt-2 max-h-52 divide-y divide-[#F0EEF6] overflow-y-auto rounded-xl border border-[#E4E1F0]">
            {disponibles.length === 0 ? (
              <li className={`px-3 py-5 text-center text-sm ${GRIS}`}>{busca.trim() ? "Ningún socio coincide." : "Todos los socios ya están en la ruta."}</li>
            ) : (
              disponibles.slice(0, 100).map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setIds((l) => [...l, s.id])} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[#F8F7FC]">
                    <Plus aria-hidden className="size-4 shrink-0 text-[#2A07A8]" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.nombre}</span>
                    {s.numeroCliente ? <span className={`text-xs tabular-nums ${GRIS}`}>N° {s.numeroCliente}</span> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
        <p className={`min-w-0 flex-1 truncate text-xs ${GRIS}`}>{esAdmin ? "Queda lista para usar" : "La aprueba el administrador"}</p>
        <Button type="button" variant="outline" onClick={onVolver} disabled={guardando} className="h-11 rounded-xl border-[#E4E1F0] bg-white font-semibold">
          Volver
        </Button>
        <Button type="button" onClick={guardar} disabled={guardando || !nombre.trim() || ids.length === 0} className="h-11 rounded-xl px-5 font-semibold">
          {guardando ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
      </div>
    </>
  );
}
