"use client";

import { Progress } from "@/components/ui/progress";
import { ConsumoIa } from "@/components/panel/ia-chat-dialog";
import type { UsoIaChat } from "@/lib/ia-chat-limites";

export type DatosUso = {
  nombrePlan: string;
  /** Desde cuándo el comité usa Facilapr (ISO). */
  desde: string;
  socios: { usados: number; limite: number | null };
  tecnicos: { usados: number; limite: number | null };
  /** Null si el plan no incluye la IA del chat. */
  usoIa: UsoIaChat | null;
};

const desdeFecha = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" });
const entero = new Intl.NumberFormat("es-CL");

function Medidor({ titulo, usados, limite }: { titulo: string; usados: number; limite: number | null }) {
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

/** Cuánto lleva usado el comité de lo que incluye su plan: socios, técnicos y tokens de IA. */
export function UsoComite({ uso }: { uso: DatosUso }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-4 text-[0.82rem] text-muted-foreground">
          Plan {uso.nombrePlan} · con Facilapr desde {desdeFecha.format(new Date(uso.desde))}
        </div>
        <div className="flex flex-col gap-4">
          <Medidor titulo="Socios cargados" usados={uso.socios.usados} limite={uso.socios.limite} />
          <Medidor titulo="Técnicos en terreno" usados={uso.tecnicos.usados} limite={uso.tecnicos.limite} />
        </div>
      </div>

      {uso.usoIa && <ConsumoIa uso={uso.usoIa} />}
    </div>
  );
}
