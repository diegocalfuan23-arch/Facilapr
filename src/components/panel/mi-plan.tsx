"use client";

import { Check, Minus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConsumoIa } from "@/components/panel/ia-chat-dialog";
import type { UsoIaChat } from "@/lib/ia-chat-limites";

export type DatosPlan = {
  nombre: string;
  /** Desde cuándo el comité usa Facilapr (ISO). */
  desde: string;
  socios: { usados: number; limite: number | null };
  tecnicos: { usados: number; limite: number | null };
  capacidades: { texto: string; incluida: boolean }[];
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

/** Cómo está el comité con Facilapr: plan, límites, qué incluye y consumo de IA. */
export function MiPlan({ plan }: { plan: DatosPlan }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[0.8rem] text-muted-foreground">Tu plan</div>
            <h2 className="mt-0.5 text-[1.3rem] font-semibold tracking-tight">{plan.nombre}</h2>
            <p className="mt-0.5 text-[0.82rem] text-muted-foreground">
              Con Facilapr desde {desdeFecha.format(new Date(plan.desde))}
            </p>
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a
                href={`mailto:hola@facilapr.cl?subject=${encodeURIComponent("Quiero cambiar mi plan")}`}
              />
            }
          >
            <Sparkles />
            Cambiar de plan
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-border/60 pt-5">
          <Medidor titulo="Socios cargados" usados={plan.socios.usados} limite={plan.socios.limite} />
          <Medidor titulo="Técnicos en terreno" usados={plan.tecnicos.usados} limite={plan.tecnicos.limite} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h3 className="text-[0.95rem] font-semibold">Qué incluye</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {plan.capacidades.map((c) => (
            <li
              key={c.texto}
              className={`flex items-center gap-2 text-[0.88rem] ${c.incluida ? "" : "text-muted-foreground"}`}
            >
              {c.incluida ? (
                <Check className="size-4 shrink-0 text-forest" />
              ) : (
                <Minus className="size-4 shrink-0" />
              )}
              {c.texto}
            </li>
          ))}
        </ul>
      </div>

      {plan.usoIa && <ConsumoIa uso={plan.usoIa} />}
    </section>
  );
}
