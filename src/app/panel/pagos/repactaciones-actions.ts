"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { boletas, pagos, repactaciones, socios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { urlComprobante } from "@/lib/comprobante-enlace";
import { estadoQueCorresponde, type EstadoBoleta } from "@/lib/boletas";
import { normalizarTelefono } from "@/lib/formato";

export type ResultadoRepactacion = { ok: true } | { ok: false; error: string };

const crearSchema = z.object({
  cuotas: z.number().int().min(2, "Mínimo 2 cuotas.").max(60, "Máximo 60 cuotas."),
  primerVencimiento: z.date(),
  nota: z.string().trim().max(300).optional(),
});

/** Lo que el socio debe y ya venció: las boletas con saldo cuyo plazo pasó. */
async function deudaVencida(socioId: string) {
  const [fila] = await db
    .select({ total: sql<number>`coalesce(sum(${boletas.montoTotal} - ${boletas.montoPagado}), 0)::int` })
    .from(boletas)
    .where(
      and(
        eq(boletas.socioId, socioId),
        ne(boletas.estado, "ANULADA"),
        lt(boletas.montoPagado, boletas.montoTotal),
        lt(boletas.fechaVencimiento, new Date())
      )
    );
  return fila?.total ?? 0;
}

/** Crea el acuerdo: toma la deuda vencida del socio de hoy y la reparte en cuotas mensuales. */
export async function crearRepactacion(
  socioId: string,
  datos: { cuotas: number; primerVencimiento: string; nota?: string }
): Promise<ResultadoRepactacion> {
  const { user, apr } = await requireAdmin();

  const parsed = crearSchema.safeParse({
    cuotas: Math.round(datos.cuotas),
    primerVencimiento: new Date(`${datos.primerVencimiento}T12:00:00`),
    nota: datos.nota || undefined,
  });
  if (!parsed.success || Number.isNaN(parsed.data.primerVencimiento.getTime())) {
    return { ok: false, error: parsed.success ? "La fecha de la primera cuota no es válida." : parsed.error.issues[0].message };
  }
  // La primera cuota no puede vencer antes de hoy: nacería atrasada.
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (parsed.data.primerVencimiento < hoy) {
    return { ok: false, error: "La primera cuota no puede vencer antes de hoy." };
  }

  const [socio] = await db
    .select({ id: socios.id })
    .from(socios)
    .where(and(eq(socios.id, socioId), eq(socios.aprId, apr.id)))
    .limit(1);
  if (!socio) return { ok: false, error: "No encontramos a ese socio." };

  const deuda = await deudaVencida(socio.id);
  if (deuda <= 0) return { ok: false, error: "Este socio no tiene deuda vencida que repactar." };
  if (deuda < parsed.data.cuotas) {
    return { ok: false, error: "La deuda es menor que el número de cuotas." };
  }

  try {
    await db.insert(repactaciones).values({
      aprId: apr.id,
      socioId: socio.id,
      deudaTotal: deuda,
      cuotas: parsed.data.cuotas,
      montoCuota: Math.floor(deuda / parsed.data.cuotas),
      primerVencimiento: parsed.data.primerVencimiento,
      nota: parsed.data.nota ?? null,
      creadaPorId: user.id,
    });
  } catch (e) {
    // El índice único impide dos acuerdos activos del mismo socio.
    if (e instanceof Error && /Repactacion_socio_activa_key|duplicate key/.test(`${e.message} ${(e as { cause?: Error }).cause?.message ?? ""}`)) {
      return { ok: false, error: "Este socio ya tiene un acuerdo activo. Termínalo o cancélalo antes de hacer otro." };
    }
    throw e;
  }

  revalidatePath("/panel/pagos");
  return { ok: true };
}

const cuotaSchema = z.object({
  monto: z.number().int().min(1, "El monto debe ser mayor a cero."),
  fecha: z.date(),
  medio: z.enum(["EFECTIVO", "TRANSFERENCIA", "CAJA_VECINA", "OTRO"]),
  referencia: z.string().trim().max(80).optional(),
  pagadoPor: z.string().trim().max(120).optional(),
  pagadoPorTelefono: z.string().trim().max(30).optional(),
});

export type ResultadoCuota =
  | { ok: true; comprobanteUrl: string; restante: number; cumplida: boolean }
  | { ok: false; error: string };

/**
 * Registra lo que el socio paga de su acuerdo. El dinero se aplica a sus
 * boletas más antiguas primero: así su deuda baja de verdad y deja de figurar
 * como moroso cuando termina. Si cubre varias boletas, queda un pago por cada una.
 */
