"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { movimientos, remuneraciones, trabajadores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";
import { MEDIOS_MOVIMIENTO } from "@/lib/finanzas-comun";
import { diaCerrado, mensajeDiaCerrado } from "@/lib/finanzas";
import { PREFIJO_CONCEPTO_REMUNERACION, descuentoPorDias } from "@/lib/rrhh-comun";
import { horasPorDia, valorDeHoraExtra } from "@/lib/personal-comun";
import { resumenAusenciasMes } from "@/lib/rrhh";
import { descuentosLegales } from "@/lib/personal-comun";
import type { Contrato } from "@/lib/personal-comun";

export type ResultadoRemuneraciones = { ok: true } | { ok: false; error: string };

const SIN_PLAN = "Remuneraciones está disponible desde el plan Estándar.";
const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const aEntero = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[^\d]/g, "")) || 0;
const periodoOk = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p);

function refrescar() {
  revalidatePath("/panel/remuneraciones");
  revalidatePath("/panel/caja");
}

/** Arma las liquidaciones de un mes: una por cada persona activa que todavía no tiene, con su sueldo base. */
export async function generarMes(periodo: string): Promise<ResultadoRemuneraciones> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: SIN_PLAN };
  if (!periodoOk(periodo)) return { ok: false, error: "El mes no es válido." };

  try {
    const personas = await db
      .select({
        id: trabajadores.id,
        sueldo: trabajadores.sueldo,
        valorDia: trabajadores.valorDia,
        porDia: trabajadores.porDia,
        jornadaSemanal: trabajadores.jornadaSemanal,
        diasSemana: trabajadores.diasSemana,
        contrato: trabajadores.contrato,
        afpTasa: trabajadores.afpTasa,
        saludTasa: trabajadores.saludTasa,
        cesantia: trabajadores.cesantia,
      })
      .from(trabajadores)
      .where(and(eq(trabajadores.aprId, apr.id), eq(trabajadores.activo, true)));
    if (personas.length === 0) return { ok: false, error: "Primero agrega a las personas en Personal." };

    // Los días de falta, licencia y permiso sin goce del mes se descuentan solos; las vacaciones se pagan.
    const ausenciasMes = await resumenAusenciasMes(apr.id, periodo);

    await db
      .insert(remuneraciones)
      .values(
        personas.map((p) => {
          // A quien cobra por día se le paga lo que trabajó (según su asistencia); no hay días que descontar.
          const base = p.porDia ? (ausenciasMes[p.id]?.trabajados ?? 0) * (p.valorDia ?? 0) : p.sueldo;
          const dias = p.porDia ? 0 : (ausenciasMes[p.id]?.descontables ?? 0);
          const horas = ausenciasMes[p.id]?.horasPermisoSinGoce ?? 0;
          const descAus = descuentoPorDias(base, dias, p.valorDia, horas, horasPorDia(p));
          const d = descuentosLegales({ ...p, contrato: p.contrato as Contrato }, base - descAus);
          return {
            aprId: apr.id,
            trabajadorId: p.id,
            periodo,
            sueldoBase: base,
            diasDescontados: dias,
            descAusencias: descAus,
            horasDescontadas: horas,
            descAfp: d.afp,
            descSalud: d.salud,
            descCesantia: d.cesantia,
            retencion: d.retencion,
            descuentos: d.total,
            liquido: base - descAus - d.total,
          };
        })
      )
      .onConflictDoNothing();
  } catch (e) {
    console.error("Remuneraciones: no se pudo generar el mes:", e);
    return { ok: false, error: mensajeError(e, "No pudimos armar el mes. Inténtalo de nuevo en un momento.") };
  }

  refrescar();
  return { ok: true };
}

const liquidacionSchema = z.object({
  sueldoBase: z.number().int().min(0).max(100_000_000),
  bonos: z.number().int().min(0).max(100_000_000),
  diasDescontados: z.number().int().min(0).max(30, "Los días descontados no pueden pasar de 30."),
  otrosDescuentos: z.number().int().min(0).max(100_000_000),
  nota: z.string().trim().max(200).nullable(),
  /** Horas de permiso sin goce que se descuentan además de los días. */
  horasDescontadas: z.number().min(0).max(240),
  /** Horas extras del mes. */
  horasExtra: z.number().min(0).max(300),
  /** El valor del día de esta liquidación; 0 = el de la ficha o el sueldo dividido en 30. */
  valorDia: z.number().int().min(0).max(100_000_000),
});

