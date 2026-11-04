"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { categoriasInsumo, insumos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import {
  CATEGORIA_NUEVA,
  CATEGORIAS_INSUMO,
  PREFIJO_CATEGORIA_PROPIA,
  UNIDADES_INSUMO,
} from "@/lib/inventario-comun";

export type ResultadoInventario = { ok: true } | { ok: false; error: string };

const SIN_PLAN = "El inventario está disponible en el plan Grande.";

/** Una cantidad escrita a la chilena: acepta «1,5» y descarta espacios. Vacío es 0. */
function aCantidad(v: FormDataEntryValue | null) {
  const t = String(v ?? "").replace(/\s/g, "").replace(",", ".");
  return t === "" ? 0 : Number(t);
}

const insumoSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre del material.").max(120),
  codigo: z.string().trim().max(60).nullable(),
  categoria: z.string().max(60),
  unidad: z.enum(UNIDADES_INSUMO.map((u) => u.valor) as [string, ...string[]], { message: "Elige una unidad." }),
  stock: z.number({ message: "El stock no es un número." }).min(0, "El stock no puede ser negativo.").max(1_000_000_000),
  stockMinimo: z.number({ message: "El aviso no es un número." }).min(0, "El aviso no puede ser negativo.").max(1_000_000_000),
  costo: z.number().int().min(0).max(2_000_000_000),
});

/** Crea un material, o lo corrige si viene con `id`. Solo la directiva, y solo con un plan que incluya Inventario. */
export async function guardarInsumo(
  _prev: ResultadoInventario | null,
  formData: FormData
): Promise<ResultadoInventario> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "inventario")) return { ok: false, error: SIN_PLAN };

  const parsed = insumoSchema.safeParse({
    nombre: formData.get("nombre"),
    codigo: String(formData.get("codigo") ?? "").trim() || null,
    categoria: formData.get("categoria"),
    unidad: formData.get("unidad"),
    stock: aCantidad(formData.get("stock")),
    stockMinimo: aCantidad(formData.get("stockMinimo")),
    costo: Number(String(formData.get("costo") ?? "").replace(/\D/g, "")) || 0,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  // La categoría es ninguna, una propia de ESTE comité, una antigua que el material ya tenía, o una nueva por crear.
  let categoria = parsed.data.categoria;
  if (categoria === CATEGORIA_NUEVA) {
    const creada = await crearCategoriaDe(apr.id, String(formData.get("categoriaNueva") ?? ""));
    if (!creada.ok) return creada;
    categoria = `${PREFIJO_CATEGORIA_PROPIA}${creada.id}`;
  } else if (categoria.startsWith(PREFIJO_CATEGORIA_PROPIA)) {
    const idCategoria = categoria.slice(PREFIJO_CATEGORIA_PROPIA.length);
    const [existe] = await db
      .select({ id: categoriasInsumo.id })
      .from(categoriasInsumo)
      .where(and(eq(categoriasInsumo.id, idCategoria), eq(categoriasInsumo.aprId, apr.id)))
      .limit(1)
      .catch(() => []);
    if (!existe) return { ok: false, error: "Esa categoría ya no existe. Elige otra." };
  } else if (categoria !== "" && !CATEGORIAS_INSUMO.some((c) => c.valor === categoria)) {
    return { ok: false, error: "Esa categoría no es válida." };
  }

  const id = String(formData.get("id") ?? "");
  try {
    if (id) {
      const [editado] = await db
        .update(insumos)
        .set({ ...parsed.data, categoria, updatedAt: new Date() })
        .where(and(eq(insumos.id, id), eq(insumos.aprId, apr.id)))
        .returning({ id: insumos.id });
      if (!editado) return { ok: false, error: "No encontramos ese material." };
    } else {
      await db.insert(insumos).values({ ...parsed.data, categoria, aprId: apr.id });
    }
  } catch (e) {
    console.error("Inventario: no se pudo guardar el material:", e);
    return { ok: false, error: "No pudimos guardar el material. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel/inventario");
  return { ok: true };
}

/** Suma o resta stock (entrada o salida). No deja el stock bajo cero. */
export async function ajustarStock(id: string, cantidad: number, tipo: "ENTRADA" | "SALIDA"): Promise<ResultadoInventario> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "inventario")) return { ok: false, error: SIN_PLAN };

  if (!Number.isFinite(cantidad) || cantidad <= 0) return { ok: false, error: "La cantidad debe ser mayor que 0." };

  const [actual] = await db
    .select({ stock: insumos.stock })
    .from(insumos)
    .where(and(eq(insumos.id, id), eq(insumos.aprId, apr.id)))
    .limit(1);
  if (!actual) return { ok: false, error: "No encontramos ese material." };

  const nuevo = tipo === "ENTRADA" ? actual.stock + cantidad : actual.stock - cantidad;
  if (nuevo < 0) return { ok: false, error: "No hay tanto stock: la salida dejaría el material bajo cero." };

  // Se vuelve a comprobar el stock que se leyó: si alguien lo cambió en el medio, no se pisa.
  const [hecho] = await db
    .update(insumos)
    .set({ stock: Math.round(nuevo * 1000) / 1000, updatedAt: new Date() })
    .where(and(eq(insumos.id, id), eq(insumos.aprId, apr.id), eq(insumos.stock, actual.stock)))
    .returning({ id: insumos.id });
  if (!hecho) return { ok: false, error: "El stock cambió mientras lo ajustabas. Inténtalo de nuevo." };

  revalidatePath("/panel/inventario");
  return { ok: true };
}

