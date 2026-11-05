"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { ausencias, trabajadores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";
import { diasDe, type TipoAusencia } from "@/lib/rrhh-comun";

export type ResultadoAusencias = { ok: true } | { ok: false; error: string };

const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.");

const ausenciaSchema = z.object({
  trabajadorId: z.string().min(1, "Elige a la persona.").max(64),
  tipo: z.enum(["VACACIONES", "LICENCIA", "PERMISO"]),
  desde: fecha,
  hasta: fecha,
  estado: z.enum(["SOLICITADA", "APROBADA", "RECHAZADA"]),
  detalle: z.string().trim().max(200).nullable(),
  sinGoce: z.boolean(),
  /** Un permiso por horas: cuántas (de un solo día). */
  horas: z.number().min(0.25, "Las horas deben ser al menos un cuarto de hora.").max(12, "Un permiso por horas no puede pasar de 12 horas.").nullable(),
  nota: z.string().trim().max(500).nullable(),
});

function refrescar() {
  revalidatePath("/panel/vacaciones");
  revalidatePath("/panel/licencias");
  revalidatePath("/panel/asistencia");
}

/** Registra unas vacaciones, una licencia o un permiso, o lo corrige si viene con `id`. Calcula los días solo. */
export async function guardarAusencia(_prev: ResultadoAusencias | null, formData: FormData): Promise<ResultadoAusencias> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: "RR.HH. está disponible desde el plan Estándar." };

  const parsed = ausenciaSchema.safeParse({
    trabajadorId: formData.get("trabajadorId"),
    tipo: formData.get("tipo"),
    desde: formData.get("desde"),
    hasta: formData.get("hasta"),
    estado: formData.get("estado"),
    detalle: aTexto(formData.get("detalle")),
    sinGoce: formData.get("tipo") === "PERMISO" && formData.get("sinGoce") === "si",
    horas: formData.get("tipo") === "PERMISO" && String(formData.get("horas") ?? "").trim() !== "" ? Number(String(formData.get("horas")).replace(",", ".")) : null,
    nota: aTexto(formData.get("nota")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.hasta < d.desde) return { ok: false, error: "La fecha de término no puede ser antes que la de inicio." };

  // Un permiso por horas es de un solo día y no gasta días: cuenta las horas.
  if (d.horas !== null && d.hasta !== d.desde) return { ok: false, error: "Un permiso por horas es de un solo día." };
  const dias = d.horas !== null ? 0 : diasDe(d.tipo as TipoAusencia, d.desde, d.hasta);
  if (d.horas === null && dias <= 0) return { ok: false, error: "Ese período no tiene días hábiles. Revisa las fechas." };

  const [persona] = await db
    .select({ id: trabajadores.id })
    .from(trabajadores)
    .where(and(eq(trabajadores.id, d.trabajadorId), eq(trabajadores.aprId, apr.id)))
    .limit(1);
  if (!persona) return { ok: false, error: "No encontramos a esa persona." };

  const id = String(formData.get("id") ?? "");
  try {
    if (id) {
      const [editada] = await db
        .update(ausencias)
        .set({ ...d, dias })
        .where(and(eq(ausencias.id, id), eq(ausencias.aprId, apr.id)))
        .returning({ id: ausencias.id });
      if (!editada) return { ok: false, error: "No encontramos ese registro." };
    } else {
      await db.insert(ausencias).values({ ...d, dias, aprId: apr.id });
    }
  } catch (e) {
    console.error("RR.HH.: no se pudo guardar la ausencia:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar. Inténtalo de nuevo en un momento.") };
  }

  refrescar();
  return { ok: true };
}

/** Borra un registro de vacaciones, licencia o permiso. */
export async function eliminarAusencia(id: string): Promise<ResultadoAusencias> {
  const { apr } = await requireAdmin();

  const borradas = await db
    .delete(ausencias)
    .where(and(eq(ausencias.id, id), eq(ausencias.aprId, apr.id)))
    .returning({ id: ausencias.id });
  if (borradas.length === 0) return { ok: false, error: "No encontramos ese registro." };

  refrescar();
  return { ok: true };
}

/** Cambia el estado de una solicitud (desde el tablero): aprobarla, rechazarla o dejarla de nuevo como solicitada. */
export async function cambiarEstadoAusencia(id: string, estado: "SOLICITADA" | "APROBADA" | "RECHAZADA"): Promise<ResultadoAusencias> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: "RR.HH. está disponible desde el plan Estándar." };
  if (!["SOLICITADA", "APROBADA", "RECHAZADA"].includes(estado)) return { ok: false, error: "El estado no es válido." };

  const [editada] = await db
    .update(ausencias)
    .set({ estado })
    .where(and(eq(ausencias.id, id), eq(ausencias.aprId, apr.id)))
    .returning({ id: ausencias.id });
  if (!editada) return { ok: false, error: "No encontramos ese registro." };

  refrescar();
  return { ok: true };
}
