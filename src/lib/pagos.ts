/** Cómo pagó el socio. Es texto en la base para poder sumar medios (Mercado Pago, Flow) sin migrar. */
export const MEDIOS_PAGO = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CAJA_VECINA", texto: "Caja Vecina" },
  { valor: "OTRO", texto: "Otro" },
] as const;

/** Lo que se cobra cuando no es una boleta. */
export const CONCEPTOS_COBRO = [
  { valor: "RECONEXION", texto: "Reposición o reconexión" },
  { valor: "REPARACION", texto: "Reparación" },
  { valor: "OTRO", texto: "Otro cobro" },
] as const;

export type ConceptoCobro = (typeof CONCEPTOS_COBRO)[number]["valor"];

const CONCEPTOS: Record<string, string> = {
  BOLETA: "Boleta",
  ...Object.fromEntries(CONCEPTOS_COBRO.map((c) => [c.valor, c.texto])),
};

export const textoConcepto = (concepto: string) => CONCEPTOS[concepto] ?? "Otro cobro";

export type MedioPago = (typeof MEDIOS_PAGO)[number]["valor"];

const TEXTOS: Record<string, string> = {
  ...Object.fromEntries(MEDIOS_PAGO.map((m) => [m.valor, m.texto])),
  MERCADO_PAGO: "Mercado Pago",
  FLOW: "Flow",
};

export const textoMedioPago = (medio: string) => TEXTOS[medio] ?? "Otro";
