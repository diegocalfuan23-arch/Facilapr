import { and, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, pagosPlan, tarjetasPlan } from "@/lib/db/schema";
import { user } from "@/lib/db/auth-schema";
import {
  cobrarTarjetaFlow,
  estadoPagoPorOrdenFlow,
  estadoRegistroTarjetaFlow,
} from "@/lib/flow";
import { calcularCotizacion } from "@/lib/cotizar-plan";
import { marcarOrdenPagada } from "@/lib/pago-plan";
import { enviarCorreoCobroFallido } from "@/lib/correo/cobro-plan";
import type { Plan } from "@/lib/planes";

/**
 * Cobro automático del plan. La tarjeta del comité queda guardada en Flow; cada
 * vez que termina el período pagado se calcula el monto con la UF de ese día y se
 * cobra. Si falla se reintenta al día siguiente, hasta tres veces; después queda
 * suspendido y se avisa por correo. Nunca se cobra dos veces la misma orden: cada
 * intento es una orden nueva con su propio id, y el cron reserva el turno de la
 * tarjeta antes de cobrar.
 */

type Tarjeta = typeof tarjetasPlan.$inferSelect;

const MAX_INTENTOS = 3;
const DIA = 24 * 60 * 60 * 1000;

const baseUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "https://facilapr.cl").replace(/\/$/, "");

/** Hasta cuándo está pagado el plan del comité, por cualquier medio. */
async function finVigencia(aprId: string): Promise<Date | null> {
  const filas = await db
    .select({ hasta: pagosPlan.vigenteHasta })
    .from(pagosPlan)
    .where(and(eq(pagosPlan.aprId, aprId), eq(pagosPlan.estado, "PAGADO")));
  return filas.reduce<Date | null>((m, f) => (f.hasta && (!m || f.hasta > m) ? f.hasta : m), null);
}

async function avisarFallo(t: Tarjeta, suspendido: boolean) {
  try {
    const [u] = t.autorizadoPorId
      ? await db.select({ nombre: user.name, correo: user.email }).from(user).where(eq(user.id, t.autorizadoPorId))
      : [];
    const apr = await db.query.aprs.findFirst({ where: eq(aprs.id, t.aprId), columns: { nombre: true } });
    if (!u) return;
    await enviarCorreoCobroFallido({
      destinatario: u.correo,
      nombre: u.nombre,
      comite: apr?.nombre ?? "tu comité",
      suspendido,
      url: `${baseUrl()}/panel/plan`,
    });
  } catch (e) {
    console.error("Aviso de cobro fallido:", e);
  }
}

/** El cobro no pasó: se reintenta mañana, y al tercer fallo se suspende. */
async function registrarFallo(t: Tarjeta) {
  const intentos = t.intentos + 1;
  const suspendido = intentos >= MAX_INTENTOS;
  await db
    .update(tarjetasPlan)
    .set({
      intentos,
      estado: suspendido ? "SUSPENDIDA" : "ACTIVA",
      proximoCobro: suspendido ? null : new Date(Date.now() + DIA),
      updatedAt: new Date(),
    })
    .where(eq(tarjetasPlan.id, t.id));
  await avisarFallo(t, suspendido);
}

async function registrarExito(t: Tarjeta, hasta: Date | null) {
  await db
    .update(tarjetasPlan)
    .set({ intentos: 0, proximoCobro: hasta, updatedAt: new Date() })
    .where(eq(tarjetasPlan.id, t.id));
}

/**
 * Si un cobro anterior quedó en proceso en Flow, lo resuelve. Devuelve cierto si
 * sigue pendiente (entonces no se cobra de nuevo para no duplicar).
 */
