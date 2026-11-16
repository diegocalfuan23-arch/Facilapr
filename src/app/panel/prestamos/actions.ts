"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { movimientos, prestamoAbonos, prestamoDescuentos, prestamos, trabajadores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { diaCerrado, mensajeDiaCerrado } from "@/lib/finanzas";
import { MEDIOS_ENTREGA, PREFIJO_CONCEPTO_ANTICIPO, PREFIJO_CONCEPTO_PRESTAMO } from "@/lib/prestamos-comun";

export type ResultadoPrestamos = { ok: true } | { ok: false; error: string };

const SIN_PLAN = "Remuneraciones está disponible en el plan Grande.";
const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const medioValido = (v: FormDataEntryValue | null) => MEDIOS_ENTREGA.find((m) => m.valor === v)?.valor ?? "EFECTIVO";

function refrescar() {
  revalidatePath("/panel/prestamos");
  revalidatePath("/panel/remuneraciones");
  revalidatePath("/panel/caja");
}

const prestamoSchema = z.object({
  trabajadorId: z.string().min(1, "Elige a la persona.").max(64),
  tipo: z.enum(["ANTICIPO", "PRESTAMO"]),
  monto: z.number().int("El monto debe ser un número entero.").min(1, "Escribe cuánto es.").max(100_000_000),
  cuotas: z.number().int().min(1, "Las cuotas deben ser al menos 1.").max(60, "Máximo 60 cuotas."),
  primerPeriodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes de la primera cuota no es válido."),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
  nota: z.string().trim().max(200).nullable(),
});

/**
 * Registra un anticipo o un préstamo a una persona del personal. Sus cuotas se descuentan solas al armar
 * cada mes en Remuneraciones. Si se marca, la entrega queda como egreso en la Caja.
 */
export async function crearPrestamo(_prev: ResultadoPrestamos | null, formData: FormData): Promise<ResultadoPrestamos> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: SIN_PLAN };

  const tipo = formData.get("tipo");
  const parsed = prestamoSchema.safeParse({
    trabajadorId: formData.get("trabajadorId"),
    tipo,
    monto: Number(String(formData.get("monto") ?? "").replace(/[^\d]/g, "")),
    // Un anticipo se descuenta de una vez.
    cuotas: tipo === "ANTICIPO" ? 1 : Number(formData.get("cuotas")) || 1,
    primerPeriodo: formData.get("primerPeriodo"),
    fecha: formData.get("fecha"),
    nota: aTexto(formData.get("nota")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.fecha > hoyEnChile()) return { ok: false, error: "La fecha de entrega no puede ser futura." };
  const registrarEnCaja = formData.get("registrarEnCaja") === "si";
  const medioEntrega = medioValido(formData.get("medioEntrega"));
  const autorizacionFirmada = formData.get("autorizacionFirmada") === "si";

  try {
    const r = await db.transaction(async (tx) => {
      const [persona] = await tx
        .select({ nombre: trabajadores.nombre })
        .from(trabajadores)
        .where(and(eq(trabajadores.id, d.trabajadorId), eq(trabajadores.aprId, apr.id)))
        .limit(1);
      if (!persona) return { ok: false as const, error: "No encontramos a esa persona." };

      let movimientoId: string | null = null;
      if (registrarEnCaja) {
        if (await diaCerrado(tx, apr.id, d.fecha)) return { ok: false as const, error: mensajeDiaCerrado(d.fecha) };
        const prefijo = d.tipo === "ANTICIPO" ? PREFIJO_CONCEPTO_ANTICIPO : PREFIJO_CONCEPTO_PRESTAMO;
        const [egreso] = await tx
          .insert(movimientos)
          .values({
            aprId: apr.id,
            tipo: "EGRESO",
            fecha: d.fecha,
            monto: d.monto,
            categoria: "REMUNERACIONES",
            concepto: `${prefijo}${persona.nombre}`.slice(0, 200),
            medio: medioEntrega,
            contraparte: persona.nombre,
            registradoPorId: user.id,
          })
          .returning({ id: movimientos.id });
        movimientoId = egreso.id;
      }

      // El siguiente número de su tipo (P-04, A-08…). Si dos se guardan a la vez, el índice único hace fallar uno y se reintenta.
      const [ultimo] = await tx
        .select({ n: sql<number>`coalesce(max(${prestamos.numero}), 0)::int` })
        .from(prestamos)
        .where(and(eq(prestamos.aprId, apr.id), eq(prestamos.tipo, d.tipo)));

      await tx.insert(prestamos).values({
        aprId: apr.id,
        numero: (ultimo?.n ?? 0) + 1,
        autorizacionFirmada,
        medioEntrega,
        trabajadorId: d.trabajadorId,
        tipo: d.tipo,
        monto: d.monto,
        cuotas: d.cuotas,
        // La última cuota se ajusta sola para no pasarse del total.
        cuotaMonto: Math.ceil(d.monto / d.cuotas),
        primerPeriodo: d.primerPeriodo,
        fecha: d.fecha,
        nota: d.nota,
        movimientoId,
      });
      return { ok: true as const };
    });
    if (r.ok) refrescar();
    return r;
  } catch (e) {
    console.error("Préstamos: no se pudo guardar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar. Inténtalo de nuevo en un momento.") };
  }
}

