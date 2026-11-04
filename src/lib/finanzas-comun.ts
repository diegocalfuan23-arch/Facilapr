import { textoMedioPago } from "@/lib/pagos";

/**
 * Lo de Finanzas que no toca la base de datos: categorías, textos y tipos. Vive aparte
 * porque lo usan pantallas que corren en el navegador, y el navegador no puede cargar
 * la conexión a la base (lib/finanzas.ts la trae y por eso solo se usa desde el servidor).
 */

/**
 * Las categorías antiguas, de cuando eran fijas. Ya no se ofrecen: cada comité crea las suyas.
 * Solo se reconocen para que los movimientos que las tenían sigan mostrando su nombre, y
 * COMPRAS la sigue poniendo el módulo de Compras en el egreso de cada compra pagada.
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
  { valor: "COMPRAS", texto: "Compras a proveedores" },
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

export type TipoMovimiento = "INGRESO" | "EGRESO";

/** Una categoría de Caja creada por el comité. */
export type CategoriaMovimientoPropia = { id: string; tipo: TipoMovimiento; nombre: string };

/** Así se guarda en el movimiento la categoría que creó el comité: «p:<id>». Vacío es «sin categoría». */
export const PREFIJO_CATEGORIA_MOV = "p:";

/** En el formulario, la opción para crear una categoría nueva sin salir de él. */
export const CATEGORIA_MOV_NUEVA = "__nueva";

/**
 * El nombre de la categoría de un movimiento. Las del comité se buscan por su id; las antiguas y
 * las del sistema (Compras, y las de los pagos de socios) se reconocen por su código.
 */
export function textoCategoria(categoria: string, propias: CategoriaMovimientoPropia[] = []): string {
  if (!categoria) return "Sin categoría";
  if (categoria.startsWith(PREFIJO_CATEGORIA_MOV)) {
    return propias.find((c) => `${PREFIJO_CATEGORIA_MOV}${c.id}` === categoria)?.nombre ?? "Sin categoría";
  }
  if (categoria === "BOLETAS") return "Boletas de agua";
  if (categoria === "COBROS") return "Otros cobros a socios";
  return TEXTO_CATEGORIA[categoria] ?? "Sin categoría";
}

/** Las categorías del comité para un tipo, por nombre: lo que se ofrece al anotar un movimiento. */
export function opcionesCategoriaMov(propias: CategoriaMovimientoPropia[], tipo: TipoMovimiento) {
  return propias
    .filter((c) => c.tipo === tipo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((c) => ({ valor: `${PREFIJO_CATEGORIA_MOV}${c.id}`, texto: c.nombre }));
}

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

export const textoMedioLinea = (medio: string) => textoMedioPago(medio);

/**
 * El cierre de caja de un día: queda como un movimiento de este tipo (con el disponible
 * de ese día y un comentario). Es una marca de control, no plata: nunca suma ni resta.
 */
export const TIPO_CIERRE = "CIERRE";

/**
 * Lo que muestra la Caja de un período (un día o un mes): con cuánta plata se empezó,
 * lo que entró y salió, y con cuánta se termina. `desde` es el primer día y `hasta` el
 * día siguiente al último. Sin saldo inicial (o con uno posterior al período) no se sabe
 * con cuánta se empezó, y `disponibleAnterior` y `disponible` vienen null.
 */
export type ResumenPeriodo = {
  desde: string;
  hasta: string;
  disponibleAnterior: number | null;
  ingresos: number;
  egresos: number;
  disponible: number | null;
  /** Solo en un día: si ya se cerró la caja, quién y con qué comentario. */
  cierre: { cerradoPor: string | null; comentario: string | null; disponible: number } | null;
};

/** Hoy en Chile, AAAA-MM-DD. */
export function hoyEnChile() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(new Date());
}

/** El día pedido si es una fecha real (AAAA-MM-DD); si no, hoy. */
export function diaValido(texto: string | undefined): string {
  if (texto && /^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const d = new Date(`${texto}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto) return texto;
  }
  return hoyEnChile();
}

/** El día de al lado (delta = -1 o +1). */
export function diaVecino(dia: string, delta: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
