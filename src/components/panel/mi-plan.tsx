"use client";

import { Progress } from "@/components/ui/progress";
import { ConsumoIa } from "@/components/panel/ia-chat-dialog";
import { PlanesComparados } from "@/components/panel/planes-comparados";
import type { UsoIaChat } from "@/lib/ia-chat-limites";
import type { Plan } from "@/lib/planes";

export type DatosPlan = {
  clave: Plan;
  nombre: string;
  /** Desde cuándo el comité usa Facilapr (ISO). */
  desde: string;
  socios: { usados: number; limite: number | null };
  tecnicos: { usados: number; limite: number | null };
  /** Null si el plan no incluye la IA del chat. */
  usoIa: UsoIaChat | null;
};

const desdeFecha = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" });
const entero = new Intl.NumberFormat("es-CL");

function Medidor({
  titulo,
  usados,
  limite,
}: {
  titulo: string;
  usados: number;
  limite: number | null;
}) {
  const pct = limite ? Math.min(100, Math.round((usados / limite) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[0.88rem]">
        <span className="font-medium">{titulo}</span>
        <span className="text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">{entero.format(usados)}</span>
          {limite ? ` de ${entero.format(limite)}` : " · sin tope"}
        </span>
      </div>
      {limite ? <Progress value={pct} aria-label={titulo} /> : null}
    </div>
  );
}

/** Cómo está el comité con Facilapr: los planes (el suyo marcado), cuánto lleva usado y el consumo de IA. */
export function MiPlan({ plan }: { plan: DatosPlan }) {
  return (
    <div className="flex flex-col gap-8">
      <PlanesComparados planActual={plan.clave} />

      <section className="flex flex-col gap-5">
        <h2 className="text-[1.05rem] font-semibold">Tu uso</h2>

        <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-4 text-[0.82rem] text-muted-foreground">
            Plan {plan.nombre} · con Facilapr desde {desdeFecha.format(new Date(plan.desde))}
          </div>
          <div className="flex flex-col gap-4">
            <Medidor titulo="Socios cargados" usados={plan.socios.usados} limite={plan.socios.limite} />
            <Medidor titulo="Técnicos en terreno" usados={plan.tecnicos.usados} limite={plan.tecnicos.limite} />
          </div>
        </div>

        {plan.usoIa && <ConsumoIa uso={plan.usoIa} />}
      </section>
    </div>
  );
}
