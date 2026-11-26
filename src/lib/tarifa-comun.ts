/** Antecedentes para fijar la tarifa: tipos y cálculos sin base de datos, para el servidor y la pantalla. */

export type MesTarifa = {
  /** «AAAA-MM». */
  mes: string;
  /** Lo que marcó el macromedidor; null si no se anotó. */
  producido: number | null;
  /** m³ de las boletas del mes. */
  facturado: number;
  /** Boletas del mes que tienen consumo: una por arranque. */
  arranques: number;
};

export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const mesCortoDe = (mes: string) => MESES_CORTOS[Number(mes.slice(5, 7)) - 1] ?? mes;

/** Los antecedentes pueden abarcar como máximo los últimos cinco años (Reglamento, art. 64). */
export function aniosDisponibles(hoy: string) {
  const actual = Number(hoy.slice(0, 4));
  return { desde: actual - 4, hasta: actual };
}

export function anioPedido(valor: string | null | undefined, hoy: string) {
  const { desde, hasta } = aniosDisponibles(hoy);
  const n = Number(valor);
  return Number.isInteger(n) && n >= desde && n <= hasta ? n : hasta;
}

/** Agua no facturada de un mes, en porcentaje. Solo cuando se conoce lo producido y hay boletas. */
export function noFacturada(producido: number | null, facturado: number) {
  return producido && facturado > 0 ? ((producido - facturado) / producido) * 100 : null;
}

/** El total del período: la pérdida se calcula solo con los meses que tienen ambos datos. */
export function totalesDeAgua(meses: MesTarifa[]) {
  const comparables = meses.filter((m) => m.producido && m.facturado > 0);
  const producidoComparable = comparables.reduce((s, m) => s + (m.producido ?? 0), 0);
  const facturadoComparable = comparables.reduce((s, m) => s + m.facturado, 0);
  return {
    producido: meses.reduce((s, m) => s + (m.producido ?? 0), 0),
    facturado: meses.reduce((s, m) => s + m.facturado, 0),
    mesesComparables: comparables.length,
    producidoComparable,
    facturadoComparable,
    noFacturada: noFacturada(producidoComparable || null, facturadoComparable),
  };
}

export const porcentaje = (n: number | null) => (n === null ? "—" : `${n.toFixed(1).replace(".", ",")} %`);

export const metros = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 1 });

/** Un promedio, siempre con un decimal. */
export const promedio = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
