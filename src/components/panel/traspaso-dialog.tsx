"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { crearTraspaso, type ResultadoFinanzas } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TIPO_DEPOSITO, TIPO_GIRO, hoyEnChile, type Bolsillos } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

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

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast.success(tipo === TIPO_GIRO ? "Giro anotado" : "Depósito anotado");
      onCerrar();
    }
  }, [estado, tipo, onCerrar]);

  const opciones = [
    { valor: TIPO_GIRO, titulo: "Giro", ayuda: "Del banco a efectivo" },
    { valor: TIPO_DEPOSITO, titulo: "Depósito", ayuda: "De efectivo al banco" },
  ] as const;
  const origen = bolsillos ? (tipo === TIPO_GIRO ? bolsillos.banco : bolsillos.efectivo) : null;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Giro o depósito</DialogTitle>
          <DialogDescription>Mover plata entre el banco y la caja en efectivo. No es un ingreso ni un egreso: el total no cambia.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="flex flex-col gap-4">
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="monto" value={monto} />

          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qué se hizo">
            {opciones.map((o) => (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={tipo === o.valor}
                onClick={() => setTipo(o.valor)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
                  tipo === o.valor ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"
                )}
              >
                <span className="text-[0.95rem] font-medium">{o.titulo}</span>
                <span className="flex items-center gap-1 text-[0.8rem] text-muted-foreground">
                  {o.ayuda.split(" a ")[0]} <ArrowRight className="size-3" /> {o.ayuda.split(" a ")[1]}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tr-fecha">Fecha</Label>
              <Input id="tr-fecha" name="fecha" type="date" defaultValue={fecha ?? hoyEnChile()} max={hoyEnChile()} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tr-monto">Monto</Label>
              <Input
                id="tr-monto"
                value={monto === "" ? "" : `$${Number(monto).toLocaleString("es-CL")}`}
                onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10))}
                inputMode="numeric"
                placeholder="$0"
                autoComplete="off"
                required
              />
            </div>
          </div>
          {origen !== null && (
            <p className="-mt-2 text-[0.8rem] text-muted-foreground">
              {tipo === TIPO_GIRO ? "En el banco" : "En efectivo"} hay {clp.format(origen)} al cierre de este período.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="tr-ref">N.º de operación o de cheque (opcional)</Label>
            <Input id="tr-ref" name="referencia" maxLength={80} placeholder="Ej.: cheque 000123" />
          </div>

          {estado && !estado.ok && (
            <p className="text-[0.85rem] text-destructive" role="alert">
              {estado.error}
            </p>
          )}

          <Button type="submit" disabled={pendiente || !monto}>
            {pendiente && <Loader2 className="animate-spin" />}
            {tipo === TIPO_GIRO ? "Anotar giro" : "Anotar depósito"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
