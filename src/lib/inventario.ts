import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categoriasInsumo, insumos } from "@/lib/db/schema";
import type { CategoriaPropia, Insumo } from "@/lib/inventario-comun";

export * from "@/lib/inventario-comun";

/** Los materiales del comité, por nombre. Si la tabla todavía no existe en la base, devuelve vacío. */
export async function listarInsumos(aprId: string): Promise<Insumo[]> {
  return db
    .select({
      id: insumos.id,
      nombre: insumos.nombre,
      codigo: insumos.codigo,
      categoria: insumos.categoria,
      unidad: insumos.unidad,
      stock: insumos.stock,
      stockMinimo: insumos.stockMinimo,
      costo: insumos.costo,
    })
    .from(insumos)
    .where(eq(insumos.aprId, aprId))
    .orderBy(asc(insumos.nombre))
    .catch((e) => {
      console.error("Inventario: no se pudieron leer los materiales:", e);
      return [];
    });
}

/** Las categorías que creó el comité. Si la tabla todavía no existe en la base, devuelve vacío. */
export async function listarCategorias(aprId: string): Promise<CategoriaPropia[]> {
  return db
    .select({ id: categoriasInsumo.id, nombre: categoriasInsumo.nombre })
    .from(categoriasInsumo)
    .where(eq(categoriasInsumo.aprId, aprId))
    .orderBy(asc(categoriasInsumo.nombre))
    .catch((e) => {
      console.error("Inventario: no se pudieron leer las categorías:", e);
      return [];
    });
}
