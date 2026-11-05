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

/**
 * Con cuánta plata parte el comité en Facilapr. Sin este dato solo se ve lo que
 * entró y salió cada mes; con él se puede decir cuánto hay en caja.
 */
export function SaldoInicialDialog({
  actual,
  onCerrar,
}: {
  actual: { monto: number; fecha: string; banco: number } | null;
  onCerrar: () => void;
}) {
  const [estado, enviar, pendiente] = useActionState<ResultadoFinanzas | null, FormData>(guardarSaldoInicial, null);
  // Solo los dígitos; el formato de dinero se arma al mostrarlo.
  const [monto, setMonto] = useState(actual ? String(actual.monto) : "");
  const [banco, setBanco] = useState(actual && actual.banco > 0 ? String(actual.banco) : "");

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
          <DialogDescription>Con cuánta plata partes: efectivo y banco juntos.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="saldo-fecha">Desde el día</Label>
            <Input id="saldo-fecha" name="fecha" type="date" defaultValue={actual?.fecha ?? ""} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="saldo-monto">Saldo</Label>
            {/* Se escribe con formato de dinero ($1.500.000); al servidor viaja solo con los dígitos. */}
            <input type="hidden" name="monto" value={monto} />
            <Input
              id="saldo-monto"
              value={monto === "" ? "" : `$${Number(monto).toLocaleString("es-CL")}`}
              onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10))}
              inputMode="numeric"
              placeholder="$0"
              autoComplete="off"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="saldo-banco">De ese saldo, ¿cuánto estaba en el banco? (opcional)</Label>
            <input type="hidden" name="banco" value={banco} />
            <Input
              id="saldo-banco"
              value={banco === "" ? "" : `$${Number(banco).toLocaleString("es-CL")}`}
              onChange={(e) => setBanco(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10))}
              inputMode="numeric"
              placeholder="$0"
              autoComplete="off"
            />
            <p className="text-[0.75rem] text-muted-foreground">El resto se cuenta como efectivo. Así la Caja muestra cuánto hay en cada lugar y puedes anotar giros y depósitos.</p>
          </div>
          <Button type="submit" disabled={pendiente}>
            {pendiente && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
