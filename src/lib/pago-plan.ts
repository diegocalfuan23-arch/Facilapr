import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, pagosPlan } from "@/lib/db/schema";
import { estadoPagoFlow } from "@/lib/flow";

export type ResultadoPagoPlan = "PAGADO" | "RECHAZADO" | "PENDIENTE" | "DESCONOCIDO";

/**
 * Pregunta a Flow cómo quedó un pago y, si está pagado, deja el plan del comité
 * vigente. Lo llaman tanto el aviso de confirmación de Flow (servidor a servidor)
 * como el retorno del navegador: es idempotente, así que da igual cuál llegue
 * primero o si llegan los dos.
 *
 * Solo se cree lo que Flow responde a una consulta firmada con nuestras claves,
 * nunca lo que traiga la petición, y además se comprueba que el monto pagado sea
 * el de la orden.
 */
export async function aplicarPagoFlow(token: string): Promise<ResultadoPagoPlan> {
  const flow = await estadoPagoFlow(token);

  const orden = await db.query.pagosPlan.findFirst({
    where: and(eq(pagosPlan.id, flow.orden), eq(pagosPlan.flowToken, token)),
  });
  if (!orden) return "DESCONOCIDO";
  if (orden.estado === "PAGADO") return "PAGADO";

  if (flow.estado === 3 || flow.estado === 4) {
    await db
      .update(pagosPlan)
      .set({ estado: "RECHAZADO" })
      .where(and(eq(pagosPlan.id, orden.id), eq(pagosPlan.estado, "PENDIENTE")));
    return "RECHAZADO";
  }
  if (flow.estado !== 2) return "PENDIENTE";
  if (flow.monto !== orden.montoTotal) {
    console.error("Flow: el monto pagado no coincide con la orden", orden.id);
    return "DESCONOCIDO";
  }

  // El plan queda pagado desde hoy, o desde donde terminaba el período vigente si se renueva antes de tiempo.
  const vigentes = await db
    .select({ hasta: pagosPlan.vigenteHasta })
    .from(pagosPlan)
    .where(and(eq(pagosPlan.aprId, orden.aprId), eq(pagosPlan.estado, "PAGADO")));
  const ahora = new Date();
  const finActual = vigentes.reduce<Date>((m, v) => (v.hasta && v.hasta > m ? v.hasta : m), ahora);
  const desde = finActual > ahora ? finActual : ahora;
  const hasta = new Date(desde);
  hasta.setUTCMonth(hasta.getUTCMonth() + (orden.periodo === "ANUAL" ? 12 : 1));

  const actualizada = await db
    .update(pagosPlan)
    .set({ estado: "PAGADO", pagadoAt: ahora, vigenteDesde: desde, vigenteHasta: hasta, flowOrder: flow.flowOrder || orden.flowOrder })
    .where(and(eq(pagosPlan.id, orden.id), eq(pagosPlan.estado, "PENDIENTE")))
    .returning({ id: pagosPlan.id });

  // Solo quien logró marcarla como pagada cambia el plan: así no se aplica dos veces.
  if (actualizada.length > 0) {
    await db
      .update(aprs)
      .set({ plan: orden.plan as "BASICO" | "ESTANDAR" | "PREMIUM", updatedAt: new Date() })
      .where(eq(aprs.id, orden.aprId));
  }
  return "PAGADO";
}
