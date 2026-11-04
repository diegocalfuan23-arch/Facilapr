/**
 * Lo de Compras que no toca la base de datos: estados, textos, tipos y el cálculo de totales.
 * Vive aparte porque lo usan pantallas que corren en el navegador, y el navegador no puede
 * cargar la conexión a la base (lib/compras.ts la trae y solo se usa desde el servidor).
 */

export const TASA_IVA = 0.19;

export type EstadoCompra = "PENDIENTE" | "PAGADA" | "ANULADA";

export const TEXTO_ESTADO_COMPRA: Record<EstadoCompra, string> = {
  PENDIENTE: "Por pagar",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
};

/** De dónde viene una línea de la compra. */
export type OrigenItem = "INVENTARIO" | "NUEVO" | "GASTO";

export const TEXTO_ORIGEN_ITEM: Record<OrigenItem, string> = {
  INVENTARIO: "Material del inventario",
  NUEVO: "Material nuevo",
  GASTO: "Solo un gasto",
};

export type ProveedorFila = {
  id: string;
  nombre: string;
  rut: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
};

export type ItemCompraFila = {
  id: string;
  origen: OrigenItem;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
};

export type CompraFila = {
  id: string;
  numero: number;
  proveedor: string | null;
  folio: string | null;
  /** AAAA-MM-DD */
  fecha: string;
  vencimiento: string | null;
  estado: EstadoCompra;
  subtotal: number;
  impuesto: number;
  total: number;
  notas: string | null;
  items: ItemCompraFila[];
};

/** Subtotal, IVA y total de unas líneas. El costo de cada línea va sin IVA. */
export function totalesDe(items: { cantidad: number; costoUnitario: number }[], conIva: boolean) {
  const subtotal = items.reduce((s, i) => s + Math.round(i.cantidad * i.costoUnitario), 0);
  const impuesto = conIva ? Math.round(subtotal * TASA_IVA) : 0;
  return { subtotal, impuesto, total: subtotal + impuesto };
}
