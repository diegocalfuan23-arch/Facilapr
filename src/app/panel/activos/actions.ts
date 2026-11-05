"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { activosFijos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";
import { CATEGORIAS_ACTIVO } from "@/lib/activos-comun";

export type ResultadoActivos = { ok: true } | { ok: false; error: string };

const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const aEntero = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[^\d]/g, "")) || 0;

const activoSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre del bien.").max(140),
  codigo: z.string().trim().max(40).nullable(),
  categoria: z.string().refine((c) => CATEGORIAS_ACTIVO.some((x) => x.valor === c), "La categoría no es válida."),
  ubicacion: z.string().trim().max(160).nullable(),
  fechaAdquisicion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de adquisición no es válida."),
  costo: z.number().int().min(0).max(10_000_000_000),
  vidaUtilAnios: z.number().int().min(0, "La vida útil no puede ser negativa.").max(100, "La vida útil máxima es 100 años."),
  estado: z.enum(["OPERATIVO", "EN_REPARACION", "BAJA"]),
  responsable: z.string().trim().max(120).nullable(),
  notas: z.string().trim().max(500).nullable(),
});

/** Crea un activo fijo, o lo corrige si viene con `id`. */
export async function guardarActivo(_prev: ResultadoActivos | null, formData: FormData): Promise<ResultadoActivos> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "activos")) return { ok: false, error: "Activos fijos está disponible desde el plan Estándar." };

  const parsed = activoSchema.safeParse({
    nombre: formData.get("nombre"),
    codigo: aTexto(formData.get("codigo")),
    categoria: formData.get("categoria"),
    ubicacion: aTexto(formData.get("ubicacion")),
    fechaAdquisicion: formData.get("fechaAdquisicion"),
    costo: aEntero(formData.get("costo")),
    vidaUtilAnios: aEntero(formData.get("vidaUtilAnios")),
    estado: formData.get("estado"),
    responsable: aTexto(formData.get("responsable")),
    notas: aTexto(formData.get("notas")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const id = String(formData.get("id") ?? "");
  try {
    if (id) {
      const [editado] = await db
        .update(activosFijos)
        .set(parsed.data)
        .where(and(eq(activosFijos.id, id), eq(activosFijos.aprId, apr.id)))
        .returning({ id: activosFijos.id });
      if (!editado) return { ok: false, error: "No encontramos ese bien." };
    } else {
      await db.insert(activosFijos).values({ ...parsed.data, aprId: apr.id });
    }
  } catch (e) {
    console.error("Activos: no se pudo guardar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar. Inténtalo de nuevo en un momento.") };
  }

  revalidatePath("/panel/activos");
  return { ok: true };
}

/** Borra un activo (por ejemplo, uno cargado por error). Para un bien que ya no está, es mejor darlo de baja. */
export async function eliminarActivo(id: string): Promise<ResultadoActivos> {
  const { apr } = await requireAdmin();

  const borrados = await db
    .delete(activosFijos)
    .where(and(eq(activosFijos.id, id), eq(activosFijos.aprId, apr.id)))
    .returning({ id: activosFijos.id });
  if (borrados.length === 0) return { ok: false, error: "No encontramos ese bien." };

  revalidatePath("/panel/activos");
  return { ok: true };
}
