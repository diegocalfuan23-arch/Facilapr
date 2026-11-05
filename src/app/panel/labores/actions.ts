"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { insumos, laborInsumos, labores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { ErrorLabor, descontarStock, devolverStock } from "@/lib/labores-stock";
import { TIPOS_LABOR, ahoraEnChile } from "@/lib/labores-comun";

export type ResultadoLabores = { ok: true } | { ok: false; error: string };

const SIN_PLAN = "Labores está disponible desde el plan Estándar.";
const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

function refrescar() {
  revalidatePath("/panel/labores");
  revalidatePath("/panel/inventario");
}

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.");

const laborSchema = z.object({
  titulo: z.string().trim().min(1, "Escribe qué labor es.").max(140),
  descripcion: z.string().trim().max(1000).nullable(),
  tipo: z.string().refine((t) => TIPOS_LABOR.some((x) => x.valor === t), "El tipo no es válido."),
  lugar: z.string().trim().max(160).nullable(),
  estado: z.enum(["PROGRAMADA", "EN_CURSO", "HECHA"]),
  fecha,
  fechaTermino: fecha.nullable(),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora de inicio no es válida.").nullable(),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora de término no es válida.").nullable(),
  responsable: z.string().trim().max(120).nullable(),
});

const lineasSchema = z
  .array(z.object({ insumoId: z.string().min(1), cantidad: z.number().positive("La cantidad debe ser mayor que cero.").max(1_000_000) }))
  .max(40, "Una labor admite hasta 40 materiales.");

/**
 * Crea una labor, o la corrige si viene con `id`. Sus materiales se descuentan del inventario cuando
 * queda HECHA; si ya estaba hecha y se cambian los materiales, primero se devuelve lo anterior y luego
 * se descuenta lo nuevo.
 */
