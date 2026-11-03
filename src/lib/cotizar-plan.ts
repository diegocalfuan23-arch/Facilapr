import { valorUfHoy } from "@/lib/uf";
import { MESES_GRATIS, PLANES_COMERCIALES } from "@/lib/planes-comerciales";
import type { Plan } from "@/lib/planes";

const IVA = 0.19;

/**
 * Lo que cobra Flow por cada pago, como fracción del monto cobrado (sin IVA; la
 * comisión lleva IVA aparte, que se recupera como crédito fiscal). Cambia con
 * FLOW_COMISION en Vercel, por ejemplo 0.0319 para 3,19 %. Confírmalo con tu
 * contrato de Flow: es el dato que más mueve tu ganancia líquida.
 */
function comisionFlow() {
  const v = Number(process.env.FLOW_COMISION ?? "0.0319");
  return Number.isFinite(v) && v >= 0 && v < 0.2 ? v : 0.0319;
}

export type Cotizacion = {
  plan: Plan;
  nombrePlan: string;
  periodo: "MENSUAL" | "ANUAL";
  uf: number;
  valorUf: number;
  neto: number;
  iva: number;
  /** Lo que se suma para que, tras la comisión de Flow, el comité reciba el neto completo. */
  comision: number;
  total: number;
};

export type ResultadoCotizacion = { ok: true; cotizacion: Cotizacion } | { ok: false; error: string };

/** Cuánto cuesta un plan hoy en pesos: la UF del día por el precio del plan, más IVA. Sin sesión: lo usan el panel y el cobro automático. */
export async function calcularCotizacion(plan: Plan, periodo: "MENSUAL" | "ANUAL"): Promise<ResultadoCotizacion> {
  const def = PLANES_COMERCIALES.find((p) => p.clave === plan);
  if (!def || def.mensual === null) {
    return { ok: false, error: "Ese plan se contrata a medida: escríbenos y lo conversamos." };
  }

  const valorUf = await valorUfHoy();
  if (!valorUf) {
    return { ok: false, error: "No pudimos obtener el valor de la UF de hoy. Inténtalo en unos minutos." };
  }

  const uf = def.mensual * (periodo === "ANUAL" ? 12 - MESES_GRATIS : 1);
  const neto = Math.round(uf * valorUf);
  const iva = Math.round(neto * IVA);
  // El total se arma para que, descontada la comisión de Flow, quede intacto el neto:
  //   neto = total/(1+IVA) − comisión×total   →   total = neto / (1/(1+IVA) − comisión)
  const total = Math.round(neto / (1 / (1 + IVA) - comisionFlow()));
  return {
    ok: true,
    cotizacion: { plan, nombrePlan: def.nombre, periodo, uf, valorUf, neto, iva, comision: total - neto - iva, total },
  };
}
