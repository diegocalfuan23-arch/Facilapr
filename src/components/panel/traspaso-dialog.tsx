"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Banknote, Landmark, Loader2, X } from "lucide-react";
import { crearTraspaso, type ResultadoFinanzas } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CampoComprobante } from "@/components/panel/comprobante";
import { TIPO_DEPOSITO, TIPO_GIRO, hoyEnChile, type Bolsillos } from "@/lib/finanzas-comun";

const GRIS = "text-[#5B5970]";
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

const TIPOS = {
  [TIPO_DEPOSITO]: { nombre: "Depósito", desc: "Llevar efectivo al banco", de: "Efectivo", a: "Banco", icono: ArrowDownToLine, tono: "bg-[#E6F6EF] text-[#0A7A52]" },
  [TIPO_GIRO]: { nombre: "Giro", desc: "Sacar del banco a efectivo", de: "Banco", a: "Efectivo", icono: ArrowUpFromLine, tono: "bg-[#FFF3E0] text-[#B86400]" },
} as const;

/** Sacar plata del banco a efectivo (giro) o llevar efectivo al banco (depósito). La plata solo cambia de lugar. */
export function TraspasoDialog({
  fecha,
  bolsillos,
  tipoInicial = TIPO_GIRO,
  onCerrar,
}: {
  fecha?: string;
  bolsillos: Bolsillos | null;
  tipoInicial?: typeof TIPO_GIRO | typeof TIPO_DEPOSITO;
  onCerrar: () => void;
}) {
  const [estado, enviar, pendiente] = useActionState<ResultadoFinanzas | null, FormData>(crearTraspaso, null);
  const [tipo, setTipo] = useState<typeof TIPO_GIRO | typeof TIPO_DEPOSITO>(tipoInicial);
  const [monto, setMonto] = useState("");
  const [hoy] = useState(() => hoyEnChile());
  const [dia, setDia] = useState(fecha ?? hoy);
  const t = TIPOS[tipo];

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast.success(tipo === TIPO_GIRO ? "Giro anotado" : "Depósito anotado");
      onCerrar();
    }
  }, [estado, tipo, onCerrar]);

  const cantidad = Number(monto) || 0;
  const efectivo = bolsillos?.efectivo ?? 0;
  const banco = bolsillos?.banco ?? 0;
  const origen = bolsillos ? (tipo === TIPO_GIRO ? banco : efectivo) : null;
  const excede = origen !== null && cantidad > origen;
  const nuevoEfectivo = tipo === TIPO_GIRO ? efectivo + cantidad : efectivo - cantidad;
  const nuevoBanco = tipo === TIPO_GIRO ? banco - cantidad : banco + cantidad;
  const rapidos = (tipo === TIPO_DEPOSITO ? [500_000, 1_000_000] : [100_000, 300_000, 500_000]).filter((v) => origen === null || v <= origen);
  const dejarEnCaja = tipo === TIPO_DEPOSITO && efectivo - 500_000 > 0 ? efectivo - 500_000 : null;
  const valido = cantidad > 0 && !excede && dia <= hoy && Boolean(dia);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[94dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[92vh] sm:w-[560px] sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0"
      >
        <form action={enviar} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="monto" value={monto} />
          <input type="hidden" name="fecha" value={dia} />

          <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold">Registrar {t.nombre.toLowerCase()}</DialogTitle>
              <p className={`mt-0.5 text-[13px] ${GRIS}`}>Mueve plata entre la caja y la cuenta. No es un ingreso ni un gasto.</p>
            </div>
            <DialogClose aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
              <X className="size-[18px]" />
            </DialogClose>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qué se hizo">
              {([TIPO_DEPOSITO, TIPO_GIRO] as const).map((k) => {
                const x = TIPOS[k];
                const I = x.icono;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={tipo === k}
                    onClick={() => setTipo(k)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left ${tipo === k ? "border-[#3A0CE3] bg-[#F4F1FF] ring-1 ring-[#3A0CE3]" : "border-[#E4E1F0] hover:bg-[#F8F7FC]"}`}
                  >
                    <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${x.tono}`}>
                      <I className="size-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${tipo === k ? "text-[#2A07A8]" : ""}`}>{x.nombre}</span>
                      <span className={`block text-xs ${GRIS}`}>{x.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <span className="text-[13px] font-semibold">Monto</span>
              <Input
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                aria-label="Monto"
                value={monto === "" ? "" : clp(cantidad)}
                onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10))}
                placeholder="$0"
                className={`mt-1.5 h-14 rounded-xl border-[#E4E1F0] text-right text-2xl font-semibold tabular-nums shadow-none ${excede ? "border-[#E5484D]" : ""}`}
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {rapidos.map((v) => (
                  <button key={v} type="button" onClick={() => setMonto(String(v))} className="rounded-full border border-[#E4E1F0] px-2.5 py-1 text-xs font-medium text-[#46435C] hover:bg-[#F8F7FC]">
                    {clp(v)}
                  </button>
                ))}
                {dejarEnCaja ? (
                  <button type="button" onClick={() => setMonto(String(dejarEnCaja))} className="rounded-full border border-[#E4E1F0] px-2.5 py-1 text-xs font-medium text-[#46435C] hover:bg-[#F8F7FC]">
                    Dejar $500.000 en caja
                  </button>
                ) : null}
                {origen !== null ? (
                  <span className={`ml-auto text-xs ${excede ? "font-medium text-[#A32020]" : GRIS}`}>
                    {excede ? `Solo hay ${clp(origen)} en ${t.de.toLowerCase()}` : `Disponible en ${t.de.toLowerCase()}: ${clp(origen)}`}
                  </span>
                ) : null}
              </div>
            </div>

            {bolsillos ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-[#F8F7FC] p-3">
                {[
                  { l: "Efectivo", antes: efectivo, despues: nuevoEfectivo, I: Banknote },
                  { l: "Banco", antes: banco, despues: nuevoBanco, I: Landmark },
                ].flatMap((x, i) => {
                  const cambia = cantidad > 0 && !excede;
                  const celda = (
                    <div key={x.l} className="min-w-0 text-center">
                      <p className={`flex items-center justify-center gap-1.5 text-xs ${GRIS}`}>
                        <x.I className="size-3.5" aria-hidden />
                        {x.l}
                      </p>
                      <p className={`mt-1 text-xs tabular-nums line-through decoration-[#A19FB2] ${GRIS}`}>{cambia ? clp(x.antes) : ""}</p>
                      <p className={`text-[17px] font-semibold tabular-nums ${cambia ? (x.despues > x.antes ? "text-[#075A3C]" : "text-[#A32020]") : ""}`}>{clp(cambia ? x.despues : x.antes)}</p>
                    </div>
                  );
                  return i === 0
                    ? [
                        celda,
                        <span key="flecha" aria-hidden className="flex size-8 items-center justify-center rounded-full bg-white text-[#6B46F5] shadow-sm">
                          <ArrowLeftRight className="size-4" />
                        </span>,
                      ]
                    : [celda];
                })}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[13px] font-semibold">Fecha</span>
                <Input type="date" max={hoy} value={dia} onChange={(e) => setDia(e.target.value)} className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] shadow-none" required />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold">N° de operación</span>
                <Input name="referencia" autoComplete="off" maxLength={80} placeholder="Del comprobante" className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] shadow-none" />
              </label>
            </div>
            <label className="block">
              <span className="text-[13px] font-semibold">
                Para qué <span className={`font-normal ${GRIS}`}>(opcional)</span>
              </span>
              <Input
                name="nota"
                autoComplete="off"
                maxLength={120}
                placeholder={tipo === TIPO_GIRO ? "Ej.: pago en efectivo a proveedor" : "Ej.: recaudación de boletas del mes"}
                className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] shadow-none"
              />
            </label>

            <CampoComprobante />

            {estado && !estado.ok ? (
              <p className="text-[0.85rem] text-destructive" role="alert">
                {estado.error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
            <p className={`min-w-0 flex-1 truncate text-xs ${GRIS}`}>
              {t.de} → {t.a}
            </p>
            <DialogClose render={<Button type="button" variant="outline" className="h-11 rounded-xl border-[#E4E1F0] bg-white font-semibold" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendiente || !valido} className="h-11 rounded-xl px-5 font-semibold">
              {pendiente ? <Loader2 className="animate-spin" /> : null}
              Registrar {cantidad ? clp(cantidad) : ""}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
