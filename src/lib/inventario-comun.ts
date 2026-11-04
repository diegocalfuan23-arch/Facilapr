/**
 * Lo del Inventario que no toca la base de datos: categorías, unidades, textos y tipos.
 * Vive aparte porque lo usan pantallas que corren en el navegador, y el navegador no puede
 * cargar la conexión a la base (lib/inventario.ts la trae y solo se usa desde el servidor).
 */

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

export const textoCategoriaInsumo = (c: string) => CATEGORIAS_INSUMO.find((x) => x.valor === c)?.texto ?? "Otros";
export const unidadCorta = (u: string) => UNIDADES_INSUMO.find((x) => x.valor === u)?.corta ?? "un.";

/** Una cantidad con hasta dos decimales y sin ceros de sobra: 1,5 · 12 · 0,25. */
export function formatoCantidad(n: number) {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(n);
}

/** Está a punto de acabarse: tiene aviso configurado y el stock llegó a ese mínimo o bajó de él. */
export const estaBajo = (i: Pick<Insumo, "stock" | "stockMinimo">) => i.stockMinimo > 0 && i.stock <= i.stockMinimo;
