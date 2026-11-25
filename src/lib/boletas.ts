/**
 * Cálculo y estado de boletas. Aparte de las server actions para poder
 * probarlo solo: es la parte donde un error se traduce en cobrarle mal a un
 * socio.
 */

export type EstadoBoleta = "PENDIENTE" | "PAGADA" | "VENCIDA" | "ANULADA";

export type Tarifas = {
  cargoFijo: number | null;
  valorM3: number | null;
};

/**
 * El subsidio de un arranque: un porcentaje de la boleta (o solo hasta cierto consumo, si tiene tope) o un
 * monto fijo en pesos.
 */
export type ReglaSubsidio = {
  tipo: "PORCENTAJE" | "MONTO";
  /** El porcentaje (1 a 100) o los pesos, según el tipo. */
  valor: number;
  /** Solo con porcentaje: hasta cuántos m³ del mes cubre; null = sobre el total. */
  topeM3: number | null;
};

/** La regla que rige en un mes («AAAA-MM»); null si no hay subsidio o está fuera de su vigencia. */
export function subsidioVigente(
  s: (ReglaSubsidio & { desde: string; hasta: string | null }) | null | undefined,
  periodo: string
): ReglaSubsidio | null {
  if (!s || periodo < s.desde || (s.hasta && periodo > s.hasta)) return null;
  return { tipo: s.tipo, valor: s.valor, topeM3: s.topeM3 };
}

/** «50% del total», «50% hasta 15 m³» o «$5.000». */
export function textoSubsidio(r: ReglaSubsidio) {
  if (r.tipo === "MONTO") return `$${r.valor.toLocaleString("es-CL")}`;
  return r.topeM3 === null ? `${r.valor}% del total` : `${r.valor}% hasta ${r.topeM3} m³`;
}

/** Lo que se descuenta de la boleta y se le cobra a la municipalidad. Nunca más que la boleta. */
export function montoDeSubsidio(cargoFijo: number, valorM3: number, consumoM3: number, regla: ReglaSubsidio | null) {
  if (!regla) return 0;
  const total = cargoFijo + consumoM3 * valorM3;
  if (regla.tipo === "MONTO") return Math.min(regla.valor, total);
  const base = regla.topeM3 === null ? total : cargoFijo + Math.min(consumoM3, regla.topeM3) * valorM3;
  return Math.min(Math.round((base * regla.valor) / 100), total);
}

export type CalculoBoleta = {
  consumoM3: number;
  /** Lo que paga el socio: ya con el subsidio descontado. */
  montoTotal: number;
  /** Lo que se le cobra a la municipalidad; 0 sin subsidio. */
  montoSubsidio: number;
  cargoFijo: number;
  valorM3: number;
};

/**
 * Calcula el monto desde las lecturas del medidor.
 * Devuelve null si faltan datos: en ese caso el monto lo carga el comité.
 */
export function calcularDesdeLecturas(
  lecturaAnterior: number | null,
  lecturaActual: number | null,
  tarifas: Tarifas,
  /**
   * Cambio de medidor: el medidor nuevo parte en 0, así que `lecturaActual` es lo que lleva el nuevo y
   * el consumo del mes suma dos tramos: lo que le faltó al viejo hasta su lectura final + lo del nuevo.
   * Sin la lectura final del viejo solo se cuenta el tramo del nuevo.
   */
  cambioMedidor?: { lecturaFinalAnterior: number | null } | null,
  subsidio: ReglaSubsidio | null = null
): CalculoBoleta | { error: string } | null {
  if (lecturaAnterior === null || lecturaActual === null) return null;
  const finalViejo = cambioMedidor?.lecturaFinalAnterior ?? null;
  if (cambioMedidor && finalViejo !== null && finalViejo < lecturaAnterior) {
    return {
      error: `La lectura final del medidor viejo (${finalViejo}) no puede ser menor que la anterior (${lecturaAnterior}).`,
    };
  }
  if (tarifas.cargoFijo === null || tarifas.valorM3 === null) {
    return {
      error:
        "Para calcular desde lecturas necesitas definir el cargo fijo y el valor del m³ en Configuración → Facturación.",
    };
  }

  // Un medidor no retrocede. Si pasa, casi siempre es un error de tipeo o un
  // medidor cambiado: es mejor avisar que cobrar un consumo negativo.
  if (!cambioMedidor && lecturaActual < lecturaAnterior) {
    return {
      error:
        "La lectura actual es menor que la anterior. Revisa los valores o registra el cambio de medidor.",
    };
  }

  const consumoM3 = cambioMedidor
    ? (finalViejo !== null ? finalViejo - lecturaAnterior : 0) + lecturaActual
    : lecturaActual - lecturaAnterior;

  const montoSubsidio = montoDeSubsidio(tarifas.cargoFijo, tarifas.valorM3, consumoM3, subsidio);

  return {
    consumoM3,
    cargoFijo: tarifas.cargoFijo,
    valorM3: tarifas.valorM3,
    montoSubsidio,
    montoTotal: tarifas.cargoFijo + consumoM3 * tarifas.valorM3 - montoSubsidio,
  };
}

