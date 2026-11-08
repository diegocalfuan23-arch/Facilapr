"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, lte, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { movimientos, prestamoDescuentos, prestamos, remuneraciones, trabajadores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";
import { MEDIOS_MOVIMIENTO } from "@/lib/finanzas-comun";
import { diaCerrado, mensajeDiaCerrado } from "@/lib/finanzas";
import { PREFIJO_CONCEPTO_REMUNERACION, descuentoPorDias, type ResumenAusenciasMes } from "@/lib/rrhh-comun";
import { horasPorDia, valorDeHoraExtra } from "@/lib/personal-comun";
import { resumenAusenciasMes } from "@/lib/rrhh";
import { descuentosLegales } from "@/lib/personal-comun";
import type { Contrato } from "@/lib/personal-comun";

export type ResultadoRemuneraciones = { ok: true } | { ok: false; error: string };
export type ResultadoRecalculo = { ok: true; cantidad: number } | { ok: false; error: string };

const SIN_PLAN = "Remuneraciones está disponible en el plan Grande.";
const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const aEntero = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[^\d]/g, "")) || 0;
const periodoOk = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p);

function refrescar() {
  revalidatePath("/panel/remuneraciones");
  revalidatePath("/panel/caja");
}

/** Lo de la ficha de una persona que hace falta para calcular su liquidación. */
type PersonaCalculo = {
  id: string;
  sueldo: number;
  valorDia: number | null;
  porDia: boolean;
  jornadaSemanal: number;
  diasSemana: number;
  valorHoraExtra: number | null;
  contrato: string;
  afpTasa: number;
  saludTasa: number;
  cesantia: boolean;
};

/**
 * Los números de una liquidación sacados de Asistencia, permisos y la ficha: el sueldo (o los días trabajados),
 * lo que no se paga, las horas extras y los descuentos de ley. Los bonos entran al imponible.
 */
function calcular(p: PersonaCalculo, aus: ResumenAusenciasMes | undefined, bonos: number) {
  // A quien cobra por día se le paga lo que trabajó (según su asistencia); no hay días que descontar.
  const base = p.porDia ? (aus?.trabajados ?? 0) * (p.valorDia ?? 0) : p.sueldo;
  const dias = p.porDia ? 0 : (aus?.descontables ?? 0);
  const horas = aus?.horasPermisoSinGoce ?? 0;
  const descAus = descuentoPorDias(base, dias, p.valorDia, horas, horasPorDia(p));
  // Las horas extras registradas en Asistencia se pagan con la hora extra de la persona.
  const horasExtra = aus?.horasExtra ?? 0;
  const montoExtra = Math.round(
    horasExtra * valorDeHoraExtra({ sueldo: base, valorDia: p.valorDia, porDia: p.porDia, jornadaSemanal: p.jornadaSemanal, diasSemana: p.diasSemana, valorHoraExtra: p.valorHoraExtra })
  );
  const imponible = Math.max(0, base - descAus) + montoExtra + bonos;
  const legales = descuentosLegales({ ...p, contrato: p.contrato as Contrato }, imponible);
  return { base, dias, horas, descAus, horasExtra, montoExtra, imponible, legales };
}

type Vigente = { id: string; trabajadorId: string; monto: number; cuotaMonto: number };
type ContextoPrestamos = { vigentes: Vigente[]; yaDescontado: Map<string, number>; yaEsteMes: Set<string> };

/** Los anticipos y préstamos vigentes que tocan un mes, con lo ya descontado y qué cuotas ya están en ese mes. */
async function cargarPrestamos(tx: Pick<typeof db, "select">, aprId: string, periodo: string): Promise<ContextoPrestamos> {
  const vigentes = await tx
    .select({ id: prestamos.id, trabajadorId: prestamos.trabajadorId, monto: prestamos.monto, cuotaMonto: prestamos.cuotaMonto })
    .from(prestamos)
    .where(and(eq(prestamos.aprId, aprId), eq(prestamos.estado, "ACTIVO"), lte(prestamos.primerPeriodo, periodo)));
  const ids = vigentes.map((v) => v.id);
  const hechos = ids.length
    ? await tx
        .select({ prestamoId: prestamoDescuentos.prestamoId, periodo: prestamoDescuentos.periodo, monto: prestamoDescuentos.monto })
        .from(prestamoDescuentos)
        .where(inArray(prestamoDescuentos.prestamoId, ids))
    : [];
  const yaDescontado = new Map<string, number>();
  const yaEsteMes = new Set<string>();
  for (const h of hechos) {
    yaDescontado.set(h.prestamoId, (yaDescontado.get(h.prestamoId) ?? 0) + h.monto);
    if (h.periodo === periodo) yaEsteMes.add(h.prestamoId);
  }
  return { vigentes, yaDescontado, yaEsteMes };
}