async function resolverPendiente(t: Tarjeta): Promise<boolean> {
  const pendiente = await db.query.pagosPlan.findFirst({
    where: and(
      eq(pagosPlan.aprId, t.aprId),
      eq(pagosPlan.estado, "PENDIENTE"),
      isNull(pagosPlan.flowToken),
      isNotNull(pagosPlan.flowOrder)
    ),
  });
  if (!pendiente || !pendiente.flowOrder) return false;

  const f = await estadoPagoPorOrdenFlow(pendiente.flowOrder);
  if (f.estado === 2 && f.monto === pendiente.montoTotal) {
    const hasta = await marcarOrdenPagada(pendiente, pendiente.flowOrder);
    await registrarExito(t, hasta ?? (await finVigencia(t.aprId)));
    return true;
  }
  if (f.estado === 3 || f.estado === 4) {
    await db.update(pagosPlan).set({ estado: "RECHAZADO" }).where(eq(pagosPlan.id, pendiente.id));
    await registrarFallo(t);
    return true;
  }
  // Más de tres días sin resolverse: se da por perdido para no quedar trabado.
  if (Date.now() - pendiente.createdAt.getTime() > 3 * DIA) {
    await db.update(pagosPlan).set({ estado: "RECHAZADO" }).where(eq(pagosPlan.id, pendiente.id));
    return false;
  }
  return true;
}

export type ResultadoCobro = "PAGADO" | "EN_PROCESO" | "FALLIDO" | "OMITIDO";

/** Cobra el período siguiente a la tarjeta. Quien lo llama ya reservó el turno. */
export async function cobrarTarjeta(t: Tarjeta): Promise<ResultadoCobro> {
  if (t.estado !== "ACTIVA") return "OMITIDO";

  // Si el comité ya pagó por otro medio y el plan sigue vigente, no se cobra.
  const fin = await finVigencia(t.aprId);
  if (fin && fin.getTime() > Date.now()) {
    await registrarExito(t, fin);
    return "OMITIDO";
  }
  if (await resolverPendiente(t)) return "EN_PROCESO";

  const c = await calcularCotizacion(t.plan as Plan, t.periodo as "MENSUAL" | "ANUAL");
  if (!c.ok) {
    // Sin el valor de la UF no se cobra nada: se prueba de nuevo mañana, sin contar intento.
    await db
      .update(tarjetasPlan)
      .set({ proximoCobro: new Date(Date.now() + DIA), updatedAt: new Date() })
      .where(eq(tarjetasPlan.id, t.id));
    return "EN_PROCESO";
  }
  const cot = c.cotizacion;

  const [orden] = await db
    .insert(pagosPlan)
    .values({
      aprId: t.aprId,
      plan: t.plan,
      periodo: t.periodo,
      montoNeto: cot.neto,
      montoTotal: cot.total,
      valorUf: cot.valorUf,
      creadoPorId: t.autorizadoPorId,
    })
    .returning();

  try {
    const r = await cobrarTarjetaFlow({
      customerId: t.flowCustomerId,
      monto: cot.total,
      asunto: `Facilapr · ${cot.nombrePlan} ${t.periodo === "ANUAL" ? "anual" : "mensual"} · cobro automático`,
      orden: orden.id,
    });
    if (r.flowOrder) await db.update(pagosPlan).set({ flowOrder: r.flowOrder }).where(eq(pagosPlan.id, orden.id));

    if (r.estado === 2) {
      const hasta = await marcarOrdenPagada(orden, r.flowOrder);
      await registrarExito(t, hasta ?? (await finVigencia(t.aprId)));
      return "PAGADO";
    }
    if (r.estado === 3 || r.estado === 4) {
      await db.update(pagosPlan).set({ estado: "RECHAZADO" }).where(eq(pagosPlan.id, orden.id));
      await registrarFallo(t);
      return "FALLIDO";
    }
    // Quedó en proceso: mañana el cron lo consulta antes de cobrar de nuevo.
    await db
      .update(tarjetasPlan)
      .set({ proximoCobro: new Date(Date.now() + DIA), updatedAt: new Date() })
      .where(eq(tarjetasPlan.id, t.id));
    return "EN_PROCESO";
  } catch (e) {
    console.error("Cobro automático:", e);
    await db.update(pagosPlan).set({ estado: "RECHAZADO" }).where(eq(pagosPlan.id, orden.id));
    await registrarFallo(t);
    return "FALLIDO";
  }
}