/**
 * Corrige la liquidación de un mes mientras no esté pagada: sueldo bruto, bonos y otros descuentos.
 * La AFP, la salud, el seguro de cesantía y la retención se recalculan con la ficha de la persona.
 */
export async function guardarRemuneracion(_prev: ResultadoRemuneraciones | null, formData: FormData): Promise<ResultadoRemuneraciones> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: SIN_PLAN };

  const parsed = liquidacionSchema.safeParse({
    sueldoBase: aEntero(formData.get("sueldoBase")),
    bonos: aEntero(formData.get("bonos")),
    diasDescontados: aEntero(formData.get("diasDescontados")),
    otrosDescuentos: aEntero(formData.get("otrosDescuentos")),
    nota: aTexto(formData.get("nota")),
    valorDia: aEntero(formData.get("valorDia")),
    horasDescontadas: Number(String(formData.get("horasDescontadas") ?? "").replace(",", ".")) || 0,
    horasExtra: Number(String(formData.get("horasExtra") ?? "").replace(",", ".")) || 0,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const id = String(formData.get("id") ?? "");
  const [actual] = await db
    .select({
      estado: remuneraciones.estado,
      valorDiaFicha: trabajadores.valorDia,
      porDia: trabajadores.porDia,
      jornadaSemanal: trabajadores.jornadaSemanal,
      diasSemana: trabajadores.diasSemana,
      valorHoraExtra: trabajadores.valorHoraExtra,
      contrato: trabajadores.contrato,
      afpTasa: trabajadores.afpTasa,
      saludTasa: trabajadores.saludTasa,
      cesantia: trabajadores.cesantia,
    })
    .from(remuneraciones)
    .innerJoin(trabajadores, eq(trabajadores.id, remuneraciones.trabajadorId))
    .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, apr.id)))
    .limit(1);
  if (!actual) return { ok: false, error: "No encontramos esa liquidación." };
  if (actual.estado === "PAGADA") return { ok: false, error: "Ya está pagada. Deshaz el pago para corregirla." };

  // Lo que no se trabajó se descuenta del sueldo, y sobre lo que queda se calculan la AFP, la salud y lo demás.
  const valorDia = d.valorDia || actual.valorDiaFicha;
  const descAus = descuentoPorDias(d.sueldoBase, d.diasDescontados, valorDia, d.horasDescontadas, horasPorDia(actual));
  // Las horas extras: lo fijado en la ficha o la hora ordinaria con recargo. Cuentan como parte de lo que se gana.
  const montoExtra = Math.round(
    d.horasExtra *
      valorDeHoraExtra({ sueldo: d.sueldoBase, valorDia, porDia: actual.porDia, jornadaSemanal: actual.jornadaSemanal, diasSemana: actual.diasSemana, valorHoraExtra: actual.valorHoraExtra })
  );
  const imponible = Math.max(0, d.sueldoBase - descAus) + d.bonos + montoExtra;
  const legales = descuentosLegales({ ...actual, contrato: actual.contrato as Contrato }, imponible);
  const descuentos = legales.total + d.otrosDescuentos;
  if (descuentos > imponible) return { ok: false, error: "Los descuentos no pueden ser mayores que lo que se gana." };

  await db
    .update(remuneraciones)
    .set({
      sueldoBase: d.sueldoBase,
      diasDescontados: d.diasDescontados,
      descAusencias: descAus,
      horasDescontadas: d.horasDescontadas,
      horasExtra: d.horasExtra,
      montoHorasExtra: montoExtra,
      bonos: d.bonos,
      descAfp: legales.afp,
      descSalud: legales.salud,
      descCesantia: legales.cesantia,
      retencion: legales.retencion,
      otrosDescuentos: d.otrosDescuentos,
      descuentos,
      liquido: imponible - descuentos,
      nota: d.nota,
    })
    .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, apr.id)));

  refrescar();
  return { ok: true };
}

const pagoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
  medio: z.string(),
});

