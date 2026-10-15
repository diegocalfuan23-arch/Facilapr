/**
 * Repactación: el acuerdo con un socio moroso para pagar su deuda en cuotas
 * mensuales. Aquí vive solo el cálculo (sin base de datos), para usarlo igual en
 * el servidor y en la pantalla.
 */

export type CuotaCalendario = {
  n: number;
  vencimiento: Date;
  monto: number;
};

/** Suma `meses` a una fecha sin saltarse de mes (31 de enero + 1 mes = 28 de febrero). */
function sumarMeses(fecha: Date, meses: number) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth() + meses, 1, 12, 0, 0);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(fecha.getDate(), ultimoDia));
  return d;
}

/** Cuotas iguales; la última absorbe los pesos que sobran para que el total cuadre. */
export function calendarioCuotas(deudaTotal: number, cuotas: number, primerVencimiento: Date): CuotaCalendario[] {
  const base = Math.floor(deudaTotal / cuotas);
  const resto = deudaTotal - base * cuotas;
  return Array.from({ length: cuotas }, (_, i) => ({
    n: i + 1,
    vencimiento: sumarMeses(primerVencimiento, i),
    monto: i === cuotas - 1 ? base + resto : base,
  }));
}

export type SeguimientoRepactacion = {
  pagado: number;
  restante: number;
  cuotasPagadas: number;
  /** La primera cuota que todavía no está pagada completa; null si ya se pagó todo. */
  proxima: { n: number; vencimiento: Date; pendiente: number } | null;
  /** Lo que debería llevar pagado a hoy y no lleva. 0 = va al día. */
  atraso: number;
};

/** Cómo va un acuerdo: cuántas cuotas lleva, cuál sigue y si está atrasado. */
export function seguimientoRepactacion(
  r: { deudaTotal: number; cuotas: number; primerVencimiento: Date },
  pagado: number,
  ahora = new Date()
): SeguimientoRepactacion {
  const calendario = calendarioCuotas(r.deudaTotal, r.cuotas, r.primerVencimiento);

  let acumulado = 0;
  let cuotasPagadas = 0;
  let esperadoHoy = 0;
  let proxima: SeguimientoRepactacion["proxima"] = null;

  for (const c of calendario) {
    acumulado += c.monto;
    if (pagado >= acumulado) cuotasPagadas++;
    else if (!proxima) proxima = { n: c.n, vencimiento: c.vencimiento, pendiente: acumulado - pagado };
    if (c.vencimiento <= ahora) esperadoHoy = acumulado;
  }

  return {
    pagado,
    restante: Math.max(0, r.deudaTotal - pagado),
    cuotasPagadas,
    proxima,
    atraso: Math.max(0, esperadoHoy - pagado),
  };
}
