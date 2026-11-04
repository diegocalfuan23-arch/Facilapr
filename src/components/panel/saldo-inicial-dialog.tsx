"use client";

import { useActionState, useEffect } from "react";
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
  actual: { monto: number; fecha: string } | null;
  onCerrar: () => void;
}) {
  const [estado, enviar, pendiente] = useActionState<ResultadoFinanzas | null, FormData>(guardarSaldoInicial, null);

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
          <DialogDescription>
            Cuánta plata tenía el comité (caja y banco juntos) el día en que empiezas a llevar las finanzas aquí.
            Desde ese día, Facilapr suma lo que entra y resta lo que sale.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="saldo-fecha">Al día</Label>
            <Input id="saldo-fecha" name="fecha" type="date" defaultValue={actual?.fecha ?? ""} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="saldo-monto">Saldo (CLP)</Label>
            <Input
              id="saldo-monto"
              name="monto"
              inputMode="numeric"
              defaultValue={actual?.monto ?? ""}
              placeholder="1500000"
              required
            />
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
