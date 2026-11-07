"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { arranqueSocios, arranques, socios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";

export type ResultadoArranques = { ok: true } | { ok: false; error: string };

const SIN_PLAN = "Arranques está disponible en el plan Grande.";
const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

const arranqueSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe cómo se llama el arranque.").max(120),
  ubicacion: z.string().trim().max(200).nullable(),
  notas: z.string().trim().max(500).nullable(),
});

class ErrorArranque extends Error {}

/** Crea un arranque, o lo corrige si viene con `id`, y deja asignados exactamente los socios que se mandan. */
export async function guardarArranque(_prev: ResultadoArranques | null, formData: FormData): Promise<ResultadoArranques> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "arranques")) return { ok: false, error: SIN_PLAN };

  const parsed = arranqueSchema.safeParse({
    nombre: formData.get("nombre"),
    ubicacion: aTexto(formData.get("ubicacion")),
    notas: aTexto(formData.get("notas")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  let ids: string[];
  try {
    const crudo = JSON.parse(String(formData.get("socios") ?? "[]"));
    ids = z.array(z.string().min(1)).max(2000).parse(crudo);
  } catch {
    return { ok: false, error: "La lista de socios no es válida." };
  }
  ids = [...new Set(ids)];

  const id = String(formData.get("id") ?? "");

  try {
    await db.transaction(async (tx) => {
      // Los socios tienen que ser de este comité.
      if (ids.length > 0) {
        const validos = await tx.select({ id: socios.id }).from(socios).where(and(eq(socios.aprId, apr.id), inArray(socios.id, ids)));
        if (validos.length !== ids.length) throw new ErrorArranque("Alguno de los socios ya no existe.");
      }

      let arranqueId = id;
      if (id) {
        const [editado] = await tx.update(arranques).set(parsed.data).where(and(eq(arranques.id, id), eq(arranques.aprId, apr.id))).returning({ id: arranques.id });
        if (!editado) throw new ErrorArranque("No encontramos ese arranque.");
        await tx.delete(arranqueSocios).where(eq(arranqueSocios.arranqueId, id));
      } else {
        const [creado] = await tx.insert(arranques).values({ ...parsed.data, aprId: apr.id }).returning({ id: arranques.id });
        arranqueId = creado.id;
      }

      if (ids.length > 0) {
        // Un socio pertenece a un solo arranque: si ya estaba en otro, se mueve a este.
        await tx.delete(arranqueSocios).where(inArray(arranqueSocios.socioId, ids));
        await tx.insert(arranqueSocios).values(ids.map((socioId) => ({ arranqueId, socioId })));
      }
    });
  } catch (e) {
    if (e instanceof ErrorArranque) return { ok: false, error: e.message };
    console.error("Arranques: no se pudo guardar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar el arranque. Inténtalo de nuevo en un momento.") };
  }

  revalidatePath("/panel/arranques");
  return { ok: true };
}

/** Borra un arranque. Los socios no se borran: solo dejan de estar asignados a él. */
export async function eliminarArranque(id: string): Promise<ResultadoArranques> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "arranques")) return { ok: false, error: SIN_PLAN };

  try {
    const borrados = await db.delete(arranques).where(and(eq(arranques.id, id), eq(arranques.aprId, apr.id))).returning({ id: arranques.id });
    if (borrados.length === 0) return { ok: false, error: "No encontramos ese arranque." };
  } catch (e) {
    console.error("Arranques: no se pudo borrar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos borrar el arranque. Inténtalo de nuevo en un momento.") };
  }

  revalidatePath("/panel/arranques");
  return { ok: true };
}