/** Deja de descontar un préstamo (por ejemplo, si se condona lo que falta). Lo ya descontado queda como está. */
export async function cerrarPrestamo(id: string): Promise<ResultadoPrestamos> {
  const { apr } = await requireAdmin();

  const [cerrado] = await db
    .update(prestamos)
    .set({ estado: "CERRADO" })
    .where(and(eq(prestamos.id, id), eq(prestamos.aprId, apr.id)))
    .returning({ id: prestamos.id });
  if (!cerrado) return { ok: false, error: "No encontramos ese registro." };

  refrescar();
  return { ok: true };
}

/** Borra un préstamo que todavía no se descontó en ninguna liquidación (y su egreso en Caja, si lo tenía). */
export async function eliminarPrestamo(id: string): Promise<ResultadoPrestamos> {
  const { apr } = await requireAdmin();

  try {
    const r = await db.transaction(async (tx) => {
      const [p] = await tx
        .select({ movimientoId: prestamos.movimientoId })
        .from(prestamos)
        .where(and(eq(prestamos.id, id), eq(prestamos.aprId, apr.id)))
        .limit(1);
      if (!p) return { ok: false as const, error: "No encontramos ese registro." };

      const [usado] = await tx.select({ id: prestamoDescuentos.id }).from(prestamoDescuentos).where(eq(prestamoDescuentos.prestamoId, id)).limit(1);
      if (usado) return { ok: false as const, error: "Ya se descontó en una liquidación: no se puede borrar. Ciérralo para dejar de descontar." };
      const [abonado] = await tx.select({ id: prestamoAbonos.id }).from(prestamoAbonos).where(eq(prestamoAbonos.prestamoId, id)).limit(1);
      if (abonado) return { ok: false as const, error: "Ya tiene abonos: no se puede borrar. Ciérralo para dejar de descontar." };

      if (p.movimientoId) {
        const [mov] = await tx
          .select({ fecha: movimientos.fecha })
          .from(movimientos)
          .where(and(eq(movimientos.id, p.movimientoId), eq(movimientos.aprId, apr.id)))
          .limit(1);
        if (mov && (await diaCerrado(tx, apr.id, mov.fecha))) return { ok: false as const, error: mensajeDiaCerrado(mov.fecha) };
        await tx.delete(movimientos).where(and(eq(movimientos.id, p.movimientoId), eq(movimientos.aprId, apr.id)));
      }
      await tx.delete(prestamos).where(and(eq(prestamos.id, id), eq(prestamos.aprId, apr.id)));
      return { ok: true as const };
    });
    if (r.ok) refrescar();
    return r;
  } catch (e) {
    console.error("Préstamos: no se pudo borrar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos borrar. Inténtalo de nuevo en un momento.") };
  }
}