/**
 * Estado que corresponde a una boleta según lo pagado y la fecha.
 * ANULADA no se recalcula: es una decisión del comité, no del reloj.
 */
export function estadoQueCorresponde(
  montoTotal: number,
  montoPagado: number,
  fechaVencimiento: Date,
  estadoActual: EstadoBoleta,
  ahora = new Date()
): EstadoBoleta {
  if (estadoActual === "ANULADA") return "ANULADA";
  if (montoPagado >= montoTotal) return "PAGADA";
  return fechaVencimiento < ahora ? "VENCIDA" : "PENDIENTE";
}

/** Lo que falta por pagar. Nunca negativo, aunque hayan pagado de más. */
export function saldo(montoTotal: number, montoPagado: number): number {
  return Math.max(0, montoTotal - montoPagado);
}

/**
 * Normaliza un período a "AAAA-MM". Acepta lo que un comité escribiría en
 * su planilla: "2026-07", "07/2026", "julio 2026".
 */
const MESES: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04",
  mayo: "05", junio: "06", julio: "07", agosto: "08",
  septiembre: "09", setiembre: "09", octubre: "10",
  noviembre: "11", diciembre: "12",
};

export function normalizarPeriodo(valor: string): string | null {
  const limpio = valor.trim().toLowerCase();
  if (!limpio) return null;

  // Excel convierte "2026-07" en una fecha y la planilla llega como 2026-07-01.
  const fechaCompleta = limpio.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (fechaCompleta) {
    const mes = Number(fechaCompleta[2]);
    return mes >= 1 && mes <= 12 ? `${fechaCompleta[1]}-${fechaCompleta[2]}` : null;
  }

  // 2026-07 o 2026/07
  const iso = limpio.match(/^(\d{4})[-/](\d{1,2})$/);
  if (iso) {
    const mes = Number(iso[2]);
    if (mes < 1 || mes > 12) return null;
    return `${iso[1]}-${String(mes).padStart(2, "0")}`;
  }

  // 07/2026 o 7-2026
  const invertido = limpio.match(/^(\d{1,2})[-/](\d{4})$/);
  if (invertido) {
    const mes = Number(invertido[1]);
    if (mes < 1 || mes > 12) return null;
    return `${invertido[2]}-${String(mes).padStart(2, "0")}`;
  }

  // julio 2026
  const enPalabras = limpio.match(/^([a-záéíóú]+)\s+(\d{4})$/);
  if (enPalabras) {
    const mes = MESES[enPalabras[1]];
    if (!mes) return null;
    return `${enPalabras[2]}-${mes}`;
  }

  return null;
}

/** "2026-07" → "Julio 2026", para mostrar. */
const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function formatearPeriodo(periodo: string): string {
  const partes = periodo.match(/^(\d{4})-(\d{2})$/);
  if (!partes) return periodo;
  const mes = Number(partes[2]);
  if (mes < 1 || mes > 12) return periodo;
  return `${NOMBRE_MES[mes - 1]} ${partes[1]}`;
}

/** Convierte "$12.450", "12450" o "12.450" a 12450. */
export function aMonto(valor: string): number | null {
  const limpio = valor.replace(/[^\d-]/g, "");
  if (limpio === "" || limpio === "-") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/**
 * La tarifa que corresponde a un arranque según su uso. Los comerciales usan la
 * suya si el comité la definió completa (cargo fijo y valor del m³); si no, se
 * les cobra como a todos.
 */
export function tarifasPara(
  apr: {
    tarifaCargoFijo: number | null;
    tarifaMetroCubico: number | null;
    tarifaCargoFijoComercial: number | null;
    tarifaMetroCubicoComercial: number | null;
  },
  uso: string | null | undefined
): { cargoFijo: number | null; valorM3: number | null } {
  if (
    uso === "COMERCIAL" &&
    apr.tarifaCargoFijoComercial !== null &&
    apr.tarifaMetroCubicoComercial !== null
  ) {
    return { cargoFijo: apr.tarifaCargoFijoComercial, valorM3: apr.tarifaMetroCubicoComercial };
  }
  return { cargoFijo: apr.tarifaCargoFijo, valorM3: apr.tarifaMetroCubico };
}
