"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { crearMovimiento, type ResultadoFinanzas } from "@/app/panel/finanzas/actions";
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
import {
  CATEGORIAS_EGRESO,
  CATEGORIAS_INGRESO,
  MEDIOS_MOVIMIENTO,
  hoyEnChile,
  type TipoMovimiento,
} from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const selectClase =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/**
 * Anotar un ingreso o un egreso del comité. Al guardar se cierra solo; los pagos
 * de socios no se anotan aquí, esos ya entran por Pagos.
 */
export function NuevoMovimientoDialog({
  tipoInicial,
  fecha,
  onCerrar,
}: {
  tipoInicial: TipoMovimiento;
  /** El día que se propone (AAAA-MM-DD); si falta, hoy. En la Caja, el día que se está mirando. */
  fecha?: string;
  onCerrar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoMovimiento>(tipoInicial);
  const [estado, enviar, pendiente] = useActionState<ResultadoFinanzas | null, FormData>(crearMovimiento, null);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast.success("Movimiento guardado");
      onCerrar();
    } else {
      toast.error(estado.error);
    }
  }, [estado, onCerrar]);

  const categorias = tipo === "INGRESO" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Anotar un movimiento</DialogTitle>
          <DialogDescription>
            Para gastos del comité y para ingresos que no vienen de un socio. Los pagos de socios ya entran solos.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="flex flex-col gap-4">
          <input type="hidden" name="tipo" value={tipo} />

          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de movimiento">
            {(["EGRESO", "INGRESO"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                aria-pressed={tipo === t}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  tipo === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t === "EGRESO" ? "Egreso (gasto)" : "Ingreso"}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mov-fecha">Fecha</Label>
              <Input id="mov-fecha" name="fecha" type="date" defaultValue={fecha ?? hoyEnChile()} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mov-monto">Monto (CLP)</Label>
              <Input id="mov-monto" name="monto" inputMode="numeric" placeholder="85000" required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mov-categoria">Categoría</Label>
            {/* La clave cambia con el tipo: así la lista se reinicia al pasar de egreso a ingreso. */}
            <select key={tipo} id="mov-categoria" name="categoria" className={selectClase} defaultValue="" required>
              <option value="" disabled>
                Elige una categoría
              </option>
              {categorias.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.texto}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mov-concepto">Qué fue</Label>
            <Input id="mov-concepto" name="concepto" placeholder="Ej.: cuenta de luz de octubre" maxLength={200} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mov-medio">Medio</Label>
              <select id="mov-medio" name="medio" className={selectClase} defaultValue="TRANSFERENCIA">
                {MEDIOS_MOVIMIENTO.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.texto}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mov-referencia">N.° de factura u operación</Label>
              <Input id="mov-referencia" name="referencia" maxLength={80} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mov-contraparte">{tipo === "EGRESO" ? "A quién se pagó" : "De quién vino"}</Label>
            <Input id="mov-contraparte" name="contraparte" placeholder="Proveedor o institución" maxLength={120} />
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
