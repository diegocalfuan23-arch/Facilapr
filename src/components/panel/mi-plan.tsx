"use client";

import { PlanesComparados } from "@/components/panel/planes-comparados";
import type { Plan } from "@/lib/planes";

/** Los planes de Facilapr con el del comité marcado. El uso (socios, técnicos, tokens) está en Configuración. */
export function MiPlan({ planActual }: { planActual: Plan }) {
  return <PlanesComparados planActual={planActual} />;
}
