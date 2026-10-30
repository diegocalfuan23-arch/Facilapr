import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/lib/db";
import { aprs, boletas, pagos, socios } from "@/lib/db/schema";
import { recalcularBoleta } from "@/lib/boleta-saldo";
import { enviarComprobanteAuto } from "@/lib/whatsapp-comprobante";
import { formatearPeriodo, saldo } from "@/lib/boletas";
import { BASE_SITIO, estadoConexion, modoMp, mpConfigurado, tokenDelComite } from "@/lib/mercadopago";

/**
 * Cobro de boletas con Mercado Pago (Checkout Pro, API de Preferencias). El link
 * se crea con el token del comité, así que el dinero va directo a su cuenta.
 * (Campos y direcciones tomados de memoria: confirmar contra la documentación.)
 */

/** ¿Los socios de este comité pueden pagar en línea? Interruptor prendido, servidor configurado y cuenta conectada. */
export async function pagoEnLineaActivo(apr: { id: string; mercadoPagoHabilitado: boolean }) {
  return apr.mercadoPagoHabilitado && mpConfigurado() && Boolean(await estadoConexion(apr.id));
}

export type ResultadoLink = { ok: true; url: string; monto: number } | { ok: false; error: string };

/**
 * Crea el link de pago de una boleta. `socioIds` limita a qué socios puede pertenecer
 * la boleta (el portal lo usa para que nadie pague la de otro) y `volverA` es la
 * dirección a la que Mercado Pago devuelve al socio después de pagar.
 */
