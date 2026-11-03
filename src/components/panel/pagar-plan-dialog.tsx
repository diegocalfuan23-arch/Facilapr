"use client";

import { useEffect, useState, useTransition } from "react";
import { CreditCard, Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { cotizarPlan, iniciarPagoAutomatico, iniciarPagoPlan } from "@/app/panel/plan/actions";
import type { Cotizacion } from "@/lib/cotizar-plan";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatoPrecio, UNIDAD } from "@/lib/planes-comerciales";
import type { Plan } from "@/lib/planes";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/**
 * Pagar el plan con Flow: muestra cuánto es hoy en pesos (la UF del día más IVA)
 * y, al confirmar, lleva al pago. Cuando Flow confirma, el plan queda vigente solo.
 */
export function PagarPlanDialog({
  plan,
  periodo,
  onCerrar,
}: {
  plan: Plan;
  periodo: "MENSUAL" | "ANUAL";
  onCerrar: () => void;
}) {
  const [cot, setCot] = useState<Cotizacion | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pagando, iniciar] = useTransition();
  const [acepta, setAcepta] = useState(false);

  useEffect(() => {
    let vivo = true;
    cotizarPlan(plan, periodo)
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setCot(r.cotizacion);
        else {
          setCot(null);
          setError(r.error);
        }
      })
      .catch(() => vivo && (setCot(null), setError("No pudimos calcular el precio.")));
    return () => {
      vivo = false;
    };
  }, [plan, periodo]);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Pagar mi plan</DialogTitle>
          <DialogDescription>Pagas con Flow (tarjeta, Webpay o transferencia). Al confirmar el pago, el plan queda activo al tiro.</DialogDescription>
        </DialogHeader>

        {cot === undefined ? (
          <div className="flex items-center gap-2 py-6 text-[0.9rem] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Calculando con la UF de hoy…
          </div>
        ) : cot === null ? (
          <p className="rounded-lg bg-destructive/10 px-3.5 py-3 text-[0.88rem] text-destructive">{error}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border px-4 py-3">
              <div className="font-medium">
                {cot.nombrePlan} · {periodo === "ANUAL" ? "anual" : "mensual"}
              </div>
              <div className="text-[0.8rem] text-muted-foreground">
                {formatoPrecio.format(cot.uf)} {UNIDAD} · UF de hoy ${cot.valorUf.toLocaleString("es-CL")}
              </div>
            </div>
            <dl className="flex flex-col gap-1.5 text-[0.9rem]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Neto</dt>
                <dd className="tabular-nums">{clp.format(cot.neto)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">IVA 19 %</dt>
                <dd className="tabular-nums">{clp.format(cot.iva)}</dd>
              </div>
              {cot.comision > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Costo del pago en línea</dt>
                  <dd className="tabular-nums">{clp.format(cot.comision)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border/60 pt-2 text-[1rem] font-semibold">
                <dt>Total a pagar</dt>
                <dd className="tabular-nums">{clp.format(cot.total)}</dd>
              </div>
            </dl>
            <label className="flex items-start gap-2 rounded-lg border border-border/60 px-3 py-2.5 text-[0.82rem] text-muted-foreground">
              <input type="checkbox" className="mt-0.5" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
              <span>
                Quiero que el plan se pague solo cada {periodo === "ANUAL" ? "año" : "mes"} con mi tarjeta. Cada cobro se calcula con la UF de
                ese día, y puedo cancelarlo cuando quiera desde Mi plan.
              </span>
            </label>
            {error && <p className="text-[0.86rem] text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter className="sm:flex-wrap">
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            disabled={!cot || pagando || !acepta}
            onClick={() =>
              iniciar(async () => {
                setError(null);
                const r = await iniciarPagoAutomatico(plan, periodo, acepta);
                if (r.ok) {
                  window.location.href = r.url;
                } else {
                  setError(r.error);
                  toast.error(r.error);
                }
              })
            }
          >
            {pagando ? <Loader2 className="animate-spin" /> : <Repeat />}
            Activar pago automático
          </Button>
          <Button
            disabled={!cot || pagando}
            onClick={() =>
              iniciar(async () => {
                setError(null);
                const r = await iniciarPagoPlan(plan, periodo);
                if (r.ok) {
                  window.location.href = r.url;
                } else {
                  setError(r.error);
                  toast.error(r.error);
                }
              })
            }
          >
            {pagando ? <Loader2 className="animate-spin" /> : <CreditCard />}
            Pagar con Flow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
