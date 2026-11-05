"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { incidentes, movimientos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { diaCerrado, mensajeDiaCerrado } from "@/lib/finanzas";
import { PREFIJO_CONCEPTO_INCIDENTE, TIPOS_INCIDENTE } from "@/lib/incidentes-comun";

export type ResultadoIncidentes = { ok: true } | { ok: false; error: string };

const SIN_PLAN = "Incidentes está disponible desde el plan Estándar.";
const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const aEntero = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[^\d]/g, "")) || 0;

function refrescar() {
  revalidatePath("/panel/incidentes");
  revalidatePath("/panel/caja");
}

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.");

const incidenteSchema = z.object({
  titulo: z.string().trim().min(1, "Escribe qué pasó.").max(140),
  descripcion: z.string().trim().max(1000).nullable(),
  tipo: z.string().refine((t) => TIPOS_INCIDENTE.some((x) => x.valor === t), "El tipo no es válido."),
  lugar: z.string().trim().max(160).nullable(),
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA"]),
  estado: z.enum(["ABIERTO", "EN_REPARACION", "RESUELTO"]),
  fecha,
  fechaResolucion: fecha.nullable(),
  responsable: z.string().trim().max(120).nullable(),
  solucion: z.string().trim().max(1000).nullable(),
  costo: z.number().int().min(0).max(1_000_000_000),
});

/**
 * Crea un incidente, o lo corrige si viene con `id`. Si se marca «registrar el costo en Caja», la
 * reparación queda como egreso (y si el costo cambia después, el egreso se ajusta).
 */
