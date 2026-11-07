"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Droplets, Loader2, MapPin, MessageSquarePlus, Search } from "lucide-react";
import { guardarArranque, type ResultadoArranques } from "@/app/panel/arranques/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AvatarSocio } from "@/components/panel/avatar-socio";
import type { ArranqueFila, SocioAsignable } from "@/lib/arranques-comun";
import { formatearRut } from "@/lib/formato";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Los socios se ordenan por su número de cliente (los que no tienen, al final). */
const porNumero = (a: SocioAsignable, b: SocioAsignable) => {
  const na = Number.parseInt(a.numero ?? "", 10);
  const nb = Number.parseInt(b.numero ?? "", 10);
  if (Number.isNaN(na) && Number.isNaN(nb)) return a.nombre.localeCompare(b.nombre, "es");
  if (Number.isNaN(na)) return 1;
  if (Number.isNaN(nb)) return -1;
  return na - nb;
};

type Filtro = "asignados" | "libres" | "todos";

/** Corregir un arranque: su nombre, dónde está, sus notas y qué socios abastece. El punto exacto se marca en el mapa del detalle. */
export function ArranqueDialog({
  arranque,
  arranques,
  socios,
  onCerrar,
}: {
  arranque: ArranqueFila;
  /** Todos los arranques, para decir en cuál está hoy cada socio. */
  arranques: ArranqueFila[];
  socios: SocioAsignable[];
  onCerrar: () => void;
}) {
  const [estado, enviar, pendiente] = useActionState<ResultadoArranques | null, FormData>(guardarArranque, null);
  const [nombre, setNombre] = useState(arranque.nombre);
  const [ubicacion, setUbicacion] = useState(arranque.ubicacion ?? "");
  const [notas, setNotas] = useState<string | null>(arranque.notas ?? null);
  const original = useMemo(() => arranque.socios.map((s) => s.id), [arranque]);
  const [sel, setSel] = useState<string[]>(original);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("asignados");

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Arranque actualizado");
      onCerrar();
    }
  }, [estado, onCerrar]);

  const nombreDe = useMemo(() => new Map(arranques.map((a) => [a.id, a.nombre])), [arranques]);

  const agregados = sel.filter((id) => !original.includes(id)).length;
  const quitados = original.filter((id) => !sel.includes(id)).length;
  const cambios =
    agregados +
    quitados +
    (nombre.trim() !== arranque.nombre ? 1 : 0) +
    (ubicacion.trim() !== (arranque.ubicacion ?? "") ? 1 : 0) +
    ((notas ?? "").trim() !== (arranque.notas ?? "") ? 1 : 0);

  const libres = socios.filter((s) => !s.arranqueId && !sel.includes(s.id)).length;

  const lista = useMemo(() => {
    const t = sinTildes(q.trim());
    return socios
      .filter((s) => (filtro === "todos" ? true : filtro === "asignados" ? sel.includes(s.id) || original.includes(s.id) : !s.arranqueId && !sel.includes(s.id)))
      .filter((s) => !t || sinTildes(`${s.numero ?? ""} ${s.nombre} ${s.rut ?? ""}`).includes(t))
      .sort(porNumero);
  }, [socios, filtro, q, sel, original]);

  const alternar = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const filtros = [
    ["asignados", "Asignados", sel.length],
    ["libres", "Sin arranque", libres],
    ["todos", "Todos", socios.length],
  ] as const;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="flex max-h-[92vh] max-w-[920px] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[920px]">
        {/* Encabezado fijo */}
        <div className="flex shrink-0 items-center gap-3 bg-gradient-to-br from-[#3A0CE3] to-[#6B46F5] px-6 py-5 pr-14 text-white">
          <span aria-hidden className="flex size-10 items-center justify-center rounded-xl bg-white/15">
            <Droplets className="size-5" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="truncate text-lg font-semibold">Editar {arranque.nombre}</DialogTitle>
            <DialogDescription className="text-[13px] text-white/80">Datos del arranque y los socios que abastece.</DialogDescription>
          </div>
        </div>

        <form id="form-arranque" action={enviar} className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[300px_minmax(0,1fr)] md:overflow-hidden">
          <input type="hidden" name="id" value={arranque.id} />
          <input type="hidden" name="nombre" value={nombre} />
          <input type="hidden" name="ubicacion" value={ubicacion} />
          <input type="hidden" name="notas" value={notas ?? ""} />
          <input type="hidden" name="socios" value={JSON.stringify(sel)} />

          {/* Datos */}
          <section aria-label="Datos del arranque" className="flex flex-col gap-4 border-b border-[#F0EEF6] p-6 md:overflow-y-auto md:border-r md:border-b-0">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Nombre
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={120} className="h-11 rounded-lg border-[#E4E1F0] shadow-none" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Dónde está <span className={cn("font-normal", GRIS)}>(opcional)</span>
              </span>
              <div className="relative">
                <MapPin className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8A8799]" aria-hidden />
                <Input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} maxLength={200} placeholder="Sector, camino o referencia" className="h-11 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
              </div>
              <span className={cn("text-xs font-normal", GRIS)}>El punto exacto se marca en el mapa del detalle.</span>
            </label>
            {notas === null ? (
              <button type="button" onClick={() => setNotas("")} className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-[#2A07A8] hover:underline">
                <MessageSquarePlus className="size-4" aria-hidden />
                Agregar nota
              </button>
            ) : (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span className="flex items-center justify-between">
                  Notas
                  <button type="button" onClick={() => setNotas(null)} className={cn("text-xs font-normal hover:underline", GRIS)}>
                    Quitar
                  </button>
                </span>
                <Textarea autoFocus value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej.: llave de paso detrás del galpón" className="min-h-[88px] rounded-lg border-[#E4E1F0] text-sm shadow-none" />
              </label>
            )}

            <div className="mt-auto hidden rounded-xl bg-[#F8F7FC] p-4 md:block">
              <p className={cn("text-xs", GRIS)}>Abastece a</p>
              <p className="mt-0.5 text-[26px] leading-none font-semibold tabular-nums">
                {sel.length} <span className={cn("text-sm font-medium", GRIS)}>socio{sel.length === 1 ? "" : "s"}</span>
              </p>
              {(agregados > 0 || quitados > 0) && (
                <p className="mt-2 flex gap-3 text-xs font-semibold">
                  {agregados > 0 && (
                    <span className="text-[#075A3C]">
                      +{agregados} nuevo{agregados === 1 ? "" : "s"}
                    </span>
                  )}
                  {quitados > 0 && (
                    <span className="text-[#A32020]">
                      −{quitados} quitado{quitados === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
              )}
            </div>
          </section>

          {/* Socios */}
          <section aria-label="Socios que abastece" className="flex min-h-0 flex-col">
            <div className="flex shrink-0 flex-col gap-3 border-b border-[#F0EEF6] bg-white px-6 pt-6 pb-3 max-md:sticky max-md:top-0 max-md:z-10">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8A8799]" aria-hidden />
                <Input aria-label="Buscar socio" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, N.° o RUT" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
              </div>
              <div role="tablist" aria-label="Mostrar" className="grid grid-cols-3 gap-1 rounded-lg bg-[#F4F3F9] p-1">
                {filtros.map(([k, t, n]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={filtro === k}
                    onClick={() => setFiltro(k)}
                    className={cn("h-8 truncate rounded-md px-1 text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", filtro === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}
                  >
                    {t} <span className={cn("text-xs font-medium tabular-nums", filtro === k ? "text-[#6B46F5]" : "text-[#A19FB2]")}>{n}</span>
                  </button>
                ))}
              </div>
            </div>

            <ul className="min-h-[240px] flex-1 px-3 py-2 md:overflow-y-auto">
              {lista.slice(0, 300).map((s) => {
                const marcado = sel.includes(s.id);
                const otro = s.arranqueId && s.arranqueId !== arranque.id ? nombreDe.get(s.arranqueId) : null;
                return (
                  <li key={s.id}>
                    <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors", marcado ? "bg-[#F5F3FE]" : "hover:bg-[#F8F7FC]")}>
                      <AvatarSocio id={s.id} nombre={s.nombre} className="size-9 text-[11px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.nombre}</span>
                        <span className={cn("block text-xs", GRIS)}>
                          {!marcado && original.includes(s.id) && <span className="font-semibold text-[#A32020]">Se quitará · </span>}
                          {s.numero ? `N.° ${s.numero}` : "Sin número"}
                          {s.rut ? ` · ${formatearRut(s.rut)}` : ""}
                          {otro && marcado ? <span className="text-[#B86400]"> · hoy en {otro}: se moverá aquí</span> : otro ? <span className="text-[#B86400]"> · hoy en {otro}</span> : null}
                        </span>
                      </span>
                      <input type="checkbox" checked={marcado} onChange={() => alternar(s.id)} className="peer sr-only" />
                      <span aria-hidden className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#B9A9F8] peer-focus-visible:ring-offset-1", marcado ? "border-primary bg-primary text-white" : "border-[#D6D3E3] bg-white")}>
                        {marcado ? <Check className="size-4" strokeWidth={3} /> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
              {lista.length > 300 && <li className={cn("px-3 py-3 text-center text-xs", GRIS)}>Se muestran los primeros 300. Escribe en el buscador para acotar.</li>}
              {lista.length === 0 && (
                <li className={cn("px-3 py-12 text-center text-sm", GRIS)}>
                  {q ? "Ningún socio coincide con la búsqueda." : filtro === "asignados" ? "Este arranque todavía no abastece a nadie." : filtro === "libres" ? "No hay socios sin arranque." : "Aún no hay socios cargados."}
                </li>
              )}
            </ul>
          </section>
        </form>

        {estado && !estado.ok && (
          <p className="shrink-0 border-t border-[#F0EEF6] bg-[#FFF7F7] px-6 py-2 text-[13px] text-destructive" role="alert">
            {estado.error}
          </p>
        )}

        {/* Pie fijo */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-4">
          <span className={cn("hidden text-sm sm:block", GRIS)}>
            {cambios ? (
              <>
                <strong className="font-semibold text-[#15132B]">{cambios}</strong> cambio{cambios === 1 ? "" : "s"} sin guardar
              </>
            ) : (
              "Sin cambios"
            )}
          </span>
          <div className="flex flex-1 justify-end gap-2 sm:flex-none">
            <Button type="button" variant="ghost" onClick={onCerrar} className="h-10 rounded-lg px-4 font-semibold">
              Cancelar
            </Button>
            <Button type="submit" form="form-arranque" disabled={!cambios || !nombre.trim() || pendiente} className="h-10 rounded-lg px-5 font-semibold">
              {pendiente && <Loader2 className="animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
