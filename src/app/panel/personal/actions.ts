"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { remuneraciones, trabajadores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";

export type ResultadoPersonal = { ok: true } | { ok: false; error: string };

const SIN_PLAN = "Personal está disponible desde el plan Estándar.";
const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const aEntero = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[^\d]/g, "")) || 0;

/** Un porcentaje escrito como «10,58» pasa a centésimas (1058). */
function tasa(v: FormDataEntryValue | null) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function refrescar() {
  revalidatePath("/panel/personal");
  revalidatePath("/panel/remuneraciones");
}

const trabajadorSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre.").max(120),
  rut: z.string().trim().max(20).nullable(),
  cargo: z.string().trim().min(1, "Escribe el cargo.").max(60),
  telefono: z.string().trim().max(30).nullable(),
  email: z.string().trim().email("El correo no es válido.").max(120).nullable(),
  contrato: z.enum(["SUELDO", "HONORARIO"]),
  sueldo: z.number().int().min(0).max(100_000_000),
  valorDia: z.number().int().min(1).max(100_000_000).nullable(),
  afp: z.string().trim().max(40).nullable(),
  afpTasa: z.number().int().min(0).max(3000),
  saludTasa: z.number().int().min(0).max(3000),
  cesantia: z.boolean(),
  fechaIngreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de ingreso no es válida.").nullable(),
  activo: z.boolean(),
  notas: z.string().trim().max(500).nullable(),
});

/** Crea una persona, o la corrige si viene con `id`. */
export async function guardarTrabajador(_prev: ResultadoPersonal | null, formData: FormData): Promise<ResultadoPersonal> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: SIN_PLAN };

  const parsed = trabajadorSchema.safeParse({
    nombre: formData.get("nombre"),
    rut: aTexto(formData.get("rut")),
    cargo: formData.get("cargo"),
    telefono: aTexto(formData.get("telefono")),
    email: aTexto(formData.get("email")),
    contrato: formData.get("contrato"),
    sueldo: aEntero(formData.get("sueldo")),
    valorDia: aEntero(formData.get("valorDia")) || null,
    fechaIngreso: aTexto(formData.get("fechaIngreso")),
    afp: aTexto(formData.get("afp")),
    afpTasa: tasa(formData.get("afpTasa")),
    saludTasa: tasa(formData.get("saludTasa")),
    cesantia: formData.get("cesantia") === "si",
    activo: formData.get("activo") !== "no",
    notas: aTexto(formData.get("notas")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const id = String(formData.get("id") ?? "");
  try {
    if (id) {
      const [editado] = await db
        .update(trabajadores)
        .set(parsed.data)
        .where(and(eq(trabajadores.id, id), eq(trabajadores.aprId, apr.id)))
        .returning({ id: trabajadores.id });
      if (!editado) return { ok: false, error: "No encontramos a esa persona." };
    } else {
      await db.insert(trabajadores).values({ ...parsed.data, aprId: apr.id });
    }
  } catch (e) {
    console.error("Personal: no se pudo guardar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar. Inténtalo de nuevo en un momento.") };
  }

  refrescar();
  return { ok: true };
}

/** Borra a una persona sin remuneraciones registradas. Si ya tiene pagos, se desactiva para no perder el historial. */
export async function eliminarTrabajador(id: string): Promise<ResultadoPersonal> {
  const { apr } = await requireAdmin();

  const [pago] = await db
    .select({ id: remuneraciones.id })
    .from(remuneraciones)
    .where(and(eq(remuneraciones.trabajadorId, id), eq(remuneraciones.aprId, apr.id)))
    .limit(1);
  if (pago) return { ok: false, error: "Ya tiene remuneraciones registradas. Márcala como inactiva para conservar el historial." };

  const borrados = await db
    .delete(trabajadores)
    .where(and(eq(trabajadores.id, id), eq(trabajadores.aprId, apr.id)))
    .returning({ id: trabajadores.id });
  if (borrados.length === 0) return { ok: false, error: "No encontramos a esa persona." };

  refrescar();
  return { ok: true };
}