/** Deja anotado que el trabajador ya firmó la autorización de descuento. */
export async function marcarAutorizacionFirmada(id: string): Promise<ResultadoPrestamos> {
  const { apr } = await requireAdmin();

  const [p] = await db
    .update(prestamos)
    .set({ autorizacionFirmada: true })
    .where(and(eq(prestamos.id, id), eq(prestamos.aprId, apr.id)))
    .returning({ id: prestamos.id });
  if (!p) return { ok: false, error: "No encontramos ese registro." };

  refrescar();
  return { ok: true };
}

/**
 * La persona devuelve parte o todo lo que falta antes de tiempo. Baja el saldo (y por eso Remuneraciones deja de
 * descontar eso) y, si se marca, entra a la Caja como ingreso.
 */
export async function abonarPrestamo(
  _prev: ResultadoPrestamos | null,
  formData: FormData
): Promise<ResultadoPrestamos> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: SIN_PLAN };

  const id = String(formData.get("prestamoId") ?? "");
  const monto = Number(String(formData.get("monto") ?? "").replace(/[^\d]/g, ""));
  const fecha = String(formData.get("fecha") ?? "");
  const medio = medioValido(formData.get("medio"));
  const nota = aTexto(formData.get("nota"));
  const registrarEnCaja = formData.get("registrarEnCaja") === "si";

  if (!Number.isInteger(monto) || monto < 1) return { ok: false, error: "Escribe cuánto abona." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "La fecha no es válida." };
  if (fecha > hoyEnChile()) return { ok: false, error: "La fecha del abono no puede ser futura." };

  try {
    const r = await db.transaction(async (tx) => {
      const [p] = await tx
        .select({ id: prestamos.id, monto: prestamos.monto, tipo: prestamos.tipo, numero: prestamos.numero, trabajador: trabajadores.nombre })
        .from(prestamos)
        .innerJoin(trabajadores, eq(trabajadores.id, prestamos.trabajadorId))
        .where(and(eq(prestamos.id, id), eq(prestamos.aprId, apr.id)))
        .limit(1);
      if (!p) return { ok: false as const, error: "No encontramos ese registro." };

      const [descontado] = await tx.select({ n: sql<number>`coalesce(sum(${prestamoDescuentos.monto}), 0)::int` }).from(prestamoDescuentos).where(eq(prestamoDescuentos.prestamoId, id));
      const [abonado] = await tx.select({ n: sql<number>`coalesce(sum(${prestamoAbonos.monto}), 0)::int` }).from(prestamoAbonos).where(eq(prestamoAbonos.prestamoId, id));
      const saldo = p.monto - (descontado?.n ?? 0) - (abonado?.n ?? 0);
      if (saldo <= 0) return { ok: false as const, error: "Este préstamo ya está saldado." };
      if (monto > saldo) return { ok: false as const, error: `El abono supera lo que falta por descontar (${saldo.toLocaleString("es-CL")}).` };

      let movimientoId: string | null = null;
      if (registrarEnCaja) {
        if (await diaCerrado(tx, apr.id, fecha)) return { ok: false as const, error: mensajeDiaCerrado(fecha) };
        const [ingreso] = await tx
          .insert(movimientos)
          .values({
            aprId: apr.id,
            tipo: "INGRESO",
            fecha,
            monto,
            categoria: "OTRO_INGRESO",
            concepto: `Abono · ${p.tipo === "ANTICIPO" ? "Anticipo" : "Préstamo"} · ${p.trabajador}`.slice(0, 200),
            medio,
            contraparte: p.trabajador,
            registradoPorId: user.id,
          })
          .returning({ id: movimientos.id });
        movimientoId = ingreso.id;
      }

      await tx.insert(prestamoAbonos).values({ prestamoId: id, monto, fecha, medio, nota, movimientoId, registradoPorId: user.id });
      return { ok: true as const };
    });
    if (r.ok) refrescar();
    return r;
  } catch (e) {
    console.error("Préstamos: no se pudo registrar el abono:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar el abono. Inténtalo de nuevo en un momento.") };
  }
}
