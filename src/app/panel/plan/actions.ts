"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pagosPlan, tarjetasPlan } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import {
  crearClienteFlow,
  crearPagoFlow,
  flowConfigurado,
  iniciarRegistroTarjetaFlow,
  quitarTarjetaFlow,
} from "@/lib/flow";
import { calcularCotizacion, type ResultadoCotizacion } from "@/lib/cotizar-plan";
import type { Plan } from "@/lib/planes";

/** Cuánto cuesta un plan hoy en pesos: la UF del día por el precio del plan, más IVA. */
export async function cotizarPlan(plan: Plan, periodo: "MENSUAL" | "ANUAL"): Promise<ResultadoCotizacion> {
  await requireAdmin();
  return calcularCotizacion(plan, periodo);
}

/** Crea la orden en Flow y devuelve la dirección de pago a la que se manda al usuario. */
export async function iniciarPagoPlan(
  plan: Plan,
  periodo: "MENSUAL" | "ANUAL"
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { user, apr } = await requireAdmin();

  if (!flowConfigurado()) {
    return { ok: false, error: "Los pagos en línea todavía no están activados. Escríbenos a contacto@facilapr.cl y te ayudamos." };
  }

  const c = await cotizarPlan(plan, periodo);
  if (!c.ok) return c;

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "https://facilapr.cl").replace(/\/$/, "");

  let orden: { id: string };
  try {
    [orden] = await db
      .insert(pagosPlan)
      .values({
        aprId: apr.id,
        plan,
        periodo,
        montoNeto: c.cotizacion.neto,
        montoTotal: c.cotizacion.total,
        valorUf: c.cotizacion.valorUf,
        creadoPorId: user.id,
      })
      .returning({ id: pagosPlan.id });
  } catch (e) {
    // Sin esto, una tabla que falta tumba toda la sección en vez de avisar.
    console.error("No se pudo crear la orden de pago del plan:", e);
    return { ok: false, error: "No pudimos iniciar el pago. Inténtalo de nuevo en un momento." };
  }

  try {
    const flow = await crearPagoFlow({
      orden: orden.id,
      asunto: `Facilapr · ${c.cotizacion.nombrePlan} ${periodo === "ANUAL" ? "anual" : "mensual"} · ${apr.nombre}`.slice(0, 120),
      monto: c.cotizacion.total,
      correo: user.email,
      urlConfirmacion: `${base}/api/flow/confirmacion`,
      urlRetorno: `${base}/api/flow/retorno`,
    });
    await db
      .update(pagosPlan)
      .set({ flowToken: flow.token, flowOrder: flow.flowOrder })
      .where(eq(pagosPlan.id, orden.id));
    return { ok: true, url: flow.url };
  } catch (e) {
    console.error("Flow:", e);
    await db.update(pagosPlan).set({ estado: "RECHAZADO" }).where(eq(pagosPlan.id, orden.id));
    return { ok: false, error: "No pudimos iniciar el pago con Flow. Inténtalo de nuevo en un momento." };
  }
}

export type VigenciaPlan = {
  /** Hasta cuándo está pagado el plan (ISO), o null si nunca se ha pagado por aquí. */
  hasta: string | null;
  pagos: { fecha: string; plan: string; periodo: string; total: number; flowOrder: string | null }[];
};

/** Lo que el comité ya pagó de su plan. Si la tabla todavía no existe, devuelve vacío: la pantalla sigue funcionando. */
export async function vigenciaDelPlan(aprId: string): Promise<VigenciaPlan> {
  try {
    const filas = await db
      .select({
        pagadoAt: pagosPlan.pagadoAt,
        plan: pagosPlan.plan,
        periodo: pagosPlan.periodo,
        total: pagosPlan.montoTotal,
        flowOrder: pagosPlan.flowOrder,
        hasta: pagosPlan.vigenteHasta,
      })
      .from(pagosPlan)
      .where(and(eq(pagosPlan.aprId, aprId), eq(pagosPlan.estado, "PAGADO")))
      .orderBy(desc(pagosPlan.pagadoAt))
      .limit(12);

    const hasta = filas.reduce<Date | null>((m, f) => (f.hasta && (!m || f.hasta > m) ? f.hasta : m), null);
    return {
      hasta: hasta ? hasta.toISOString() : null,
      pagos: filas.map((f) => ({
        fecha: (f.pagadoAt ?? new Date()).toISOString(),
        plan: f.plan,
        periodo: f.periodo,
        total: f.total,
        flowOrder: f.flowOrder,
      })),
    };
  } catch {
    return { hasta: null, pagos: [] };
  }
}


