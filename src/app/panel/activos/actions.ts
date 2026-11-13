"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { activosFijos, labores, movimientos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";
import { CATEGORIAS_ACTIVO, PREFIJO_CONCEPTO_ACTIVO, type ActivoFila } from "@/lib/activos-comun";
import { listarActivos } from "@/lib/activos";
import { diaCerrado, mensajeDiaCerrado } from "@/lib/finanzas";
import { hoyEnChile } from "@/lib/finanzas-comun";

export type ResultadoActivos = { ok: true } | { ok: false; error: string };

/** Los activos del comité, para que la pantalla los vuelva a pedir sin recargar la página (la usa TanStack Query). */
export async function consultarActivos(): Promise<ActivoFila[]> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "activos")) return [];
  return listarActivos(apr.id);
}

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
  proximaMantencion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de la próxima mantención no es válida.").nullable(),
});

/** Crea un activo fijo, o lo corrige si viene con `id`. */
export async function guardarActivo(_prev: ResultadoActivos | null, formData: FormData): Promise<ResultadoActivos> {
  const { user, apr } = await requireAdmin();
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
    proximaMantencion: aTexto(formData.get("proximaMantencion")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const registrarCosto = formData.get("registrarCosto") === "si";
  const id = String(formData.get("id") ?? "");

  try {
    const r = await db.transaction(async (tx) => {
      let movimientoId: string | null = null;
      // Si ya estaba en reparación se conserva su fecha y motivo; si recién entra, parte hoy; si sale, se limpian.
      let reparacion: { reparacionDesde: string | null; reparacionMotivo: string | null } | null = null;

      if (id) {
        const [actual] = await tx
          .select({ movimientoId: activosFijos.movimientoId, estado: activosFijos.estado })
          .from(activosFijos)
          .where(and(eq(activosFijos.id, id), eq(activosFijos.aprId, apr.id)))
          .limit(1);
        if (!actual) return { ok: false as const, error: "No encontramos ese bien." };
        movimientoId = actual.movimientoId;
        if (d.estado !== "EN_REPARACION") reparacion = { reparacionDesde: null, reparacionMotivo: null };
        else if (actual.estado !== "EN_REPARACION") reparacion = { reparacionDesde: hoyEnChile(), reparacionMotivo: null };
      } else if (d.estado === "EN_REPARACION") {
        reparacion = { reparacionDesde: hoyEnChile(), reparacionMotivo: null };
      }

      // El costo en Caja: se crea, se ajusta o se quita según lo que se pidió.
      if (movimientoId) {
        const [mov] = await tx
          .select({ fecha: movimientos.fecha })
          .from(movimientos)
          .where(and(eq(movimientos.id, movimientoId), eq(movimientos.aprId, apr.id)))
          .limit(1);
        if (mov && (await diaCerrado(tx, apr.id, mov.fecha))) return { ok: false as const, error: mensajeDiaCerrado(mov.fecha) };
        if (d.costo > 0) {
          if (await diaCerrado(tx, apr.id, d.fechaAdquisicion)) return { ok: false as const, error: mensajeDiaCerrado(d.fechaAdquisicion) };
          await tx
            .update(movimientos)
            .set({ monto: d.costo, fecha: d.fechaAdquisicion, concepto: `${PREFIJO_CONCEPTO_ACTIVO}${d.nombre}`.slice(0, 200) })
            .where(and(eq(movimientos.id, movimientoId), eq(movimientos.aprId, apr.id)));
        } else {
          await tx.delete(movimientos).where(and(eq(movimientos.id, movimientoId), eq(movimientos.aprId, apr.id)));
          movimientoId = null;
        }
      } else if (registrarCosto && d.costo > 0) {
        if (await diaCerrado(tx, apr.id, d.fechaAdquisicion)) return { ok: false as const, error: mensajeDiaCerrado(d.fechaAdquisicion) };
        const [egreso] = await tx
          .insert(movimientos)
          .values({
            aprId: apr.id,
            tipo: "EGRESO",
            fecha: d.fechaAdquisicion,
            monto: d.costo,
            categoria: "ACTIVOS",
            concepto: `${PREFIJO_CONCEPTO_ACTIVO}${d.nombre}`.slice(0, 200),
            medio: "EFECTIVO",
            registradoPorId: user.id,
          })
          .returning({ id: movimientos.id });
        movimientoId = egreso.id;
      }

      if (id) {
        await tx.update(activosFijos).set({ ...d, movimientoId, ...(reparacion ?? {}) }).where(and(eq(activosFijos.id, id), eq(activosFijos.aprId, apr.id)));
      } else {
        await tx.insert(activosFijos).values({ ...d, movimientoId, ...(reparacion ?? {}), aprId: apr.id });
      }
      return { ok: true as const };
    });
    if (!r.ok) return r;
  } catch (e) {
    console.error("Activos: no se pudo guardar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar. Inténtalo de nuevo en un momento.") };
  }

  revalidatePath("/panel/activos");
  revalidatePath("/panel/caja");
  return { ok: true };
}