/** Las cuotas de una persona que caben en lo que gana: nunca se descuenta más de eso, lo demás queda para el mes siguiente. */
function asignarCuotas(ctx: ContextoPrestamos, trabajadorId: string, capacidadInicial: number) {
  let capacidad = Math.max(0, capacidadInicial);
  let total = 0;
  const aplicadas: { prestamoId: string; monto: number }[] = [];
  for (const v of ctx.vigentes.filter((x) => x.trabajadorId === trabajadorId && !ctx.yaEsteMes.has(x.id))) {
    const saldo = v.monto - (ctx.yaDescontado.get(v.id) ?? 0);
    const cuota = Math.min(v.cuotaMonto, saldo, capacidad);
    if (cuota <= 0) continue;
    aplicadas.push({ prestamoId: v.id, monto: cuota });
    capacidad -= cuota;
    total += cuota;
  }
  return { aplicadas, total };
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
        noImponible: trabajadores.noImponible,
        valorHoraExtra: trabajadores.valorHoraExtra,
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

    await db.transaction(async (tx) => {
      const ctx = await cargarPrestamos(tx, apr.id, periodo);

      // Qué cuotas lleva cada persona este mes (se anotan después, con el id de su liquidación).
      const cuotasDe = new Map<string, { prestamoId: string; monto: number }[]>();
      const valores = personas.map((p) => {
        const c = calcular(p, ausenciasMes[p.id], 0);
        const { aplicadas, total: cuotasPrestamos } = asignarCuotas(ctx, p.id, c.imponible - c.legales.total);
        cuotasDe.set(p.id, aplicadas);
        const descuentos = c.legales.total + cuotasPrestamos;
        return {
          aprId: apr.id,
          trabajadorId: p.id,
          periodo,
          sueldoBase: c.base,
          diasDescontados: c.dias,
          descAusencias: c.descAus,
          horasDescontadas: c.horas,
          horasExtra: c.horasExtra,
          montoHorasExtra: c.montoExtra,
          descAfp: c.legales.afp,
          descSalud: c.legales.salud,
          descCesantia: c.legales.cesantia,
          retencion: c.legales.retencion,
          otrosDescuentos: cuotasPrestamos,
          noImponible: p.noImponible,
          descuentos,
          liquido: c.imponible - descuentos + p.noImponible,
        };
      });

      const creadas = await tx.insert(remuneraciones).values(valores).onConflictDoNothing().returning({ id: remuneraciones.id, trabajadorId: remuneraciones.trabajadorId });

      // Las cuotas solo se anotan en las liquidaciones que se crearon ahora: las que ya existían no se tocan.
      const filasCuotas = creadas.flatMap((r) => (cuotasDe.get(r.trabajadorId) ?? []).map((q) => ({ prestamoId: q.prestamoId, remuneracionId: r.id, periodo, monto: q.monto })));
      if (filasCuotas.length > 0) await tx.insert(prestamoDescuentos).values(filasCuotas);
    });
  } catch (e) {
    console.error("Remuneraciones: no se pudo generar el mes:", e);
    return { ok: false, error: mensajeError(e, "No pudimos armar el mes. Inténtalo de nuevo en un momento.") };
  }

  refrescar();
  return { ok: true };
}

/**
 * Vuelve a leer Asistencia, permisos, horas extras y préstamos para las liquidaciones que aún no se pagan.
 * Se mantienen los bonos, la colación, los otros descuentos escritos a mano y la nota; los días y horas se reemplazan.
 * Una liquidación revisada vuelve a «por revisar», porque sus números cambiaron. Las pagadas no se tocan.
 */
