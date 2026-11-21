"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Camera, Check, Hammer, Loader2, Scissors, X, Zap, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { ordenarCorte, solicitarOrden } from "@/app/panel/ordenes/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SocioBuscador, type OpcionSocio } from "@/components/panel/socio-buscador";
import { iniciales } from "@/lib/formato";
import { TIPOS_ORDEN, type TipoCampo } from "@/lib/ordenes";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

const TIPO: Record<TipoCampo, { icono: LucideIcon; tono: string; desc: string; ejemplo: string }> = {
  CORTE: { icono: Scissors, tono: "bg-[#FDEFEF] text-[#B42318]", desc: "Suspender el servicio por deuda", ejemplo: "Ej.: tres boletas impagas" },
  REPOSICION: { icono: Zap, tono: "bg-[#E6F6EF] text-[#0A7A52]", desc: "Reponer el servicio a quien pagó", ejemplo: "Ej.: pagó la deuda el lunes" },
  REPARACION: { icono: Hammer, tono: "bg-[#FFF0EA] text-[#B4441A]", desc: "Fuga, arranque o medidor", ejemplo: "Ej.: fuga en el empalme" },
};

/**
 * Crear una orden: elegir el arranque, el tipo y, si hace falta, una nota para quien va a terreno. La directiva puede
 * pedir los tres tipos; el operador solo reposiciones y reparaciones, y esas quedan pendientes de que la directiva las apruebe.
 * Con `socioFijo` el socio ya viene elegido (por ejemplo, desde la lista de morosos).
 */
export function NuevaOrdenDialog({
  socios,
  tipos,
  titulo,
  descripcion,
  socioFijo,
  detalleBase,
  onCerrar,
}: {
  socios: OpcionSocio[];
  tipos: TipoCampo[];
  titulo: string;
  descripcion: string;
  /** El socio ya elegido: no se muestra el buscador. */
  socioFijo?: { id: string; nombre: string; direccion: string | null; deuda: number | null };
  /** Un texto que va siempre en el detalle de la orden (por ejemplo, la deuda y los días de atraso). */
  detalleBase?: string;
  onCerrar: () => void;
}) {
  const [socioId, setSocioId] = useState<string | null>(socioFijo?.id ?? null);
  const [tipo, setTipo] = useState<TipoCampo>(tipos[0]);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const T = TIPO[tipo];
  const TipoIcono = T.icono;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[92dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[90vh] sm:w-[560px] sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0"
      >
        <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
          <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", T.tono)}>
            <TipoIcono className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold">{titulo}</DialogTitle>
            <DialogDescription className={cn("mt-0.5 text-[13px]", GRIS)}>{descripcion}</DialogDescription>
          </div>
          <DialogClose aria-label="Cerrar" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
            <X className="size-[18px]" />
          </DialogClose>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {tipos.length > 1 ? (
            <div role="radiogroup" aria-label="Tipo de orden" className={cn("grid gap-2", tipos.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
              {tipos.map((k) => {
                const t = TIPO[k];
                const I = t.icono;
                const on = tipo === k;
                return (
                  <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setTipo(k)} className={cn("rounded-xl border p-3 text-left", on ? "border-[#3A0CE3] bg-[#F7F5FF] ring-1 ring-[#3A0CE3]" : "border-[#E9E6F2] hover:bg-[#FBFAFE]")}>
                    <span aria-hidden className={cn("flex size-8 items-center justify-center rounded-lg", t.tono)}>
                      <I className="size-4" />
                    </span>
                    <span className={cn("mt-2 block text-[14px] font-semibold", on && "text-[#2A07A8]")}>{TIPOS_ORDEN[k].texto}</span>
                    <span className={cn("block text-xs", GRIS)}>{t.desc}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Socio</p>
            {socioFijo ? (
              <div className="flex items-center gap-3 rounded-xl bg-[#F7F6FB] px-3.5 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#ECE8FD] text-xs font-bold text-[#2A07A8]">{iniciales(socioFijo.nombre)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{socioFijo.nombre}</span>
                  <span className={cn("block truncate text-xs", GRIS)}>{socioFijo.direccion ?? "Sin dirección"}</span>
                </span>
                {socioFijo.deuda ? <span className="text-[14px] font-semibold text-[#B42318] tabular-nums">{clp.format(socioFijo.deuda)}</span> : null}
              </div>
            ) : (
              <SocioBuscador socios={socios} label="" onElegir={(s) => setSocioId(s?.id ?? null)} />
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold">
              Nota para el operador <span className={cn("font-normal", GRIS)}>· opcional</span>
            </span>
            <Input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={250} placeholder={T.ejemplo} className="h-11 rounded-xl border-[#E4E1F0] shadow-none" />
          </label>

          <p className={cn("flex items-center gap-2 text-xs", GRIS)}>
            <Camera className="size-3.5 shrink-0" aria-hidden />
            El operador debe dejar una foto al terminar.
          </p>

          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-[#FDF3F3] px-3 py-2 text-[13px] text-[#A32020]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
          <Button type="button" variant="ghost" onClick={onCerrar} className="h-11 rounded-xl font-semibold text-[#46435C]">
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!socioId || pendiente}
            onClick={() =>
              iniciar(async () => {
                if (!socioId) return;
                setError(null);
                const detalle = [detalleBase, nota.trim()].filter(Boolean).join(" ").slice(0, 300);
                const r = tipo === "CORTE" ? await ordenarCorte(socioId, detalle) : await solicitarOrden(socioId, tipo, detalle);
                if (r.ok) {
                  toast.success("Orden creada");
                  onCerrar();
                } else {
                  setError(r.error);
                  toast.error(r.error);
                }
              })
            }
            className="h-11 rounded-xl px-5 font-semibold"
          >
            {pendiente ? <Loader2 className="animate-spin" /> : <Check className="size-4" />}
            Crear orden
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