export async function eliminarInsumo(id: string): Promise<ResultadoInventario> {
  const { apr } = await requireAdmin();

  const borrados = await db
    .delete(insumos)
    .where(and(eq(insumos.id, id), eq(insumos.aprId, apr.id)))
    .returning({ id: insumos.id });
  if (borrados.length === 0) return { ok: false, error: "No encontramos ese material." };

  revalidatePath("/panel/inventario");
  return { ok: true };
}

type ResultadoCategoria = { ok: true; id: string } | { ok: false; error: string };

/**
 * Crea una categoría propia del comité, o devuelve la que ya tiene ese nombre (sin distinguir
 * mayúsculas ni tildes). Así crearla desde el formulario del material nunca falla por repetida.
 */
async function crearCategoriaDe(aprId: string, nombreCrudo: string): Promise<ResultadoCategoria> {
  const nombre = String(nombreCrudo ?? "").trim().replace(/\s+/g, " ");
  if (nombre.length < 2) return { ok: false, error: "Escribe el nombre de la categoría." };
  if (nombre.length > 40) return { ok: false, error: "El nombre de la categoría es muy largo (máximo 40 letras)." };

  try {
    const propias = await db
      .select({ id: categoriasInsumo.id, nombre: categoriasInsumo.nombre })
      .from(categoriasInsumo)
      .where(eq(categoriasInsumo.aprId, aprId));
    const repetida = propias.find((c) => c.nombre.localeCompare(nombre, "es", { sensitivity: "base" }) === 0);
    if (repetida) return { ok: true, id: repetida.id };
    if (propias.length >= 40) return { ok: false, error: "Llegaste al máximo de 40 categorías." };

    const [creada] = await db.insert(categoriasInsumo).values({ aprId, nombre }).returning({ id: categoriasInsumo.id });
    return { ok: true, id: creada.id };
  } catch (e) {
    console.error("Inventario: no se pudo crear la categoría:", e);
    return { ok: false, error: "No pudimos crear la categoría. Inténtalo de nuevo en un momento." };
  }
}

/** Crea una categoría propia desde el modal de categorías. Avisa si ya existía una con ese nombre. */
export async function crearCategoria(nombreCrudo: string): Promise<ResultadoInventario> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "inventario")) return { ok: false, error: SIN_PLAN };

  const nombre = String(nombreCrudo ?? "").trim().replace(/\s+/g, " ");
  const antes = await db
    .select({ nombre: categoriasInsumo.nombre })
    .from(categoriasInsumo)
    .where(eq(categoriasInsumo.aprId, apr.id))
    .catch(() => []);
  if (antes.some((c) => c.nombre.localeCompare(nombre, "es", { sensitivity: "base" }) === 0)) {
    return { ok: false, error: "Ya tienes una categoría con ese nombre." };
  }

  const r = await crearCategoriaDe(apr.id, nombre);
  if (!r.ok) return r;

  revalidatePath("/panel/inventario");
  return { ok: true };
}

/** Borra una categoría propia. Los materiales que la usaban quedan sin categoría: no se pierde ninguno. */
export async function eliminarCategoria(id: string): Promise<ResultadoInventario> {
  const { apr } = await requireAdmin();

  try {
    await db.transaction(async (tx) => {
      const [borrada] = await tx
        .delete(categoriasInsumo)
        .where(and(eq(categoriasInsumo.id, id), eq(categoriasInsumo.aprId, apr.id)))
        .returning({ id: categoriasInsumo.id });
      if (!borrada) throw new Error("NO_EXISTE");
      await tx
        .update(insumos)
        .set({ categoria: "", updatedAt: new Date() })
        .where(and(eq(insumos.aprId, apr.id), eq(insumos.categoria, `${PREFIJO_CATEGORIA_PROPIA}${id}`)));
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_EXISTE") return { ok: false, error: "No encontramos esa categoría." };
    console.error("Inventario: no se pudo borrar la categoría:", e);
    return { ok: false, error: "No pudimos borrar la categoría. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel/inventario");
  return { ok: true };
}
