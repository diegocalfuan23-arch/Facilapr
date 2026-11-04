"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { insumos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { CATEGORIAS_INSUMO, UNIDADES_INSUMO } from "@/lib/inventario-comun";

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
  categoria: z.enum(CATEGORIAS_INSUMO.map((c) => c.valor) as [string, ...string[]], { message: "Elige una categoría." }),
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

  const id = String(formData.get("id") ?? "");
  try {
    if (id) {
      const [editado] = await db
        .update(insumos)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(insumos.id, id), eq(insumos.aprId, apr.id)))
        .returning({ id: insumos.id });
      if (!editado) return { ok: false, error: "No encontramos ese material." };
    } else {
      await db.insert(insumos).values({ ...parsed.data, aprId: apr.id });
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
