"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { registrarPagoTrabajador, type ResultadoPersonal } from "@/app/panel/personal/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MEDIOS_MOVIMIENTO, hoyEnChile } from "@/lib/finanzas-comun";
import type { TrabajadorFila } from "@/lib/personal-comun";

const campo = "h-10 px-3 text-[0.95rem]";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Pagar a una persona. El pago queda como egreso de Remuneraciones en la Caja. */
export function PagoTrabajadorDialog({ persona, periodo, onCerrar }: { persona: TrabajadorFila; periodo: string; onCerrar: () => void }) {
  const [estado, enviar, pendiente] = useActionState<ResultadoPersonal | null, FormData>(registrarPagoTrabajador, null);
  const faltante = Math.max(persona.sueldo - persona.pagadoMes, 0);
  const [monto, setMonto] = useState(faltante > 0 ? String(faltante) : "");

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Pago registrado y anotado en Caja");
      onCerrar();
    }
  }, [estado, onCerrar]);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-lg sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Pagar a {persona.nombre}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">El pago queda como egreso en la Caja.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="mt-2 flex flex-col gap-4">
          <input type="hidden" name="trabajadorId" value={persona.id} />
          <input type="hidden" name="monto" value={monto} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pgo-periodo" className={etiqueta}>
                Mes que se paga
              </label>
              <Input id="pgo-periodo" name="periodo" type="month" defaultValue={periodo} className={campo} required />
            </div>
            <div>
              <label htmlFor="pgo-fecha" className={etiqueta}>
                Fecha del pago
              </label>
              <Input id="pgo-fecha" name="fecha" type="date" defaultValue={hoyEnChile()} className={campo} required />
            </div>
            <div>
              <label htmlFor="pgo-monto" className={etiqueta}>
                Monto
              </label>
              <Input
                id="pgo-monto"
                value={monto ? `$${Number(monto).toLocaleString("es-CL")}` : ""}
                onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="$0"
                inputMode="numeric"
                className={campo}
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="pgo-medio" className={etiqueta}>
                Medio de pago
              </label>
              <select id="pgo-medio" name="medio" defaultValue="TRANSFERENCIA" className={selectClase}>
                {MEDIOS_MOVIMIENTO.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.texto}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pgo-nota" className={etiqueta}>
                Nota (opcional)
              </label>
              <Input id="pgo-nota" name="nota" placeholder="Ej.: adelanto, bono, horas extra…" maxLength={200} className={campo} />
            </div>
          </div>

          {estado && !estado.ok && (
            <p className="text-[0.8rem] text-destructive" role="alert">
              {estado.error}
            </p>
          )}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10 rounded-full px-5 text-[0.95rem]" disabled={pendiente}>
              {pendiente && <Loader2 className="animate-spin" />}
              Registrar pago
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