/**
 * Lo que corre el cron cada día: reserva el turno de cada tarjeta que ya toca
 * (adelantando su próximo cobro un día, de forma atómica) y la cobra.
 */
export async function ejecutarCobros() {
  const vencidas = await db
    .select({ id: tarjetasPlan.id })
    .from(tarjetasPlan)
    .where(and(eq(tarjetasPlan.estado, "ACTIVA"), isNotNull(tarjetasPlan.proximoCobro), lte(tarjetasPlan.proximoCobro, new Date())));

  const resumen = { revisadas: vencidas.length, pagadas: 0, fallidas: 0, enProceso: 0, omitidas: 0 };
  for (const { id } of vencidas) {
    const [reservada] = await db
      .update(tarjetasPlan)
      .set({ proximoCobro: sql`now() + interval '1 day'`, updatedAt: new Date() })
      .where(and(eq(tarjetasPlan.id, id), eq(tarjetasPlan.estado, "ACTIVA"), lte(tarjetasPlan.proximoCobro, new Date())))
      .returning();
    if (!reservada) continue; // otro proceso se adelantó

    const r = await cobrarTarjeta(reservada);
    if (r === "PAGADO") resumen.pagadas++;
    else if (r === "FALLIDO") resumen.fallidas++;
    else if (r === "EN_PROCESO") resumen.enProceso++;
    else resumen.omitidas++;
  }
  return resumen;
}

export type ResultadoRegistro = "ACTIVA" | "COBRO_FALLIDO" | "FALLIDO" | "DESCONOCIDO";

/**
 * Flow devuelve al comité después de registrar la tarjeta. Se le pregunta a Flow
 * si quedó guardada; si el plan no está vigente se cobra el primer período de una
 * vez, y si ya lo está el cobro se programa para cuando termine.
 */
export async function completarRegistroTarjeta(token: string): Promise<ResultadoRegistro> {
  const t = await db.query.tarjetasPlan.findFirst({ where: eq(tarjetasPlan.registroToken, token) });
  if (!t) {
    console.warn("Registro de tarjeta: no hay ninguna tarjeta pendiente con ese token.");
    return "DESCONOCIDO";
  }
  if (t.estado === "ACTIVA") return "ACTIVA";

  const r = await estadoRegistroTarjetaFlow(token);
  if (!r.registrada) {
    console.warn("Registro de tarjeta: Flow no la dio por guardada, status =", r.status);
    await db
      .update(tarjetasPlan)
      .set({ estado: "CANCELADA", proximoCobro: null, updatedAt: new Date() })
      .where(and(eq(tarjetasPlan.id, t.id), eq(tarjetasPlan.estado, "PENDIENTE")));
    return "FALLIDO";
  }

  const fin = await finVigencia(t.aprId);
  const vigente = fin !== null && fin.getTime() > Date.now();
  const [activada] = await db
    .update(tarjetasPlan)
    .set({
      estado: "ACTIVA",
      tarjetaTipo: r.tipo,
      tarjetaUltimos: r.ultimos,
      intentos: 0,
      // Si ya hay plan pagado, se cobra cuando termine; si no, el cobro se hace ahora mismo.
      proximoCobro: vigente ? fin : new Date(Date.now() + DIA),
      updatedAt: new Date(),
    })
    .where(and(eq(tarjetasPlan.id, t.id), eq(tarjetasPlan.estado, "PENDIENTE")))
    .returning();
  if (!activada) return "ACTIVA";
  if (vigente) return "ACTIVA";

  const cobro = await cobrarTarjeta(activada);
  return cobro === "FALLIDO" ? "COBRO_FALLIDO" : "ACTIVA";
}
