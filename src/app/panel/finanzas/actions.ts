"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { movimientos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import {
  CATEGORIAS_EGRESO,
  CATEGORIAS_INGRESO,
  MEDIOS_MOVIMIENTO,
  TIPO_CIERRE,
  TIPO_SALDO_INICIAL,
  diaValido,
  diaVecino,
  libroDelDia,
  resumenPeriodo,
} from "@/lib/finanzas";

export type ResultadoFinanzas = { ok: true } | { ok: false; error: string };

const movimientoSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
  monto: z.number().int("El monto debe ser un número entero.").min(1, "El monto debe ser mayor que 0.").max(2_000_000_000),
  categoria: z.string().min(1, "Elige una categoría."),
  concepto: z.string().trim().min(1, "Escribe qué fue.").max(200),
  medio: z.string(),
  referencia: z.string().trim().max(80).nullable(),
  contraparte: z.string().trim().max(120).nullable(),
});

const aTexto = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};

/** Anota un ingreso o un egreso del comité. Solo la directiva, y solo con un plan que incluya Finanzas. */
export async function crearMovimiento(
  _prev: ResultadoFinanzas | null,
  formData: FormData
): Promise<ResultadoFinanzas> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) {
    return { ok: false, error: "La Caja está disponible en el plan Grande." };
  }

  const parsed = movimientoSchema.safeParse({
    tipo: formData.get("tipo"),
    fecha: formData.get("fecha"),
    monto: Number(String(formData.get("monto") ?? "").replace(/[^\d]/g, "")),
    categoria: formData.get("categoria"),
    concepto: formData.get("concepto"),
    medio: formData.get("medio"),
    referencia: aTexto(formData.get("referencia")),
    contraparte: aTexto(formData.get("contraparte")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const categorias = d.tipo === "INGRESO" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
  if (!categorias.some((c) => c.valor === d.categoria)) {
    return { ok: false, error: "Esa categoría no corresponde." };
  }
  if (!MEDIOS_MOVIMIENTO.some((m) => m.valor === d.medio)) {
    return { ok: false, error: "El medio de pago no es válido." };
  }

  try {
    await db.insert(movimientos).values({ ...d, aprId: apr.id, registradoPorId: user.id });
  } catch (e) {
    console.error("Finanzas: no se pudo guardar el movimiento:", e);
    return { ok: false, error: "No pudimos guardar el movimiento. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel/caja");
  return { ok: true };
}

/**
 * Define con cuánta plata parte el comité en Facilapr (caja y banco juntos) y desde qué día.
 * Reemplaza al anterior: es un solo saldo de partida por comité.
 */
export async function guardarSaldoInicial(
  _prev: ResultadoFinanzas | null,
  formData: FormData
): Promise<ResultadoFinanzas> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) {
    return { ok: false, error: "La Caja está disponible en el plan Grande." };
  }

  const parsed = z
    .object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
      monto: z.number().int("El monto debe ser un número entero.").min(0, "El saldo no puede ser negativo.").max(2_000_000_000),
    })
    .safeParse({
      fecha: formData.get("fecha"),
      monto: Number(String(formData.get("monto") ?? "").replace(/[^\d]/g, "")),
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(movimientos)
        .where(and(eq(movimientos.aprId, apr.id), eq(movimientos.tipo, TIPO_SALDO_INICIAL)));
      await tx.insert(movimientos).values({
        aprId: apr.id,
        tipo: TIPO_SALDO_INICIAL,
        fecha: parsed.data.fecha,
        monto: parsed.data.monto,
        categoria: TIPO_SALDO_INICIAL,
        concepto: "Saldo inicial",
        registradoPorId: user.id,
      });
    });
  } catch (e) {
    console.error("Finanzas: no se pudo guardar el saldo inicial:", e);
    return { ok: false, error: "No pudimos guardar el saldo inicial. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel/caja");
  return { ok: true };
}

/** Borra un movimiento anotado a mano. Los pagos de socios no se borran desde aquí. */
export async function eliminarMovimiento(id: string): Promise<ResultadoFinanzas> {
  const { apr } = await requireAdmin();

  const borrados = await db
    .delete(movimientos)
    .where(and(eq(movimientos.id, id), eq(movimientos.aprId, apr.id)))
    .returning({ id: movimientos.id });
  if (borrados.length === 0) return { ok: false, error: "No encontramos ese movimiento." };

  revalidatePath("/panel/caja");
  return { ok: true };
}

/**
 * Cierra la caja de un día: deja anotado con cuánta plata se terminó y un comentario.
 * Es una marca de control (igual que en MecánicoApp): no bloquea el día ni mueve plata.
 * Pide que haya saldo inicial, porque sin él no se sabe cuánto había.
 */
export async function cerrarCaja(
  _prev: ResultadoFinanzas | null,
  formData: FormData
): Promise<ResultadoFinanzas> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) {
    return { ok: false, error: "La Caja está disponible en el plan Grande." };
  }

  const dia = diaValido(String(formData.get("dia") ?? ""));
  const comentario = String(formData.get("comentario") ?? "").trim().slice(0, 200);

  const resumen = await resumenPeriodo(apr.id, dia, diaVecino(dia, 1), await libroDelDia(apr.id, dia));
  if (resumen.cierre) return { ok: false, error: "Ese día ya tiene la caja cerrada." };
  if (resumen.disponible === null) {
    return { ok: false, error: "Para cerrar la caja define antes el saldo inicial, anterior o igual a este día." };
  }

  try {
    await db.insert(movimientos).values({
      aprId: apr.id,
      tipo: TIPO_CIERRE,
      fecha: dia,
      monto: resumen.disponible,
      categoria: TIPO_CIERRE,
      concepto: comentario || "Cierre de caja",
      registradoPorId: user.id,
    });
  } catch (e) {
    console.error("Finanzas: no se pudo cerrar la caja:", e);
    return { ok: false, error: "No pudimos cerrar la caja. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel/caja");
  return { ok: true };
}
