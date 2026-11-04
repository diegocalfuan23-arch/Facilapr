"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { cerrarCaja, type ResultadoFinanzas } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ResumenDia } from "@/lib/finanzas-comun";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

/**
 * Cerrar la caja de un día: deja anotado con cuánta plata se terminó y quién la cerró.
 * Es una marca de control; no impide seguir anotando movimientos de ese día.
 */
export function CerrarCajaDialog({
  resumen,
  movimientos,
  onCerrar,
}: {
  resumen: ResumenDia;
  movimientos: number;
  onCerrar: () => void;
}) {
  const [estado, enviar, pendiente] = useActionState<ResultadoFinanzas | null, FormData>(cerrarCaja, null);
  const cerrada = resumen.cierre !== null;

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast.success("Caja cerrada");
      onCerrar();
    } else {
      toast.error(estado.error);
    }
  }, [estado, onCerrar]);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            {cerrada ? "Caja cerrada" : "Cerrar caja del día"}
          </DialogTitle>
          <DialogDescription>Resumen del {fechaCorta(resumen.dia)}</DialogDescription>
        </DialogHeader>

        {cerrada && resumen.cierre && (
          <p className="rounded-lg bg-muted px-4 py-3 text-[0.9rem]">
            Cerrada{resumen.cierre.cerradoPor ? ` por ${resumen.cierre.cerradoPor}` : ""} con{" "}
            <strong>{clp.format(resumen.cierre.disponible)}</strong> disponibles.
          </p>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-forest/30 bg-forest/5 p-3">
            <div className="text-[0.7rem] font-medium tracking-wide text-forest uppercase">Ingresos</div>
            <div className="mt-1 font-semibold tabular-nums text-forest">{clp.format(resumen.ingresos)}</div>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="text-[0.7rem] font-medium tracking-wide text-destructive uppercase">Egresos</div>
            <div className="mt-1 font-semibold tabular-nums text-destructive">{clp.format(resumen.egresos)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Disponible</div>
            <div className="mt-1 font-semibold tabular-nums">
              {resumen.disponibleDelDia === null ? "—" : clp.format(resumen.disponibleDelDia)}
            </div>
          </div>
        </div>

        {cerrada ? (
          <p className="text-[0.85rem] text-muted-foreground">{resumen.cierre?.comentario || "Sin comentarios."}</p>
        ) : (
          <form action={enviar} className="flex flex-col gap-4">
            <input type="hidden" name="dia" value={resumen.dia} />
            <p className="text-[0.85rem] text-muted-foreground">
              {movimientos} movimiento{movimientos === 1 ? "" : "s"} en el día.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cierre-comentario">Comentario del cierre</Label>
              <Textarea id="cierre-comentario" name="comentario" rows={3} maxLength={200} placeholder="Observaciones sobre el cierre…" />
            </div>
            <Button type="submit" disabled={pendiente || resumen.disponibleDelDia === null}>
              {pendiente && <Loader2 className="animate-spin" />}
              Cerrar caja
            </Button>
            {resumen.disponibleDelDia === null && (
              <p className="text-[0.8rem] text-muted-foreground">
                Para cerrar la caja define antes el saldo inicial, en Finanzas.
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
