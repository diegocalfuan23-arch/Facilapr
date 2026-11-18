"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardPlus, Link2, Loader2, X } from "lucide-react";
import { asignarLaborARuta, quitarLaborDeRuta } from "@/app/panel/lecturas/rutas-actions";
import { RutasPanel } from "@/components/panel/rutas-panel";
import { LaborDialog } from "@/components/panel/labor-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Insumo } from "@/lib/inventario-comun";
import { TEXTO_ESTADO_LABOR, type EstadoLabor, type RutaOpcion } from "@/lib/labores-comun";
import type { ArranqueRuta, LaborEnRuta, RutaVista } from "@/lib/rutas-comun";

const GRIS = "text-[#5B5970]";

type LaborAsignable = { id: string; numero: number; titulo: string; estado: EstadoLabor };

/** La página Rutas: las rutas y, en cada una, las labores que se hacen en sus paradas (asignar una que existe o crear una nueva). */
export function RutasPagina({
  socios,
  rutas,
  arranques,
  laboresPorRuta,
  laboresAsignables,
  insumos,
  conLabores,
}: {
  socios: { id: string; nombre: string; numeroCliente?: string | null; lat?: number | null; lng?: number | null }[];
  rutas: RutaVista[];
  arranques: ArranqueRuta[];
  laboresPorRuta: Record<string, LaborEnRuta[]>;
  laboresAsignables: LaborAsignable[];
  insumos: Insumo[];
  /** El plan incluye Labores (desde Estándar). */
  conLabores: boolean;
}) {
  const [asignando, setAsignando] = useState<string | null>(null);
  const [nuevaEn, setNuevaEn] = useState<string | null>(null);
  const [trabajando, iniciar] = useTransition();
  const opciones: RutaOpcion[] = rutas.filter((r) => r.aprobada).map((r) => ({ id: r.id, nombre: r.nombre }));

  function quitar(laborId: string, rutaId: string) {
    iniciar(async () => {
      const r = await quitarLaborDeRuta(laborId, rutaId);
      if (r.ok) toast.success("Labor quitada de la ruta");
      else toast.error(r.error);
    });
  }

  const extra = (r: RutaVista) => {
    if (!conLabores || !r.aprobada) return null;
    const labores = laboresPorRuta[r.id] ?? [];
    return (
      <div className="mt-3 border-t border-[#F0EEF6] pt-3">
        <p className={`text-xs font-semibold tracking-wide uppercase ${GRIS}`}>Labores en los socios de esta ruta</p>
        {labores.length === 0 ? (
          <p className={`mt-1.5 text-sm ${GRIS}`}>Ninguna todavía.</p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {labores.map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-lg bg-[#F8F7FC] px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  L-{l.numero} · {l.titulo}
                </span>
                <span className={`shrink-0 text-xs tabular-nums ${GRIS}`}>
                  {TEXTO_ESTADO_LABOR[l.estado]} · {l.hechas}/{l.paradas}
                </span>
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${l.titulo} de la ruta`} disabled={trabajando} onClick={() => quitar(l.id, r.id)} className="size-8 shrink-0 text-[#A32020]">
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => setAsignando(r.id)} className="h-9 rounded-lg">
            <Link2 className="size-4" />
            Asignar labor
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setNuevaEn(r.id)} className="h-9 rounded-lg">
            <ClipboardPlus className="size-4" />
            Nueva labor
          </Button>
        </div>
      </div>
    );
  };

  const rutaAsignando = rutas.find((r) => r.id === asignando) ?? null;

  return (
    <>
      <RutasPanel enPagina socios={socios} rutas={rutas} arranques={arranques} esAdmin extra={extra} />
      {rutaAsignando && <AsignarLabor ruta={rutaAsignando} labores={laboresAsignables.filter((l) => l.estado !== "HECHA" && !(laboresPorRuta[rutaAsignando.id] ?? []).some((x) => x.id === l.id))} onCerrar={() => setAsignando(null)} />}
      {nuevaEn && <LaborDialog key={nuevaEn} labor={null} insumos={insumos} rutas={opciones} rutaInicial={nuevaEn} onCerrar={() => setNuevaEn(null)} />}
    </>
  );
}

function AsignarLabor({ ruta, labores, onCerrar }: { ruta: RutaVista; labores: LaborAsignable[]; onCerrar: () => void }) {
  const [laborId, setLaborId] = useState("");
  const [trabajando, iniciar] = useTransition();

  function asignar() {
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
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-[460px] sm:p-0">
        <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold">Asignar una labor</DialogTitle>
            <p className={`mt-0.5 text-[13px] ${GRIS}`}>Se hará en cada socio de «{ruta.nombre}».</p>
          </div>
          <DialogClose aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
            <X className="size-[18px]" />
          </DialogClose>
        </div>
        <div className="px-6 py-5">
          {labores.length === 0 ? (
            <p className={`rounded-xl bg-[#F8F7FC] px-4 py-6 text-center text-sm ${GRIS}`}>No hay labores por asignar. Crea una con «Nueva labor».</p>
          ) : (
            <select
              aria-label="Labor"
              value={laborId}
              onChange={(e) => setLaborId(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#E4E1F0] bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Elige una labor…</option>
              {labores.map((l) => (
                <option key={l.id} value={l.id}>
                  L-{l.numero} · {l.titulo} · {TEXTO_ESTADO_LABOR[l.estado]}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
          <Button type="button" variant="outline" onClick={onCerrar} disabled={trabajando} className="h-11 rounded-xl border-[#E4E1F0] bg-white font-semibold">
            Cancelar
          </Button>
          <Button type="button" onClick={asignar} disabled={trabajando || !laborId} className="h-11 rounded-xl px-5 font-semibold">
            {trabajando ? <Loader2 className="animate-spin" /> : null}
            Asignar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
