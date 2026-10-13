"use client";

import { PlanesComparados } from "@/components/panel/planes-comparados";
import type { VigenciaPlan } from "@/app/panel/plan/actions";
import { NOMBRE_PLAN, type Plan } from "@/lib/planes";

const fecha = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric" });
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/** Los planes con el del comité marcado, hasta cuándo está pagado y lo que ya pagó. */
export function MiPlan({ planActual, vigencia }: { planActual: Plan; vigencia: VigenciaPlan }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="text-[0.8rem] text-muted-foreground">Estado de tu plan</div>
        <div className="mt-0.5 text-[1.05rem] font-semibold">
          {vigencia.hasta
            ? `Plan ${NOMBRE_PLAN[planActual]} pagado hasta el ${fecha.format(new Date(vigencia.hasta))}`
            : `Plan ${NOMBRE_PLAN[planActual]}`}
        </div>
        {!vigencia.hasta && (
          <p className="mt-0.5 text-[0.84rem] text-muted-foreground">
            Aquí verás hasta cuándo está pagado cuando pagues con Flow. Si ya pagas por otro medio, sigue igual.
          </p>
        )}
      </div>

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