export async function crearLinkPago(
  aprId: string,
  boletaId: string,
  opciones: { socioIds?: string[]; volverA?: string } = {}
): Promise<ResultadoLink> {
  const [fila] = await db
    .select({
      id: boletas.id,
      periodo: boletas.periodo,
      montoTotal: boletas.montoTotal,
      montoPagado: boletas.montoPagado,
      estado: boletas.estado,
      socioId: boletas.socioId,
      comite: aprs.nombre,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .innerJoin(aprs, eq(socios.aprId, aprs.id))
    .where(and(eq(boletas.id, boletaId), eq(socios.aprId, aprId)))
    .limit(1);
  if (!fila || (opciones.socioIds && !opciones.socioIds.includes(fila.socioId))) {
    return { ok: false, error: "No encontramos esa boleta." };
  }
  if (fila.estado === "ANULADA") return { ok: false, error: "Esa boleta está anulada." };

  const monto = saldo(fila.montoTotal, fila.montoPagado);
  if (monto <= 0) return { ok: false, error: "Esa boleta ya está pagada completa." };

  const token = await tokenDelComite(aprId);
  if (!token) return { ok: false, error: "Conecta primero la cuenta de Mercado Pago del comité." };

  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      items: [
        {
          id: fila.id,
          title: `Agua potable ${formatearPeriodo(fila.periodo)} · ${fila.comite}`.slice(0, 250),
          quantity: 1,
          unit_price: monto,
          currency_id: "CLP",
        },
      ],
      // La boleta a la que corresponde el pago: de aquí la lee el aviso de Mercado Pago.
      external_reference: fila.id,
      notification_url: `${BASE_SITIO()}/api/mercadopago/webhook?apr=${encodeURIComponent(aprId)}`,
      // Si pagó desde su portal, Mercado Pago lo devuelve ahí.
      ...(opciones.volverA
        ? {
            back_urls: {
              success: `${opciones.volverA}?pago=ok`,
              pending: `${opciones.volverA}?pago=pendiente`,
              failure: `${opciones.volverA}?pago=fallo`,
            },
            auto_return: "approved",
          }
        : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await r.json().catch(() => null)) as
    | { init_point?: string; sandbox_init_point?: string; message?: string }
    | null;
  const url = modoMp() === "prueba" ? (json?.sandbox_init_point ?? json?.init_point) : json?.init_point;
  if (!r.ok || !url) {
    return { ok: false, error: `Mercado Pago no creó el link${json?.message ? `: ${json.message}` : ` (${r.status})`}` };
  }
  return { ok: true, url, monto };
}

type PagoMp = {
  status?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string | null;
};

export type ResultadoNotificacion = "REGISTRADO" | "DUPLICADO" | "IGNORADO";

/**
 * Procesa el aviso de Mercado Pago. Lo que llega en el aviso no se cree: se
 * le pregunta a Mercado Pago, con el token del comité, cómo quedó ese pago.
 */
export async function procesarPagoMp(aprId: string, paymentId: string): Promise<ResultadoNotificacion> {
  if (!/^\d{3,20}$/.test(paymentId)) return "IGNORADO";
  const token = await tokenDelComite(aprId);
  if (!token) return "IGNORADO";

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (r.status === 404) return "IGNORADO";
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status} al consultar el pago.`);
  const pago = (await r.json()) as PagoMp;

  if (pago.status !== "approved" || !pago.external_reference) return "IGNORADO";
  if (pago.currency_id && pago.currency_id !== "CLP") return "IGNORADO";

  const [boleta] = await db
    .select({
      id: boletas.id,
      socioId: boletas.socioId,
      montoTotal: boletas.montoTotal,
      montoPagado: boletas.montoPagado,
      estado: boletas.estado,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(boletas.id, pago.external_reference), eq(socios.aprId, aprId)))
    .limit(1);
  if (!boleta) return "IGNORADO";

  const ya = await db.query.pagos.findFirst({
    where: and(eq(pagos.medio, "MERCADO_PAGO"), eq(pagos.referencia, paymentId)),
    columns: { id: true },
  });
  if (ya) return "DUPLICADO";

  const recibido = Math.round(pago.transaction_amount ?? 0);
  if (recibido <= 0) return "IGNORADO";
  const falta = boleta.estado === "ANULADA" ? 0 : saldo(boleta.montoTotal, boleta.montoPagado);
  const fecha = pago.date_approved ? new Date(pago.date_approved) : new Date();

  try {
    if (falta > 0) {
      // Lo que cubre la boleta se anota como pago; si pagaron de más, el resto queda aparte.
      const aBoleta = Math.min(recibido, falta);
      const [pagoBoleta] = await db
        .insert(pagos)
        .values({
          boletaId: boleta.id,
          socioId: boleta.socioId,
          concepto: "BOLETA",
          monto: aBoleta,
          fecha,
          medio: "MERCADO_PAGO",
          referencia: paymentId,
        })
        .returning({ id: pagos.id });
      await recalcularBoleta(boleta.id);
      // Si el comité lo prendió, el comprobante sale solo por WhatsApp.
      after(() => enviarComprobanteAuto(pagoBoleta.id));
      if (recibido > aBoleta) {
        await db.insert(pagos).values({
          socioId: boleta.socioId,
          concepto: "OTRO",
          descripcion: "Excedente de un pago por Mercado Pago: revisar y devolver o abonar",
          monto: recibido - aBoleta,
          fecha,
          medio: "MERCADO_PAGO",
          referencia: `${paymentId}-excedente`,
        });
      }
    } else {
      // La boleta ya estaba pagada o anulada: el dinero entró igual, así que queda registrado para revisarlo.
      await db.insert(pagos).values({
        socioId: boleta.socioId,
        concepto: "OTRO",
        descripcion: "Pago por Mercado Pago de una boleta ya pagada o anulada: revisar y devolver",
        monto: recibido,
        fecha,
        medio: "MERCADO_PAGO",
        referencia: paymentId,
      });
    }
  } catch (e) {
    // Dos avisos del mismo pago a la vez: el índice único (si existe) frena el segundo.
    if ((e as { code?: string }).code === "23505") return "DUPLICADO";
    throw e;
  }
  return "REGISTRADO";
}
