"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { PlanesComparados } from "@/components/panel/planes-comparados";
import { Button } from "@/components/ui/button";
import { cancelarPagoAutomatico, type PagoAutomatico, type VigenciaPlan } from "@/app/panel/plan/actions";
import { NOMBRE_PLAN, type Plan } from "@/lib/planes";

const fecha = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric" });
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/** Los planes con el del comité marcado, hasta cuándo está pagado y lo que ya pagó. */
export function MiPlan({
  planActual,
  diasPrueba = 0,
  vigencia,
  automatico,
}: {
  /** Null mientras el comité está en su prueba gratuita: todavía no tiene un plan contratado. */
  planActual: Plan | null;
  diasPrueba?: number;
  vigencia: VigenciaPlan;
  automatico: PagoAutomatico;
}) {
  const [cancelando, cancelar] = useTransition();

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="text-[0.8rem] text-muted-foreground">Estado de tu plan</div>
        <div className="mt-0.5 text-[1.05rem] font-semibold">
          {planActual === null
            ? `Prueba gratuita: te ${diasPrueba === 1 ? "queda 1 día" : `quedan ${diasPrueba} días`}`
            : vigencia.hasta
              ? `Plan ${NOMBRE_PLAN[planActual]} pagado hasta el ${fecha.format(new Date(vigencia.hasta))}`
              : `Plan ${NOMBRE_PLAN[planActual]}`}
        </div>
        {planActual === null && (
          <p className="mt-0.5 text-[0.84rem] text-muted-foreground">
            Tienes todas las funciones del plan Grande, con topes bajos de IA y sin WhatsApp automático. Elige un plan abajo para seguir cuando termine; si no, vuelves al plan Pequeño sin perder tus datos.
          </p>
        )}
        {planActual !== null && !vigencia.hasta && (
          <p className="mt-0.5 text-[0.84rem] text-muted-foreground">
            Aquí verás hasta cuándo está pagado cuando pagues con Flow. Si ya pagas por otro medio, sigue igual.
          </p>
        )}
      </div>

      {automatico.estado && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="text-[0.8rem] text-muted-foreground">Pago automático</div>
          <div className="mt-0.5 text-[1.05rem] font-semibold">
            {automatico.estado === "ACTIVA" && "Activo"}
            {automatico.estado === "SUSPENDIDA" && "Pausado: la tarjeta no pasó"}
            {automatico.estado === "PENDIENTE" && "Falta terminar de guardar la tarjeta"}
          </div>
          <p className="mt-0.5 text-[0.84rem] text-muted-foreground">
            {automatico.tarjeta && `${automatico.tarjeta}. `}
            {automatico.estado === "ACTIVA" && automatico.proximoCobro
              ? `Próximo cobro: ${fecha.format(new Date(automatico.proximoCobro))}, con la UF de ese día.`
              : automatico.estado === "SUSPENDIDA"
                ? "Registra otra tarjeta desde los planes de abajo, o paga en línea."
                : null}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={cancelando}
            onClick={() =>
              cancelar(async () => {
                const r = await cancelarPagoAutomatico();
                if (r.ok) {
                  toast.success("Pago automático cancelado. Tu plan sigue vigente hasta la fecha pagada.");
                  window.location.reload();
                } else toast.error(r.error);
              })
            }
          >
            Cancelar pago automático
          </Button>
        </div>
      )}

      <PlanesComparados planActual={planActual} />

      {vigencia.pagos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[1.05rem] font-semibold">Tus pagos de plan</h2>
          <ul className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
            {vigencia.pagos.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-[0.88rem]">
                <span>
                  {fecha.format(new Date(p.fecha))} · {NOMBRE_PLAN[p.plan as Plan] ?? p.plan}{" "}
                  {p.periodo === "ANUAL" ? "anual" : "mensual"}
                  {p.flowOrder && <span className="ml-2 text-[0.76rem] text-muted-foreground">orden Flow {p.flowOrder}</span>}
                </span>
                <span className="font-medium tabular-nums">{clp.format(p.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
