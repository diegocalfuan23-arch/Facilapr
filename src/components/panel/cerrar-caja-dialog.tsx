"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { cerrarCaja, type ResultadoFinanzas } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ResumenPeriodo } from "@/lib/finanzas-comun";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

/**
 * Cerrar la caja de un día, igual que en MecánicoApp: el resumen del día, un comentario
 * y el botón. Deja anotado con cuánta plata se terminó y quién la cerró. Es una marca de
 * control; no impide seguir anotando movimientos de ese día.
 */
export function CerrarCajaDialog({
  resumen,
  movimientos,
  onCerrar,
}: {
  resumen: ResumenPeriodo;
  movimientos: number;
  onCerrar: () => void;
}) {
  const [estado, enviar, pendiente] = useActionState<ResultadoFinanzas | null, FormData>(cerrarCaja, null);
  const cerrada = resumen.cierre !== null;

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Caja cerrada");
      onCerrar();
    }
  }, [estado, onCerrar]);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-2xl sm:p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-medium">
            <Lock className="size-5 text-destructive" />
            {cerrada ? "Caja cerrada" : "Cerrar caja del día"}
          </DialogTitle>
          <DialogDescription className="text-[0.9rem]">Resumen del {fechaCorta(resumen.desde)}</DialogDescription>
        </DialogHeader>

        {cerrada && resumen.cierre && (
          <div className="rounded-lg bg-amber-100 px-4 py-3 text-[0.9rem] font-medium text-amber-950 dark:bg-amber-500/90">
            Caja cerrada{resumen.cierre.cerradoPor ? ` por ${resumen.cierre.cerradoPor}` : ""}, con{" "}
            {clp.format(resumen.cierre.disponible)} disponibles.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-forest/30 bg-forest/10 p-4">
            <p className="text-[0.75rem] font-medium tracking-wide text-forest uppercase">Total ingresos</p>
            <p className="mt-2 text-xl font-bold tabular-nums text-forest">{clp.format(resumen.ingresos)}</p>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-[0.75rem] font-medium tracking-wide text-destructive uppercase">Total egresos</p>
            <p className="mt-2 text-xl font-bold tabular-nums text-destructive">{clp.format(resumen.egresos)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[0.75rem] font-medium tracking-wide text-muted-foreground uppercase">Disponible del día</p>
            <p className="mt-2 text-xl font-bold tabular-nums">
              {resumen.disponible === null ? "—" : clp.format(resumen.disponible)}
            </p>
          </div>
        </div>

        {!cerrada && (
          <p className="text-[0.8rem] text-muted-foreground">
            {movimientos} movimiento{movimientos === 1 ? "" : "s"} en el día
          </p>
        )}

        <form action={enviar} className="flex flex-col gap-4">
          <input type="hidden" name="dia" value={resumen.desde} />

          <div>
            <label htmlFor="cierre-comentario" className="mb-2 block text-[0.8rem] font-medium">
              Comentario del cierre
            </label>
            {cerrada ? (
              <p className="rounded-lg border bg-background px-4 py-2 text-[0.9rem] text-muted-foreground">
                {resumen.cierre?.comentario || "Sin comentarios."}
              </p>
            ) : (
              <textarea
                id="cierre-comentario"
                name="comentario"
                rows={3}
                maxLength={200}
                placeholder="Observaciones sobre el cierre…"
                className="w-full rounded-lg border bg-background px-4 py-2 text-[0.9rem] outline-none placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
              />
            )}
          </div>

          {estado && !estado.ok && (
            <p className="text-[0.8rem] text-destructive" role="alert">
              {estado.error}
            </p>
          )}

          {!cerrada && (
            <>
              {resumen.disponible === null && (
                <p className="text-[0.8rem] text-muted-foreground">
                  Para cerrar la caja define antes el saldo inicial, en esta misma pantalla.
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" className="h-10 px-4 text-[0.95rem]" disabled={pendiente || resumen.disponible === null}>
                  {pendiente && <Loader2 className="animate-spin" />}
                  Cerrar caja
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