/** Borra un activo (por ejemplo, uno cargado por error). Si su costo estaba en Caja, también se quita ese egreso. */
export async function eliminarActivo(id: string): Promise<ResultadoActivos> {
  const { apr } = await requireAdmin();

  try {
    const r = await db.transaction(async (tx) => {
      const [activo] = await tx
        .select({ movimientoId: activosFijos.movimientoId })
        .from(activosFijos)
        .where(and(eq(activosFijos.id, id), eq(activosFijos.aprId, apr.id)))
        .limit(1);
      if (!activo) return { ok: false as const, error: "No encontramos ese bien." };

      if (activo.movimientoId) {
        const [mov] = await tx
          .select({ fecha: movimientos.fecha })
          .from(movimientos)
          .where(and(eq(movimientos.id, activo.movimientoId), eq(movimientos.aprId, apr.id)))
          .limit(1);
        if (mov && (await diaCerrado(tx, apr.id, mov.fecha))) return { ok: false as const, error: mensajeDiaCerrado(mov.fecha) };
        await tx.delete(movimientos).where(and(eq(movimientos.id, activo.movimientoId), eq(movimientos.aprId, apr.id)));
      }
      await tx.delete(activosFijos).where(and(eq(activosFijos.id, id), eq(activosFijos.aprId, apr.id)));
      return { ok: true as const };
    });
    if (!r.ok) return r;
  } catch (e) {
    console.error("Activos: no se pudo borrar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos borrar el bien. Inténtalo de nuevo en un momento.") };
  }

  revalidatePath("/panel/activos");
  revalidatePath("/panel/caja");
  return { ok: true };
}

/** Cambia solo el estado de un bien (por ejemplo, lo manda a reparación o lo vuelve a dejar operativo), sin tocar el resto. */
export async function cambiarEstadoActivo(id: string, estado: "OPERATIVO" | "EN_REPARACION" | "BAJA", motivo?: string): Promise<ResultadoActivos> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "activos")) return { ok: false, error: "Activos fijos está disponible desde el plan Estándar." };
  if (!["OPERATIVO", "EN_REPARACION", "BAJA"].includes(estado)) return { ok: false, error: "El estado no es válido." };

  try {
    const cambiados = await db
      .update(activosFijos)
      .set(
        estado === "EN_REPARACION"
          ? { estado, reparacionDesde: hoyEnChile(), reparacionMotivo: (motivo ?? "").trim().slice(0, 200) || null }
          : { estado, reparacionDesde: null, reparacionMotivo: null }
      )
      .where(and(eq(activosFijos.id, id), eq(activosFijos.aprId, apr.id)))
      .returning({ id: activosFijos.id });
    if (cambiados.length === 0) return { ok: false, error: "No encontramos ese bien." };
  } catch (e) {
    console.error("Activos: no se pudo cambiar el estado:", e);
    return { ok: false, error: mensajeError(e, "No pudimos cambiar el estado. Inténtalo de nuevo en un momento.") };
  }

  revalidatePath("/panel/activos");
  return { ok: true };
}

/** Convierte la próxima mantención de un bien en una labor programada (Labores) y dice qué número quedó. */
export async function programarLaborMantencion(id: string): Promise<{ ok: true; numero: number } | { ok: false; error: string }> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "activos")) return { ok: false, error: "Activos fijos está disponible desde el plan Estándar." };
  if (!puede(apr.plan as Plan, "inventario")) return { ok: false, error: "Labores está disponible desde el plan Estándar." };

  try {
    const r = await db.transaction(async (tx) => {
      const [a] = await tx
        .select({ nombre: activosFijos.nombre, ubicacion: activosFijos.ubicacion, responsable: activosFijos.responsable, fecha: activosFijos.proximaMantencion })
        .from(activosFijos)
        .where(and(eq(activosFijos.id, id), eq(activosFijos.aprId, apr.id)))
        .limit(1);
      if (!a) return { ok: false as const, error: "No encontramos ese bien." };
      if (!a.fecha) return { ok: false as const, error: "Este bien no tiene fecha de próxima mantención." };

      const [{ m }] = await tx
        .select({ m: sql<number>`coalesce(max(${labores.numero}), 0)::int` })
        .from(labores)
        .where(eq(labores.aprId, apr.id));
      const numero = m + 1;
      await tx.insert(labores).values({
        aprId: apr.id,
        numero,
        titulo: `Mantención de ${a.nombre}`.slice(0, 140),
        tipo: "MANTENCION",
        lugar: a.ubicacion,
        estado: "PROGRAMADA",
        fecha: a.fecha,
        responsable: a.responsable,
      });
      return { ok: true as const, numero };
    });
    if (r.ok) revalidatePath("/panel/labores");
    return r;
  } catch (e) {
    console.error("Activos: no se pudo programar la labor:", e);
    return { ok: false, error: mensajeError(e, "No pudimos programar la labor. Inténtalo de nuevo en un momento.") };
  }
}
