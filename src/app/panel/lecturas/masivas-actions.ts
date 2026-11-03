"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/apr-session";
import {
  confirmarLecturasDe,
  previsualizarLecturasDe,
  type PrevisualizacionMasiva,
  type ResultadoMasivo,
} from "@/lib/cargar-lecturas";

/**
 * Cargar lecturas desde una planilla, en dos pasos (leer y mostrar, luego
 * confirmar). Las reglas viven en lib/cargar-lecturas, compartidas con el super admin.
 */

/** Paso 1: lee la planilla y resuelve a qué arranque corresponde cada lectura. No guarda nada. */
export async function previsualizarLecturas(
  formData: FormData
): Promise<PrevisualizacionMasiva> {
  const { apr } = await requireAdmin();
  return previsualizarLecturasDe(apr, formData);
}

/** Paso 2: guarda las que la directiva confirmó. Se vuelve a validar en el servidor. */
export async function confirmarLecturas(
  items: { socioId: string; valor: number }[],
  periodoCrudo: string,
  modoCrudo: string
): Promise<ResultadoMasivo> {
  const { user, apr } = await requireAdmin();
  const r = await confirmarLecturasDe(apr, user.id, items, periodoCrudo, modoCrudo);
  if (r.ok) revalidatePath("/panel/lecturas");
  return r;
}