export async function registrarCuotaRepactacion(
  repactacionId: string,
  datos: {
    monto: number;
    fecha: string;
    medio: string;
    referencia?: string;
    pagadoPor?: string;
    pagadoPorTelefono?: string;
  }
): Promise<ResultadoCuota> {
  const { user, apr } = await requireAdmin();

  const parsed = cuotaSchema.safeParse({
    monto: Math.round(datos.monto),
    fecha: new Date(`${datos.fecha}T12:00:00`),
    medio: datos.medio,
    referencia: datos.referencia || undefined,
    pagadoPor: datos.pagadoPor || undefined,
    pagadoPorTelefono: datos.pagadoPorTelefono || undefined,
  });
  if (!parsed.success || Number.isNaN(parsed.data.fecha.getTime())) {
    return { ok: false, error: parsed.success ? "La fecha no es válida." : parsed.error.issues[0].message };
  }
  if (parsed.data.fecha.getTime() > Date.now() + 24 * 3600 * 1000) {
    return { ok: false, error: "La fecha del pago no puede ser futura." };
  }

  const [acuerdo] = await db
    .select()
    .from(repactaciones)
    .where(and(eq(repactaciones.id, repactacionId), eq(repactaciones.aprId, apr.id)))
    .limit(1);
  if (!acuerdo) return { ok: false, error: "No encontramos ese acuerdo." };
  if (acuerdo.estado !== "ACTIVA") return { ok: false, error: "Este acuerdo ya no está activo." };

  const [{ pagado }] = await db
    .select({ pagado: sql<number>`coalesce(sum(${pagos.monto}), 0)::int` })
    .from(pagos)
    .where(eq(pagos.repactacionId, acuerdo.id));

  const restante = acuerdo.deudaTotal - pagado;
  if (parsed.data.monto > restante) {
    return { ok: false, error: `El monto supera lo que falta del acuerdo (${restante.toLocaleString("es-CL")}).` };
  }

  // Las boletas del socio con saldo, la más antigua primero.
  const abiertas = await db
    .select({
      id: boletas.id,
      montoTotal: boletas.montoTotal,
      montoPagado: boletas.montoPagado,
      fechaVencimiento: boletas.fechaVencimiento,
      estado: boletas.estado,
    })
    .from(boletas)
    .where(
      and(eq(boletas.socioId, acuerdo.socioId), ne(boletas.estado, "ANULADA"), lt(boletas.montoPagado, boletas.montoTotal))
    )
    .orderBy(asc(boletas.periodo));

  const saldoTotal = abiertas.reduce((a, b) => a + (b.montoTotal - b.montoPagado), 0);
  if (saldoTotal <= 0) {
    return { ok: false, error: "Este socio ya no tiene boletas con saldo. Si pagó todo, cancela el acuerdo." };
  }
  if (parsed.data.monto > saldoTotal) {
    return { ok: false, error: `El monto supera lo que el socio debe en sus boletas (${saldoTotal.toLocaleString("es-CL")}).` };
  }

  const pagoIds = await db.transaction(async (tx) => {
    const ids: string[] = [];
    let porAplicar = parsed.data.monto;

    for (const b of abiertas) {
      if (porAplicar <= 0) break;
      const parte = Math.min(porAplicar, b.montoTotal - b.montoPagado);

      const [p] = await tx
        .insert(pagos)
        .values({
          boletaId: b.id,
          socioId: acuerdo.socioId,
          concepto: "BOLETA",
          repactacionId: acuerdo.id,
          monto: parte,
          fecha: parsed.data.fecha,
          medio: parsed.data.medio,
          referencia: parsed.data.referencia ?? null,
          pagadoPor: parsed.data.pagadoPor ?? null,
          pagadoPorTelefono: parsed.data.pagadoPorTelefono ? normalizarTelefono(parsed.data.pagadoPorTelefono) : null,
          registradoPorId: user.id,
        })
        .returning({ id: pagos.id });
      ids.push(p.id);

      const nuevoPagado = b.montoPagado + parte;
      await tx
        .update(boletas)
        .set({
          montoPagado: nuevoPagado,
          estado: estadoQueCorresponde(b.montoTotal, nuevoPagado, b.fechaVencimiento, b.estado as EstadoBoleta),
          updatedAt: new Date(),
        })
        .where(eq(boletas.id, b.id));

      porAplicar -= parte;
    }

    const cumplida = pagado + parsed.data.monto >= acuerdo.deudaTotal;
    if (cumplida) {
      await tx
        .update(repactaciones)
        .set({ estado: "CUMPLIDA", updatedAt: new Date() })
        .where(eq(repactaciones.id, acuerdo.id));
    }
    return ids;
  });

  const restanteFinal = restante - parsed.data.monto;
  revalidatePath("/panel/pagos");
  revalidatePath("/panel/boletas");
  revalidatePath("/panel/cortes");
  revalidatePath("/panel");
  return {
    ok: true,
    comprobanteUrl: urlComprobante(pagoIds[0]),
    restante: restanteFinal,
    cumplida: restanteFinal <= 0,
  };
}

/** Da por terminado un acuerdo que ya no va a seguir (el socio no cumplió o pagó todo por otro lado). No borra los pagos. */
export async function cancelarRepactacion(repactacionId: string): Promise<ResultadoRepactacion> {
  const { apr } = await requireAdmin();
  const r = await db
    .update(repactaciones)
    .set({ estado: "CANCELADA", updatedAt: new Date() })
    .where(
      and(eq(repactaciones.id, repactacionId), eq(repactaciones.aprId, apr.id), eq(repactaciones.estado, "ACTIVA"))
    )
    .returning({ id: repactaciones.id });
  if (r.length === 0) return { ok: false, error: "No encontramos un acuerdo activo con ese código." };

  revalidatePath("/panel/pagos");
  return { ok: true };
}