// ---------------------------------------------------------------- pago automático

export type PagoAutomatico = {
  /** ACTIVA | SUSPENDIDA | PENDIENTE; null si el comité no tiene pago automático. */
  estado: "ACTIVA" | "SUSPENDIDA" | "PENDIENTE" | null;
  plan: string | null;
  periodo: string | null;
  tarjeta: string | null;
  proximoCobro: string | null;
};

/** El pago automático del comité. Si la tabla todavía no existe, devuelve vacío: la pantalla sigue funcionando. */
export async function pagoAutomaticoDelPlan(aprId: string): Promise<PagoAutomatico> {
  const vacio: PagoAutomatico = { estado: null, plan: null, periodo: null, tarjeta: null, proximoCobro: null };
  try {
    const t = await db.query.tarjetasPlan.findFirst({ where: eq(tarjetasPlan.aprId, aprId) });
    if (!t || t.estado === "CANCELADA") return vacio;
    return {
      estado: t.estado as PagoAutomatico["estado"],
      plan: t.plan,
      periodo: t.periodo,
      tarjeta: t.tarjetaUltimos ? `${t.tarjetaTipo ?? "Tarjeta"} terminada en ${t.tarjetaUltimos}` : null,
      proximoCobro: t.proximoCobro ? t.proximoCobro.toISOString() : null,
    };
  } catch {
    return vacio;
  }
}

/**
 * Empieza el pago automático: lleva al comité a registrar su tarjeta en Flow. La
 * tarjeta no pasa por Facilapr. Exige que el comité acepte expresamente los cobros.
 */
export async function iniciarPagoAutomatico(
  plan: Plan,
  periodo: "MENSUAL" | "ANUAL",
  acepta: boolean
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { user, apr } = await requireAdmin();

  if (!acepta) {
    return { ok: false, error: "Tienes que aceptar el cobro automático para activarlo." };
  }
  if (!flowConfigurado()) {
    return { ok: false, error: "Los pagos en línea todavía no están activados. Escríbenos a contacto@facilapr.cl y te ayudamos." };
  }
  const c = await calcularCotizacion(plan, periodo);
  if (!c.ok) return c;

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "https://facilapr.cl").replace(/\/$/, "");

  try {
    const existente = await db.query.tarjetasPlan.findFirst({ where: eq(tarjetasPlan.aprId, apr.id) });
    const flowCustomerId =
      existente?.flowCustomerId ?? (await crearClienteFlow({ nombre: apr.nombre, correo: user.email, externalId: apr.id }));

    const registro = await iniciarRegistroTarjetaFlow(flowCustomerId, `${base}/api/flow/tarjeta`);
    const datos = {
      flowCustomerId,
      estado: "PENDIENTE",
      plan,
      periodo,
      registroToken: registro.token,
      autorizadoPorId: user.id,
      autorizadoAt: new Date(),
      intentos: 0,
      updatedAt: new Date(),
    };
    if (existente) {
      await db.update(tarjetasPlan).set(datos).where(eq(tarjetasPlan.id, existente.id));
    } else {
      await db.insert(tarjetasPlan).values({ aprId: apr.id, ...datos });
    }
    return { ok: true, url: registro.url };
  } catch (e) {
    console.error("Registro de tarjeta en Flow:", e);
    return { ok: false, error: "No pudimos iniciar el registro de la tarjeta. Inténtalo de nuevo en un momento." };
  }
}

/** Apaga el cobro automático y pide a Flow que olvide la tarjeta. El plan ya pagado sigue vigente. */
export async function cancelarPagoAutomatico(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { apr } = await requireAdmin();
  const t = await db.query.tarjetasPlan.findFirst({ where: eq(tarjetasPlan.aprId, apr.id) });
  if (!t) return { ok: true };

  // Primero se apaga aquí: aunque Flow falle, no se vuelve a cobrar.
  await db
    .update(tarjetasPlan)
    .set({ estado: "CANCELADA", proximoCobro: null, updatedAt: new Date() })
    .where(eq(tarjetasPlan.id, t.id));
  try {
    await quitarTarjetaFlow(t.flowCustomerId);
  } catch (e) {
    console.error("Flow no pudo quitar la tarjeta:", e);
  }
  return { ok: true };
}
