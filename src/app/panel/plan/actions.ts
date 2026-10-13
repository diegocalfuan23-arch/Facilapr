"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pagosPlan } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { crearPagoFlow, flowConfigurado } from "@/lib/flow";
import { valorUfHoy } from "@/lib/uf";
import { MESES_GRATIS, PLANES_COMERCIALES } from "@/lib/planes-comerciales";
import type { Plan } from "@/lib/planes";

const IVA = 0.19;

export type Cotizacion = {
  plan: Plan;
  nombrePlan: string;
  periodo: "MENSUAL" | "ANUAL";
  uf: number;
  valorUf: number;
  neto: number;
  iva: number;
  total: number;
};

export type ResultadoCotizacion = { ok: true; cotizacion: Cotizacion } | { ok: false; error: string };

/** Cuánto cuesta un plan hoy en pesos: la UF del día por el precio del plan, más IVA. */
export async function cotizarPlan(plan: Plan, periodo: "MENSUAL" | "ANUAL"): Promise<ResultadoCotizacion> {
  await requireAdmin();

  const def = PLANES_COMERCIALES.find((p) => p.clave === plan);
  if (!def || def.mensual === null) {
    return { ok: false, error: "Ese plan se contrata a medida: escríbenos y lo conversamos." };
  }

  const valorUf = await valorUfHoy();
  if (!valorUf) {
    return { ok: false, error: "No pudimos obtener el valor de la UF de hoy. Inténtalo en unos minutos." };
  }

  const uf = def.mensual * (periodo === "ANUAL" ? 12 - MESES_GRATIS : 1);
  const neto = Math.round(uf * valorUf);
  const iva = Math.round(neto * IVA);
  return {
    ok: true,
    cotizacion: { plan, nombrePlan: def.nombre, periodo, uf, valorUf, neto, iva, total: neto + iva },
  };
}

/** Crea la orden en Flow y devuelve la dirección de pago a la que se manda al usuario. */
export async function iniciarPagoPlan(
  plan: Plan,
  periodo: "MENSUAL" | "ANUAL"
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { user, apr } = await requireAdmin();

  if (!flowConfigurado()) {
    return { ok: false, error: "Los pagos en línea todavía no están activados. Escríbenos a hola@facilapr.cl y te ayudamos." };
  }

  const c = await cotizarPlan(plan, periodo);
  if (!c.ok) return c;

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "https://facilapr.cl").replace(/\/$/, "");

  const [orden] = await db
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

