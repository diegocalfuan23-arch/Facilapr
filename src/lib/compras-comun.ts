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

/** El documento con que el proveedor respalda la compra. La factura lleva IVA aparte; la boleta y los otros ya lo traen incluido. */
export type TipoDocumento = "FACTURA" | "BOLETA" | "OTRO";

export const DOCUMENTOS_COMPRA: { valor: TipoDocumento; texto: string }[] = [
  { valor: "FACTURA", texto: "Factura" },
  { valor: "BOLETA", texto: "Boleta" },
  { valor: "OTRO", texto: "Otro" },
];

export const textoDocumento = (d: string | null) => DOCUMENTOS_COMPRA.find((x) => x.valor === d)?.texto ?? null;

/** En cuántos días se le paga a un proveedor (0 = contado). */
export const CONDICIONES_PAGO = [
  { dias: 0, texto: "Contado" },
  { dias: 15, texto: "15 días" },
  { dias: 30, texto: "30 días" },
  { dias: 60, texto: "60 días" },
] as const;

export const textoCondicionPago = (dias: number) => CONDICIONES_PAGO.find((c) => c.dias === dias)?.texto ?? `${dias} días`;

/** La fecha (AAAA-MM-DD) que queda al sumar días a otra. */
export function sumarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export type ProveedorFila = {
  id: string;
  nombre: string;
  rut: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
  rubro: string | null;
  contacto: string | null;
  /** 0 = contado. */
  diasPago: number;
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
  /** El proveedor registrado; null si se escribió solo un nombre, o si el proveedor se borró. */
  proveedorId: string | null;
  folio: string | null;
  /** Null en las compras anteriores a que se pidiera el tipo de documento. */
  documento: TipoDocumento | null;
  /** AAAA-MM-DD */
  fecha: string;
  vencimiento: string | null;
  estado: EstadoCompra;
  /** El día del egreso que dejó en Caja al pagarse; null si no está pagada o si el egreso no existe. */
  fechaPago: string | null;
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
