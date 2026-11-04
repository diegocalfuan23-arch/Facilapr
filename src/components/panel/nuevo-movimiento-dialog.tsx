"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { crearMovimiento, type ResultadoFinanzas } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CATEGORIAS_EGRESO,
  CATEGORIAS_INGRESO,
  MEDIOS_MOVIMIENTO,
  hoyEnChile,
  type TipoMovimiento,
} from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const campo = "h-10 px-3 text-[0.95rem]";
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";

/**
 * Registrar un ingreso o un egreso manual, con el mismo formulario que la Caja de
 * MecánicoApp. Los pagos de socios no se anotan aquí: esos ya entran solos por Pagos.
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
  const [monto, setMonto] = useState("");
  const [estado, enviar, pendiente] = useActionState<ResultadoFinanzas | null, FormData>(crearMovimiento, null);

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Movimiento registrado");
      onCerrar();
    }
  }, [estado, onCerrar]);

  const categorias = tipo === "INGRESO" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-lg sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Nuevo movimiento de caja</DialogTitle>
          <DialogDescription className="text-[0.9rem]">
            Registra un ingreso o egreso manual. Los pagos de socios ya entran solos desde Pagos.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="flex flex-col">
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="monto" value={monto} />

          <div className="mt-2">
            <span className={etiqueta}>Tipo de movimiento</span>
            <div className="grid grid-cols-2 gap-3" role="group" aria-label="Tipo de movimiento">
              <button
                type="button"
                onClick={() => setTipo("INGRESO")}
                aria-pressed={tipo === "INGRESO"}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-[0.9rem] font-medium transition-colors",
                  tipo === "INGRESO"
                    ? "border-forest bg-forest/10 text-forest"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowDown className="size-4" />
                Ingreso
              </button>
              <button
                type="button"
                onClick={() => setTipo("EGRESO")}
                aria-pressed={tipo === "EGRESO"}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-[0.9rem] font-medium transition-colors",
                  tipo === "EGRESO"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowUp className="size-4" />
                Egreso
              </button>
            </div>
          </div>

          <h3 className="mt-6 text-[0.95rem] font-medium">Datos generales</h3>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mov-monto" className={etiqueta}>
                Monto
              </label>
              <Input
                id="mov-monto"
                value={monto ? Number(monto).toLocaleString("es-CL") : ""}
                onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="0"
                inputMode="numeric"
                className={campo}
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="mov-fecha" className={etiqueta}>
                Fecha
              </label>
              <Input id="mov-fecha" name="fecha" type="date" defaultValue={fecha ?? hoyEnChile()} className={campo} required />
            </div>
            <div>
              <label htmlFor="mov-categoria" className={etiqueta}>
                Categoría
              </label>
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
            <div>
              <label htmlFor="mov-medio" className={etiqueta}>
                Medio de pago
              </label>
              <select id="mov-medio" name="medio" className={selectClase} defaultValue="EFECTIVO">
                {MEDIOS_MOVIMIENTO.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.texto}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="mov-concepto" className={etiqueta}>
              Descripción
            </label>
            <Input
              id="mov-concepto"
              name="concepto"
              placeholder="Ej. Cuenta de luz de octubre, aporte de la municipalidad…"
              maxLength={200}
              className={campo}
              required
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mov-contraparte" className={etiqueta}>
                {tipo === "EGRESO" ? "A quién se pagó" : "De quién vino"}
              </label>
              <Input id="mov-contraparte" name="contraparte" placeholder="Proveedor o institución" maxLength={120} className={campo} />
            </div>
            <div>
              <label htmlFor="mov-referencia" className={etiqueta}>
                N.° de factura u operación
              </label>
              <Input id="mov-referencia" name="referencia" maxLength={80} className={campo} />
            </div>
          </div>

          {estado && !estado.ok && (
            <p className="mt-3 text-[0.8rem] text-destructive" role="alert">
              {estado.error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10 px-4 text-[0.95rem]" disabled={pendiente}>
              {pendiente && <Loader2 className="animate-spin" />}
              Registrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