export async function guardarIncidente(_prev: ResultadoIncidentes | null, formData: FormData): Promise<ResultadoIncidentes> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "incidentes")) return { ok: false, error: SIN_PLAN };

  const parsed = incidenteSchema.safeParse({
    titulo: formData.get("titulo"),
    descripcion: aTexto(formData.get("descripcion")),
    tipo: formData.get("tipo"),
    lugar: aTexto(formData.get("lugar")),
    prioridad: formData.get("prioridad"),
    estado: formData.get("estado"),
    fecha: formData.get("fecha"),
    fechaResolucion: aTexto(formData.get("fechaResolucion")),
    responsable: aTexto(formData.get("responsable")),
    solucion: aTexto(formData.get("solucion")),
    costo: aEntero(formData.get("costo")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  // Un incidente resuelto siempre tiene fecha de resolución; uno que se reabre la pierde.
  const fechaResolucion = d.estado === "RESUELTO" ? (d.fechaResolucion ?? hoyEnChile()) : null;
  const registrarCosto = formData.get("registrarCosto") === "si";
  const id = String(formData.get("id") ?? "");

  try {
    const r = await db.transaction(async (tx) => {
      let numero = 0;
      let movimientoId: string | null = null;

      if (id) {
        const [actual] = await tx
          .select({ numero: incidentes.numero, movimientoId: incidentes.movimientoId })
          .from(incidentes)
          .where(and(eq(incidentes.id, id), eq(incidentes.aprId, apr.id)))
          .limit(1);
        if (!actual) return { ok: false as const, error: "No encontramos ese incidente." };
        numero = actual.numero;
        movimientoId = actual.movimientoId;
      } else {
        const [{ m }] = await tx
          .select({ m: sql<number>`coalesce(max(${incidentes.numero}), 0)::int` })
          .from(incidentes)
          .where(eq(incidentes.aprId, apr.id));
        numero = m + 1;
      }

      // El costo en Caja: se crea, se ajusta o se quita según lo que se pidió.
      const diaEgreso = fechaResolucion ?? d.fecha;
      if (movimientoId) {
        const [mov] = await tx
          .select({ fecha: movimientos.fecha })
          .from(movimientos)
          .where(and(eq(movimientos.id, movimientoId), eq(movimientos.aprId, apr.id)))
          .limit(1);
        if (mov && (await diaCerrado(tx, apr.id, mov.fecha))) {
          return { ok: false as const, error: mensajeDiaCerrado(mov.fecha) };
        }
        if (d.costo > 0) {
          await tx
            .update(movimientos)
            .set({ monto: d.costo, fecha: diaEgreso })
            .where(and(eq(movimientos.id, movimientoId), eq(movimientos.aprId, apr.id)));
        } else {
          await tx.delete(movimientos).where(and(eq(movimientos.id, movimientoId), eq(movimientos.aprId, apr.id)));
          movimientoId = null;
        }
      } else if (registrarCosto && d.costo > 0) {
        if (await diaCerrado(tx, apr.id, diaEgreso)) return { ok: false as const, error: mensajeDiaCerrado(diaEgreso) };
        const [egreso] = await tx
          .insert(movimientos)
          .values({
            aprId: apr.id,
            tipo: "EGRESO",
            fecha: diaEgreso,
            monto: d.costo,
            categoria: "REPARACIONES",
            concepto: `${PREFIJO_CONCEPTO_INCIDENTE}${numero}: ${d.titulo}`.slice(0, 200),
            medio: "EFECTIVO",
            contraparte: d.responsable,
            registradoPorId: user.id,
          })
          .returning({ id: movimientos.id });
        movimientoId = egreso.id;
      }

      const valores = { ...d, fechaResolucion, movimientoId, updatedAt: new Date() };
      if (id) {
        await tx.update(incidentes).set(valores).where(and(eq(incidentes.id, id), eq(incidentes.aprId, apr.id)));
      } else {
        await tx.insert(incidentes).values({ ...valores, aprId: apr.id, numero });
      }
      return { ok: true as const };
    });
    if (r.ok) refrescar();
    return r;
  } catch (e) {
    console.error("Incidentes: no se pudo guardar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar el incidente. Inténtalo de nuevo en un momento.") };
  }
}

/** Borra un incidente y, si su costo estaba en Caja, también ese egreso (salvo que el día esté cerrado). */
export async function eliminarIncidente(id: string): Promise<ResultadoIncidentes> {
  const { apr } = await requireAdmin();

  try {
    const r = await db.transaction(async (tx) => {
      const [inc] = await tx
        .select({ movimientoId: incidentes.movimientoId })
        .from(incidentes)
        .where(and(eq(incidentes.id, id), eq(incidentes.aprId, apr.id)))
        .limit(1);
      if (!inc) return { ok: false as const, error: "No encontramos ese incidente." };

      if (inc.movimientoId) {
        const [mov] = await tx
          .select({ fecha: movimientos.fecha })
          .from(movimientos)
          .where(and(eq(movimientos.id, inc.movimientoId), eq(movimientos.aprId, apr.id)))
          .limit(1);
        if (mov && (await diaCerrado(tx, apr.id, mov.fecha))) return { ok: false as const, error: mensajeDiaCerrado(mov.fecha) };
        await tx.delete(movimientos).where(and(eq(movimientos.id, inc.movimientoId), eq(movimientos.aprId, apr.id)));
      }
      await tx.delete(incidentes).where(and(eq(incidentes.id, id), eq(incidentes.aprId, apr.id)));
      return { ok: true as const };
    });
    if (r.ok) refrescar();
    return r;
  } catch (e) {
    console.error("Incidentes: no se pudo borrar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos borrar el incidente. Inténtalo de nuevo en un momento.") };
  }
}

/** Mueve un incidente a otro estado (desde el tablero). Al resolverlo anota la fecha de hoy; al reabrirlo, la quita. */
export async function cambiarEstadoIncidente(id: string, estado: "ABIERTO" | "EN_REPARACION" | "RESUELTO"): Promise<ResultadoIncidentes> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "incidentes")) return { ok: false, error: SIN_PLAN };
  if (!["ABIERTO", "EN_REPARACION", "RESUELTO"].includes(estado)) return { ok: false, error: "El estado no es válido." };

  const [actual] = await db
    .select({ estado: incidentes.estado, fechaResolucion: incidentes.fechaResolucion })
    .from(incidentes)
    .where(and(eq(incidentes.id, id), eq(incidentes.aprId, apr.id)))
    .limit(1);
  if (!actual) return { ok: false, error: "No encontramos ese incidente." };

  await db
    .update(incidentes)
    .set({
      estado,
      fechaResolucion: estado === "RESUELTO" ? (actual.fechaResolucion ?? hoyEnChile()) : null,
      updatedAt: new Date(),
    })
    .where(and(eq(incidentes.id, id), eq(incidentes.aprId, apr.id)));

  refrescar();
  return { ok: true };
}
