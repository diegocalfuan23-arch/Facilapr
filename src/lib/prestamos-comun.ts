/** Lo de Anticipos y préstamos que también usa el navegador: tipos, textos y el cálculo de las cuotas. */

export type TipoPrestamo = "ANTICIPO" | "PRESTAMO";
export type EstadoPrestamo = "ACTIVO" | "CERRADO";

export const TEXTO_TIPO_PRESTAMO: Record<TipoPrestamo, string> = {
  ANTICIPO: "Anticipo",
  PRESTAMO: "Préstamo",
};

/** El concepto con que la entrega queda en Caja: así se reconoce que viene de Préstamos. */
export const PREFIJO_CONCEPTO_ANTICIPO = "Anticipo · ";
export const PREFIJO_CONCEPTO_PRESTAMO = "Préstamo · ";

export type PrestamoFila = {
  id: string;
  trabajadorId: string;
  trabajador: string;
  tipo: TipoPrestamo;
  monto: number;
  cuotas: number;
  cuotaMonto: number;
  /** AAAA-MM: el mes de la liquidación en que se descuenta la primera cuota. */
  primerPeriodo: string;
  /** AAAA-MM-DD: cuando se entregó la plata. */
  fecha: string;
  estado: EstadoPrestamo;
  nota: string | null;
  /** Lo que ya se descontó en liquidaciones y cuántas cuotas fueron. */
  descontado: number;
  cuotasDescontadas: number;
  /** Cada descuento hecho, por mes (AAAA-MM), del más antiguo al más reciente. */
  descuentos: { periodo: string; monto: number }[];
  /** Lo que falta por descontar. */
  saldo: number;
  /** true si la entrega quedó como egreso en la Caja. */
  costoEnCaja: boolean;
};

/**
 * La cuota que se descuenta en un mes: la cuota normal o, si queda menos que eso, lo que falta. Sin cuota
 * si ya está saldado, cerrado o todavía no llega su primer mes.
 */
export function cuotaDelMes(p: Pick<PrestamoFila, "cuotaMonto" | "saldo" | "estado" | "primerPeriodo">, periodo: string): number {
  if (p.estado !== "ACTIVO" || p.saldo <= 0 || p.primerPeriodo > periodo) return 0;
  return Math.min(p.cuotaMonto, p.saldo);
}

export type ItemPlan = {
  /** AAAA-MM de la liquidación. */
  periodo: string;
  monto: number;
  /** HECHO: ya se descontó. PROXIMA: la que viene (o la de este mes). PENDIENTE: más adelante. */
  estado: "HECHO" | "PROXIMA" | "PENDIENTE";
};

/**
 * El plan de descuentos de un préstamo: lo ya descontado, mes a mes, y lo que falta. Lo que falta se calcula desde el
 * mes siguiente al último descuento (o desde el primer mes, si aún no se descontó nada) en cuotas de `cuotaMonto`: así,
 * si una cuota se corrió porque el sueldo no alcanzó, el plan sigue lo que de verdad pasó. Un préstamo cerrado no tiene pendientes.
 */
export function planDeDescuentos(p: Pick<PrestamoFila, "descuentos" | "cuotaMonto" | "saldo" | "estado" | "primerPeriodo">, mesSiguiente: (mes: string) => string): ItemPlan[] {
  const plan: ItemPlan[] = p.descuentos.map((d) => ({ periodo: d.periodo, monto: d.monto, estado: "HECHO" as const }));
  if (p.estado !== "ACTIVO" || p.saldo <= 0 || p.cuotaMonto <= 0) return plan;

  let periodo = p.descuentos.length > 0 ? mesSiguiente(p.descuentos[p.descuentos.length - 1].periodo) : p.primerPeriodo;
  let resto = p.saldo;
  for (let i = 0; resto > 0 && i < 60; i++) {
    const monto = Math.min(p.cuotaMonto, resto);
    plan.push({ periodo, monto, estado: i === 0 ? "PROXIMA" : "PENDIENTE" });
    resto -= monto;
    periodo = mesSiguiente(periodo);
  }
  return plan;
}
