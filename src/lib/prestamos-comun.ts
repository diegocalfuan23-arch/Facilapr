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
