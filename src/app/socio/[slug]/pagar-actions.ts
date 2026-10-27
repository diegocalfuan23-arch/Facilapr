"use server";

import { BASE_SITIO, mpConfigurado } from "@/lib/mercadopago";
import { crearLinkPago, type ResultadoLink } from "@/lib/mercadopago-pagos";
import { cuentasDelSocio, requireSocio } from "@/lib/socio-session";

/**
 * El socio paga una de sus boletas con Mercado Pago. El link se crea en este
 * momento, con lo que le falta pagar hoy, y el dinero va a la cuenta de su comité.
 * El comité y el socio salen de la sesión, nunca del formulario.
 */
export async function pagarConMercadoPago(slug: string, boletaId: string): Promise<ResultadoLink> {
  const { socio } = await requireSocio(slug);
  if (!socio.apr.mercadoPagoHabilitado || !mpConfigurado()) {
    return { ok: false, error: "El pago en línea no está disponible por ahora." };
  }

  const cuentas = await cuentasDelSocio(socio);
  try {
    return await crearLinkPago(socio.aprId, boletaId, {
      socioIds: cuentas.map((c) => c.id),
      volverA: `${BASE_SITIO()}/${slug}/cuenta/boletas`,
    });
  } catch (e) {
    console.error("Pago del socio con Mercado Pago:", e instanceof Error ? e.message : "error");
    return { ok: false, error: "No pudimos abrir el pago. Vuelve a intentarlo en un momento." };
  }
}