/** Paga una liquidación: deja el egreso del líquido en la Caja y la marca como pagada. Todo o nada. */
export async function pagarRemuneracion(_prev: ResultadoRemuneraciones | null, formData: FormData): Promise<ResultadoRemuneraciones> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: SIN_PLAN };

  const parsed = pagoSchema.safeParse({ fecha: formData.get("fecha"), medio: formData.get("medio") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!MEDIOS_MOVIMIENTO.some((m) => m.valor === d.medio)) return { ok: false, error: "El medio de pago no es válido." };
  const id = String(formData.get("id") ?? "");

  try {
    const r = await db.transaction(async (tx) => {
      const [fila] = await tx
        .select({ estado: remuneraciones.estado, liquido: remuneraciones.liquido, periodo: remuneraciones.periodo, nombre: trabajadores.nombre })
        .from(remuneraciones)
        .innerJoin(trabajadores, eq(trabajadores.id, remuneraciones.trabajadorId))
        .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, apr.id)))
        .limit(1);
      if (!fila) return { ok: false as const, error: "No encontramos esa liquidación." };
      if (fila.estado === "PAGADA") return { ok: false as const, error: "Esta liquidación ya está pagada." };
      if (fila.liquido <= 0) return { ok: false as const, error: "El líquido es $0: no hay nada que pagar." };
      if (await diaCerrado(tx, apr.id, d.fecha)) return { ok: false as const, error: mensajeDiaCerrado(d.fecha) };

      const [egreso] = await tx
        .insert(movimientos)
        .values({
          aprId: apr.id,
          tipo: "EGRESO",
          fecha: d.fecha,
          monto: fila.liquido,
          categoria: "REMUNERACIONES",
          concepto: `${PREFIJO_CONCEPTO_REMUNERACION}${fila.nombre} (${fila.periodo})`,
          medio: d.medio,
          contraparte: fila.nombre,
          registradoPorId: user.id,
        })
        .returning({ id: movimientos.id });
      await tx
        .update(remuneraciones)
        .set({ estado: "PAGADA", fechaPago: d.fecha, medio: d.medio, movimientoId: egreso.id })
        .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, apr.id)));
      return { ok: true as const };
    });
    if (r.ok) refrescar();
    return r;
  } catch (e) {
    console.error("Remuneraciones: no se pudo pagar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos registrar el pago. Inténtalo de nuevo en un momento.") };
  }
}

/** Deshace un pago: quita el egreso de la Caja (si ese día no está cerrado) y la liquidación vuelve a pendiente. */
export async function deshacerPago(id: string): Promise<ResultadoRemuneraciones> {
  const { apr } = await requireAdmin();

  try {
    const r = await db.transaction(async (tx) => {
      const [fila] = await tx
        .select({ estado: remuneraciones.estado, movimientoId: remuneraciones.movimientoId })
        .from(remuneraciones)
        .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, apr.id)))
        .limit(1);
      if (!fila || fila.estado !== "PAGADA") return { ok: false as const, error: "Esa liquidación no está pagada." };

      if (fila.movimientoId) {
        const [mov] = await tx
          .select({ fecha: movimientos.fecha })
          .from(movimientos)
          .where(and(eq(movimientos.id, fila.movimientoId), eq(movimientos.aprId, apr.id)))
          .limit(1);
        if (mov && (await diaCerrado(tx, apr.id, mov.fecha))) return { ok: false as const, error: mensajeDiaCerrado(mov.fecha) };
        await tx.delete(movimientos).where(and(eq(movimientos.id, fila.movimientoId), eq(movimientos.aprId, apr.id)));
      }
      await tx
        .update(remuneraciones)
        .set({ estado: "PENDIENTE", fechaPago: null, medio: null, movimientoId: null })
        .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, apr.id)));
      return { ok: true as const };
    });
    if (r.ok) refrescar();
    return r;
  } catch (e) {
    console.error("Remuneraciones: no se pudo deshacer el pago:", e);
    return { ok: false, error: mensajeError(e, "No pudimos deshacer el pago. Inténtalo de nuevo en un momento.") };
  }
}

/** Borra una liquidación que todavía no se pagó (por ejemplo, de alguien que no corresponde ese mes). */
export async function eliminarRemuneracion(id: string): Promise<ResultadoRemuneraciones> {
  const { apr } = await requireAdmin();

  const borrados = await db
    .delete(remuneraciones)
    .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, apr.id), eq(remuneraciones.estado, "PENDIENTE")))
    .returning({ id: remuneraciones.id });
  if (borrados.length === 0) return { ok: false, error: "Solo se pueden borrar las liquidaciones pendientes." };

  refrescar();
  return { ok: true };
}