export async function recalcularRemuneraciones(ids: string[]): Promise<ResultadoRecalculo> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: SIN_PLAN };
  const parsed = z.array(z.string().min(1)).min(1).max(300).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "No hay liquidaciones para recalcular." };

  try {
    const filas = await db
      .select({
        id: remuneraciones.id,
        periodo: remuneraciones.periodo,
        estado: remuneraciones.estado,
        bonos: remuneraciones.bonos,
        otrosDescuentos: remuneraciones.otrosDescuentos,
        noImponible: remuneraciones.noImponible,
        trabajadorId: trabajadores.id,
        sueldo: trabajadores.sueldo,
        valorDia: trabajadores.valorDia,
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
      .where(and(eq(remuneraciones.aprId, apr.id), inArray(remuneraciones.id, parsed.data), ne(remuneraciones.estado, "PAGADA")));
    if (filas.length === 0) return { ok: false, error: "Esas liquidaciones ya están pagadas o no existen." };

    const periodos = [...new Set(filas.map((f) => f.periodo))];
    const ausenciasPorMes = new Map<string, Record<string, ResumenAusenciasMes>>();
    for (const p of periodos) ausenciasPorMes.set(p, await resumenAusenciasMes(apr.id, p));

    await db.transaction(async (tx) => {
      // Lo que ya tenían anotado de préstamos: se quita y se vuelve a calcular, para no descontar dos veces.
      const previas = await tx
        .select({ remuneracionId: prestamoDescuentos.remuneracionId, monto: prestamoDescuentos.monto })
        .from(prestamoDescuentos)
        .where(inArray(prestamoDescuentos.remuneracionId, filas.map((f) => f.id)));
      const cuotasPrevias = new Map<string, number>();
      for (const q of previas) cuotasPrevias.set(q.remuneracionId, (cuotasPrevias.get(q.remuneracionId) ?? 0) + q.monto);
      if (previas.length > 0) await tx.delete(prestamoDescuentos).where(inArray(prestamoDescuentos.remuneracionId, filas.map((f) => f.id)));

      const contextos = new Map<string, ContextoPrestamos>();
      for (const p of periodos) contextos.set(p, await cargarPrestamos(tx, apr.id, p));

      for (const f of filas) {
        // Lo que no son cuotas dentro de «otros descuentos» lo puso la persona a mano: se respeta.
        const manual = Math.max(0, f.otrosDescuentos - (cuotasPrevias.get(f.id) ?? 0));
        const c = calcular(f, ausenciasPorMes.get(f.periodo)?.[f.trabajadorId], f.bonos);
        const { aplicadas, total } = asignarCuotas(contextos.get(f.periodo)!, f.trabajadorId, c.imponible - c.legales.total - manual);
        const descuentos = c.legales.total + manual + total;

        await tx
          .update(remuneraciones)
          .set({
            sueldoBase: c.base,
            diasDescontados: c.dias,
            descAusencias: c.descAus,
            horasDescontadas: c.horas,
            horasExtra: c.horasExtra,
            montoHorasExtra: c.montoExtra,
            descAfp: c.legales.afp,
            descSalud: c.legales.salud,
            descCesantia: c.legales.cesantia,
            retencion: c.legales.retencion,
            otrosDescuentos: manual + total,
            descuentos,
            liquido: Math.max(0, c.imponible - descuentos) + f.noImponible,
            estado: "PENDIENTE",
          })
          .where(and(eq(remuneraciones.id, f.id), eq(remuneraciones.aprId, apr.id)));
        if (aplicadas.length > 0) await tx.insert(prestamoDescuentos).values(aplicadas.map((q) => ({ prestamoId: q.prestamoId, remuneracionId: f.id, periodo: f.periodo, monto: q.monto })));
      }
    });
    refrescar();
    return { ok: true, cantidad: filas.length };
  } catch (e) {
    console.error("Remuneraciones: no se pudo recalcular:", e);
    return { ok: false, error: mensajeError(e, "No pudimos recalcular. Inténtalo de nuevo en un momento.") };
  }
}

/** Marca una liquidación como revisada (lista para pagar) o la devuelve a «por revisar». Las pagadas no cambian. */
export async function cambiarRevision(id: string, lista: boolean): Promise<ResultadoRemuneraciones> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: SIN_PLAN };

  const [fila] = await db
    .select({ estado: remuneraciones.estado, liquido: remuneraciones.liquido })
    .from(remuneraciones)
    .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, apr.id)))
    .limit(1);
  if (!fila) return { ok: false, error: "No encontramos esa liquidación." };
  if (fila.estado === "PAGADA") return { ok: false, error: "Ya está pagada." };
  if (lista && fila.liquido <= 0) return { ok: false, error: "El líquido es $0: no hay nada que pagar." };

  await db
    .update(remuneraciones)
    .set({ estado: lista ? "LISTA" : "PENDIENTE" })
    .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, apr.id), ne(remuneraciones.estado, "PAGADA")));

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
  /** Colación y movilización del mes. */
  noImponible: z.number().int().min(0).max(10_000_000),
  /** El valor del día de esta liquidación; 0 = el de la ficha o el sueldo dividido en 30. */
  valorDia: z.number().int().min(0).max(100_000_000),
});

