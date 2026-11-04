/**
 * Lo del Inventario que no toca la base de datos: categorías, unidades, textos y tipos.
 * Vive aparte porque lo usan pantallas que corren en el navegador, y el navegador no puede
 * cargar la conexión a la base (lib/inventario.ts la trae y solo se usa desde el servidor).
 */

/** Solo para reconocer las categorías antiguas; ya no se ofrecen. */
export const CATEGORIAS_INSUMO = [
  { valor: "CLORO", texto: "Cloro y químicos" },
  { valor: "CANERIAS", texto: "Cañerías y fittings" },
  { valor: "MEDIDORES", texto: "Medidores" },
  { valor: "BOMBAS", texto: "Bombas y repuestos" },
  { valor: "ELECTRICO", texto: "Eléctrico" },
  { valor: "HERRAMIENTAS", texto: "Herramientas" },
  { valor: "OTROS", texto: "Otros" },
] as const;

export const UNIDADES_INSUMO = [
  { valor: "UNIDAD", texto: "Unidad", corta: "un." },
  { valor: "METRO", texto: "Metro", corta: "m" },
  { valor: "KILO", texto: "Kilo", corta: "kg" },
  { valor: "LITRO", texto: "Litro", corta: "L" },
  { valor: "SACO", texto: "Saco", corta: "sacos" },
  { valor: "CAJA", texto: "Caja", corta: "cajas" },
] as const;

export type Insumo = {
  id: string;
  nombre: string;
  codigo: string | null;
  categoria: string;
  unidad: string;
  stock: number;
  stockMinimo: number;
  costo: number;
};

/** Una categoría creada por el comité. */
export type CategoriaPropia = { id: string; nombre: string };

/** Una opción para elegir en el formulario y el filtro. */
export type OpcionCategoria = { valor: string; texto: string };

/** Así se guarda en el material la categoría que creó el comité: «p:<id>». Vacío es «sin categoría». */
export const PREFIJO_CATEGORIA_PROPIA = "p:";

/** En el formulario, la opción para crear una categoría nueva sin salir de él. */
export const CATEGORIA_NUEVA = "__nueva";

/**
 * Las categorías antiguas, de cuando eran fijas. Ya no se ofrecen ni se pueden elegir; solo se
 * reconocen para que los materiales que las tenían sigan mostrando su nombre.
 */
const CATEGORIAS_ANTIGUAS: Record<string, string> = Object.fromEntries(CATEGORIAS_INSUMO.map((c) => [c.valor, c.texto]));

/** Una categoría antigua que ya no se ofrece. «Otros» pasa a ser «sin categoría». */
export const esCategoriaAntigua = (c: string) => c in CATEGORIAS_ANTIGUAS && c !== "OTROS";

/**
 * Las categorías del comité, por nombre. Las antiguas solo aparecen si algún material todavía
 * las usa (`usadas`), para poder filtrarlo; las nuevas se eligen siempre.
 */
export function opcionesDeCategoria(propias: CategoriaPropia[], usadas: string[] = []): OpcionCategoria[] {
  const antiguas = [...new Set(usadas.filter(esCategoriaAntigua))].map((c) => ({ valor: c, texto: CATEGORIAS_ANTIGUAS[c] }));
  const delComite = [...propias]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((c) => ({ valor: `${PREFIJO_CATEGORIA_PROPIA}${c.id}`, texto: c.nombre }));
  return [...delComite, ...antiguas];
}

/** El nombre de la categoría de un material, o null si no tiene. */
export function textoCategoriaInsumo(c: string, opciones: OpcionCategoria[]): string | null {
  if (!c || c === "OTROS") return null;
  return opciones.find((x) => x.valor === c)?.texto ?? CATEGORIAS_ANTIGUAS[c] ?? null;
}
export const unidadCorta = (u: string) => UNIDADES_INSUMO.find((x) => x.valor === u)?.corta ?? "un.";

/** Una cantidad con hasta dos decimales y sin ceros de sobra: 1,5 · 12 · 0,25. */
export function formatoCantidad(n: number) {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(n);
}

/** Está a punto de acabarse: tiene aviso configurado y el stock llegó a ese mínimo o bajó de él. */
export const estaBajo = (i: Pick<Insumo, "stock" | "stockMinimo">) => i.stockMinimo > 0 && i.stock <= i.stockMinimo;

/** De dónde vino un cambio de stock. */
export type OrigenStock = "MANUAL" | "COMPRA" | "ANULACION" | "INICIAL" | "CORRECCION";

export const TEXTO_ORIGEN_STOCK: Record<OrigenStock, string> = {
  MANUAL: "Ajuste a mano",
  COMPRA: "Compra",
  ANULACION: "Compra anulada",
  INICIAL: "Stock inicial",
  CORRECCION: "Corrección al editar",
};

/** Una línea del historial del inventario. */
export type MovimientoStockFila = {
  id: string;
  insumo: string;
  unidad: string;
  /** Positivo si el stock subió, negativo si bajó. */
  cantidad: number;
  stockResultante: number;
  origen: OrigenStock;
  motivo: string | null;
  /** Quién lo hizo, si se sabe. */
  quien: string | null;
  /** Fecha y hora en ISO. */
  fecha: string;
};
