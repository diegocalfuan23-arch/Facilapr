"use server";

import { requireAdmin } from "@/lib/apr-session";
import { mpConfigurado } from "@/lib/mercadopago";
import { crearLinkPago, type ResultadoLink } from "@/lib/mercadopago-pagos";

/** Crea el link de pago de una boleta, a nombre de la cuenta de Mercado Pago del comité. */
export async function generarLinkPago(boletaId: string): Promise<ResultadoLink> {
  const { apr } = await requireAdmin();
  if (!apr.mercadoPagoHabilitado || !mpConfigurado()) {
    return { ok: false, error: "El cobro con Mercado Pago no está disponible para tu comité." };
  }
  try {
    return await crearLinkPago(apr.id, boletaId);
  } catch (e) {
    console.error("Link de pago:", e instanceof Error ? e.message : "error");
    return { ok: false, error: "No pudimos crear el link. Vuelve a intentarlo en un momento." };
  }
}