/**
 * Corrige la liquidación de un mes mientras no esté pagada: sueldo bruto, bonos y otros descuentos.
 * La AFP, la salud, el seguro de cesantía y la retención se recalculan con la ficha de la persona.
 * Si estaba revisada, vuelve a «por revisar».
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
    noImponible: aEntero(formData.get("noImponible")),
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
      noImponible: d.noImponible,
      bonos: d.bonos,
      descAfp: legales.afp,
      descSalud: legales.salud,
      descCesantia: legales.cesantia,
      retencion: legales.retencion,
      otrosDescuentos: d.otrosDescuentos,
      descuentos,
      liquido: imponible - descuentos + d.noImponible,
      nota: d.nota,
      estado: "PENDIENTE",
    })
    .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, apr.id)));

  refrescar();
  return { ok: true };
}

const pagoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
  medio: z.string(),
  ids: z.array(z.string().min(1)).min(1, "No hay liquidaciones para pagar.").max(300),
});

/**
 * Paga una o varias liquidaciones (los `id` del formulario): deja el egreso de cada líquido en la Caja y las marca
 * como pagadas. Todo o nada: si una falla, ninguna queda pagada.
 */
export async function pagarRemuneracion(_prev: ResultadoRemuneraciones | null, formData: FormData): Promise<ResultadoRemuneraciones> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: SIN_PLAN };

  const parsed = pagoSchema.safeParse({ fecha: formData.get("fecha"), medio: formData.get("medio"), ids: [...new Set(formData.getAll("id").map(String))] });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!MEDIOS_MOVIMIENTO.some((m) => m.valor === d.medio)) return { ok: false, error: "El medio de pago no es válido." };

  try {
    const r = await db.transaction(async (tx) => {
      const filas = await tx
        .select({ id: remuneraciones.id, estado: remuneraciones.estado, liquido: remuneraciones.liquido, periodo: remuneraciones.periodo, nombre: trabajadores.nombre })
        .from(remuneraciones)
        .innerJoin(trabajadores, eq(trabajadores.id, remuneraciones.trabajadorId))
        .where(and(inArray(remuneraciones.id, d.ids), eq(remuneraciones.aprId, apr.id)));
      if (filas.length !== d.ids.length) return { ok: false as const, error: "No encontramos alguna de las liquidaciones." };
      for (const fila of filas) {
        if (fila.estado === "PAGADA") return { ok: false as const, error: `La liquidación de ${fila.nombre} ya está pagada.` };
        if (fila.liquido <= 0) return { ok: false as const, error: `El líquido de ${fila.nombre} es $0: no hay nada que pagar.` };
      }
      if (await diaCerrado(tx, apr.id, d.fecha)) return { ok: false as const, error: mensajeDiaCerrado(d.fecha) };

      for (const fila of filas) {
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
          .where(and(eq(remuneraciones.id, fila.id), eq(remuneraciones.aprId, apr.id)));
      }
      return { ok: true as const };
    });
    if (r.ok) refrescar();
    return r;
  } catch (e) {
    console.error("Remuneraciones: no se pudo pagar:", e);
    return { ok: false, error: mensajeError(e, "No pudimos registrar el pago. Inténtalo de nuevo en un momento.") };
  }
}

/** Deshace un pago: quita el egreso de la Caja (si ese día no está cerrado) y la liquidación vuelve a «lista para pagar». */
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
        .set({ estado: "LISTA", fechaPago: null, medio: null, movimientoId: null })
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

/** Borra una liquidación que todavía no se pagó (por ejemplo, de alguien que no corresponde ese mes). Sus cuotas de préstamos se liberan. */
export async function eliminarRemuneracion(id: string): Promise<ResultadoRemuneraciones> {
  const { apr } = await requireAdmin();

  const borrados = await db
    .delete(remuneraciones)
    .where(and(eq(remuneraciones.id, id), eq(remuneraciones.aprId, apr.id), ne(remuneraciones.estado, "PAGADA")))
    .returning({ id: remuneraciones.id });
  if (borrados.length === 0) return { ok: false, error: "Solo se pueden quitar las liquidaciones que aún no se pagan." };

  refrescar();
  return { ok: true };
}