export async function guardarLabor(_prev: ResultadoLabores | null, formData: FormData): Promise<ResultadoLabores> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "inventario")) return { ok: false, error: SIN_PLAN };

  const parsed = laborSchema.safeParse({
    titulo: formData.get("titulo"),
    descripcion: aTexto(formData.get("descripcion")),
    tipo: formData.get("tipo"),
    lugar: aTexto(formData.get("lugar")),
    estado: formData.get("estado"),
    fecha: formData.get("fecha"),
    fechaTermino: aTexto(formData.get("fechaTermino")),
    hora: aTexto(formData.get("hora")),
    horaFin: aTexto(formData.get("horaFin")),
    responsable: aTexto(formData.get("responsable")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  let crudas: unknown;
  try {
    crudas = JSON.parse(String(formData.get("materiales") ?? "[]"));
  } catch {
    return { ok: false, error: "Los materiales no son válidos." };
  }
  const lineasParse = lineasSchema.safeParse(crudas);
  if (!lineasParse.success) return { ok: false, error: lineasParse.error.issues[0].message };

  // Un mismo material repetido se suma en una sola línea.
  const porMaterial = new Map<string, number>();
  for (const l of lineasParse.data) porMaterial.set(l.insumoId, (porMaterial.get(l.insumoId) ?? 0) + l.cantidad);

  const d = parsed.data;
  // Hecha: la fecha en que se terminó. Antes de eso, la fecha en que se programó que termine (si se puso).
  const fechaTermino = d.estado === "HECHA" ? (d.fechaTermino ?? hoyEnChile()) : d.fechaTermino;
  if (d.estado !== "HECHA" && d.fechaTermino && `${d.fechaTermino} ${d.horaFin ?? "23:59"}` < `${d.fecha} ${d.hora ?? "00:00"}`) {
    return { ok: false, error: "El término no puede ser antes del inicio." };
  }
  const horaFin = d.estado === "HECHA" ? null : d.fechaTermino ? d.horaFin : null;
  const id = String(formData.get("id") ?? "");
  const ctx = { aprId: apr.id, userId: user.id };

  try {
    const r = await db.transaction(async (tx) => {
      // Los materiales tienen que ser de este comité.
      const ids = [...porMaterial.keys()];
      const delInventario = ids.length
        ? await tx.select({ id: insumos.id, nombre: insumos.nombre, unidad: insumos.unidad, costo: insumos.costo }).from(insumos).where(and(eq(insumos.aprId, apr.id), inArray(insumos.id, ids)))
        : [];
      if (delInventario.length !== ids.length) throw new ErrorLabor("Alguno de los materiales ya no está en el inventario.");

      let laborId = id;
      let numero = 0;
      let eraDescontada = false;

      if (id) {
        const [actual] = await tx
          .select({ numero: labores.numero, descontada: labores.descontada })
          .from(labores)
          .where(and(eq(labores.id, id), eq(labores.aprId, apr.id)))
          .limit(1);
        if (!actual) throw new ErrorLabor("No encontramos esa labor.");
        numero = actual.numero;
        eraDescontada = actual.descontada;
        // Primero se devuelve lo que ya se había descontado: lo nuevo se descuenta desde cero.
        if (eraDescontada) await devolverStock(tx, ctx, { id, numero });
      } else {
        const [{ m }] = await tx
          .select({ m: sql<number>`coalesce(max(${labores.numero}), 0)::int` })
          .from(labores)
          .where(eq(labores.aprId, apr.id));
        numero = m + 1;
      }

      const valores = { ...d, fechaTermino, horaFin, descontada: false, updatedAt: new Date() };
      if (id) {
        await tx.update(labores).set(valores).where(and(eq(labores.id, id), eq(labores.aprId, apr.id)));
        await tx.delete(laborInsumos).where(eq(laborInsumos.laborId, id));
      } else {
        const [creada] = await tx.insert(labores).values({ ...valores, aprId: apr.id, numero }).returning({ id: labores.id });
        laborId = creada.id;
      }

      if (delInventario.length) {
        await tx.insert(laborInsumos).values(
          delInventario.map((m) => ({
            laborId,
            aprId: apr.id,
            insumoId: m.id,
            insumoNombre: m.nombre,
            unidad: m.unidad,
            cantidad: porMaterial.get(m.id) ?? 0,
            costoUnitario: m.costo,
          }))
        );
      }

      if (d.estado === "HECHA") {
        await descontarStock(tx, ctx, { id: laborId, numero });
        await tx.update(labores).set({ descontada: true }).where(eq(labores.id, laborId));
      }
      return { ok: true as const };
    });
    refrescar();
    return r;
  } catch (e) {
    if (e instanceof ErrorLabor) return { ok: false, error: e.message };
    console.error("Labores: no se pudo guardar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar la labor. Inténtalo de nuevo en un momento.") };
  }
}

/** Mueve una labor de estado (desde el tablero). Al pasar a Hecha descuenta el inventario; al sacarla de Hecha, lo devuelve. */
export async function cambiarEstadoLabor(id: string, estado: "PROGRAMADA" | "EN_CURSO" | "HECHA"): Promise<ResultadoLabores> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "inventario")) return { ok: false, error: SIN_PLAN };
  if (!["PROGRAMADA", "EN_CURSO", "HECHA"].includes(estado)) return { ok: false, error: "El estado no es válido." };
  const ctx = { aprId: apr.id, userId: user.id };

  try {
    await db.transaction(async (tx) => {
      const [actual] = await tx
        .select({ numero: labores.numero, descontada: labores.descontada, fechaTermino: labores.fechaTermino, fecha: labores.fecha, hora: labores.hora })
        .from(labores)
        .where(and(eq(labores.id, id), eq(labores.aprId, apr.id)))
        .limit(1);
      if (!actual) throw new ErrorLabor("No encontramos esa labor.");

      // Una labor cuya hora ya pasó no puede quedar «Programada»: se adelantaría sola. Para posponerla, se le cambia la fecha u hora.
      if (estado === "PROGRAMADA") {
        const ahora = ahoraEnChile();
        if (`${actual.fecha} ${actual.hora ?? "00:00"}` <= `${ahora.fecha} ${ahora.hora}`) {
          throw new ErrorLabor("Ya pasó la hora de inicio de esta labor. Para posponerla, cámbiale la fecha u hora.");
        }
      }

      let descontada = actual.descontada;
      if (estado === "HECHA" && !descontada) {
        await descontarStock(tx, ctx, { id, numero: actual.numero });
        descontada = true;
      } else if (estado !== "HECHA" && descontada) {
        await devolverStock(tx, ctx, { id, numero: actual.numero });
        descontada = false;
      }

      await tx
        .update(labores)
        .set({ estado, descontada, fechaTermino: estado === "HECHA" ? (actual.fechaTermino ?? hoyEnChile()) : null, horaFin: null, updatedAt: new Date() })
        .where(and(eq(labores.id, id), eq(labores.aprId, apr.id)));
    });
  } catch (e) {
    if (e instanceof ErrorLabor) return { ok: false, error: e.message };
    console.error("Labores: no se pudo cambiar el estado:", e);
    return { ok: false, error: mensajeError(e, "No pudimos cambiar el estado. Inténtalo de nuevo en un momento.") };
  }

  refrescar();
  return { ok: true };
}

/** Borra una labor. Si ya había descontado materiales, vuelven al inventario. */
export async function eliminarLabor(id: string): Promise<ResultadoLabores> {
  const { user, apr } = await requireAdmin();
  const ctx = { aprId: apr.id, userId: user.id };

  try {
    await db.transaction(async (tx) => {
      const [actual] = await tx
        .select({ numero: labores.numero, descontada: labores.descontada })
        .from(labores)
        .where(and(eq(labores.id, id), eq(labores.aprId, apr.id)))
        .limit(1);
      if (!actual) throw new ErrorLabor("No encontramos esa labor.");
      if (actual.descontada) await devolverStock(tx, ctx, { id, numero: actual.numero });
      await tx.delete(labores).where(and(eq(labores.id, id), eq(labores.aprId, apr.id)));
    });
  } catch (e) {
    if (e instanceof ErrorLabor) return { ok: false, error: e.message };
    console.error("Labores: no se pudo borrar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos borrar la labor. Inténtalo de nuevo en un momento.") };
  }

  refrescar();
  return { ok: true };
}
