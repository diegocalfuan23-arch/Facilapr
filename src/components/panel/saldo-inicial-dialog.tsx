"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { guardarSaldoInicial, type ResultadoFinanzas } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Solo los dígitos, sin ceros a la izquierda y hasta 10 cifras. */
const soloDigitos = (v: string) => v.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10);
const dinero = (v: string) => (v === "" ? "" : `$${Number(v).toLocaleString("es-CL")}`);

/**
 * Con cuánta plata parte el comité en Facilapr, dicho por separado: cuánta en efectivo y cuánta en el banco. Sin este
 * dato solo se ve lo que entró y salió cada mes; con él se puede decir cuánto hay en cada lugar.
 */
export function SaldoInicialDialog({
  actual,
  onCerrar,
}: {
  actual: { monto: number; fecha: string; banco: number } | null;
  onCerrar: () => void;
}) {
  const [estado, enviar, pendiente] = useActionState<ResultadoFinanzas | null, FormData>(guardarSaldoInicial, null);
  // Solo los dígitos; el formato de dinero se arma al mostrarlo. El total sale de sumar los dos lugares.
  const [efectivo, setEfectivo] = useState(actual ? String(Math.max(0, actual.monto - actual.banco)) : "");
  const [banco, setBanco] = useState(actual && actual.banco > 0 ? String(actual.banco) : "");
  const total = (Number(efectivo) || 0) + (Number(banco) || 0);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast.success("Saldo inicial guardado");
      onCerrar();
    } else {
      toast.error(estado.error);
    }
  }, [estado, onCerrar]);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Saldo inicial</DialogTitle>
          <DialogDescription>Con cuánta plata partes, dicha por separado: cuánta en efectivo y cuánta en el banco.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="saldo-fecha">Desde el día</Label>
            <Input id="saldo-fecha" name="fecha" type="date" defaultValue={actual?.fecha ?? ""} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="saldo-efectivo">En efectivo (la plata que hay en la caja)</Label>
            <Input id="saldo-efectivo" value={dinero(efectivo)} onChange={(e) => setEfectivo(soloDigitos(e.target.value))} inputMode="numeric" placeholder="$0" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="saldo-banco">En el banco (la cuenta del comité)</Label>
            <Input id="saldo-banco" value={dinero(banco)} onChange={(e) => setBanco(soloDigitos(e.target.value))} inputMode="numeric" placeholder="$0" autoComplete="off" />
            <p className="text-[0.75rem] text-muted-foreground">Así la Caja muestra cuánto hay en cada lugar y puedes anotar giros y depósitos.</p>
          </div>
          {/* Al servidor viajan el total (efectivo + banco) y cuánto de ese total estaba en el banco. */}
          <input type="hidden" name="monto" value={total} />
          <input type="hidden" name="banco" value={banco} />
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Saldo inicial total</span>
            <span className="font-semibold tabular-nums">${total.toLocaleString("es-CL")}</span>
          </div>
          <Button type="submit" disabled={pendiente || (efectivo === "" && banco === "")}>
            {pendiente && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
