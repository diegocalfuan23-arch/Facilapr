import { textoMedioPago } from "@/lib/pagos";

/**
 * Lo de Finanzas que no toca la base de datos: categorías, textos y tipos. Vive aparte
 * porque lo usan pantallas que corren en el navegador, y el navegador no puede cargar
 * la conexión a la base (lib/finanzas.ts la trae y por eso solo se usa desde el servidor).
 */

export const CATEGORIAS_INGRESO = [
  { valor: "SUBSIDIO", texto: "Subsidio o aporte del Estado" },
  { valor: "APORTE", texto: "Aporte de socios o de un tercero" },
  { valor: "CUOTA", texto: "Cuota de incorporación" },
  { valor: "OTRO_INGRESO", texto: "Otro ingreso" },
] as const;

export const CATEGORIAS_EGRESO = [
  { valor: "ELECTRICIDAD", texto: "Electricidad" },
  { valor: "REPARACIONES", texto: "Reparaciones y mantención" },
  { valor: "INSUMOS", texto: "Insumos (cloro, repuestos, medidores)" },
  { valor: "REMUNERACIONES", texto: "Sueldos y honorarios" },
  { valor: "ANALISIS", texto: "Análisis de agua" },
  { valor: "ADMINISTRATIVO", texto: "Gastos administrativos" },
  { valor: "IMPUESTOS", texto: "Impuestos y cotizaciones" },
  { valor: "OTRO_EGRESO", texto: "Otro egreso" },
] as const;

export const MEDIOS_MOVIMIENTO = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CHEQUE", texto: "Cheque" },
  { valor: "OTRO", texto: "Otro" },
] as const;

const TEXTO_CATEGORIA: Record<string, string> = Object.fromEntries(
  [...CATEGORIAS_INGRESO, ...CATEGORIAS_EGRESO].map((c) => [c.valor, c.texto])
);

export const textoCategoria = (categoria: string) => TEXTO_CATEGORIA[categoria] ?? "Otro";

export type TipoMovimiento = "INGRESO" | "EGRESO";

/**
 * El saldo con que el comité parte en Facilapr (lo que había en caja y banco ese día).
 * Se guarda como un movimiento de este tipo, uno por comité, para no tocar la tabla del
 * comité; nunca cuenta como ingreso ni como egreso de ningún mes.
 */
export const TIPO_SALDO_INICIAL = "SALDO_INICIAL";

/** Una línea del libro, venga de un pago de socio o de un movimiento anotado a mano. */
export type LineaLibro = {
  /** "pago:<id>" o "mov:<id>": solo los movimientos se pueden borrar. */
  id: string;
  tipo: TipoMovimiento;
  /** AAAA-MM-DD */
  fecha: string;
  monto: number;
  categoria: string;
  concepto: string;
  medio: string;
  referencia: string | null;
  contraparte: string | null;
  /** true: viene de los pagos de socios y no se edita aquí. */
  automatico: boolean;
};

export type ResumenMes = {
  ingresos: number;
  egresos: number;
  resultado: number;
  /** Cuánto fue a cada categoría, de mayor a menor, por tipo. */
  porCategoria: { tipo: TipoMovimiento; categoria: string; texto: string; total: number }[];
};

export type SaldoCaja = {
  /** Lo que hay al cierre del mes: el saldo inicial más todo lo que entró y salió desde entonces. */
  alCierre: number;
  /** El día desde el que se cuenta (AAAA-MM-DD) y el saldo con que se partió. */
  desde: string;
  inicial: number;
};

export const textoMedioLinea = (medio: string) => textoMedioPago(medio);
