"use server";

import { requireFinanzas } from "@/lib/apr-session";
import { enviarComprobante, type ResultadoComprobante } from "@/lib/whatsapp-comprobante";

/**
 * «Enviar» en el comprobante de un pago de boleta: sale por la API de WhatsApp si el envío automático
 * está activo, el socio aceptó recibir mensajes y al comité le quedan mensajes del mes. Si no,
 * el que llama abre wa.me para enviarlo a mano.
 */
export async function enviarComprobantePorWhatsApp(pagoId: string): Promise<ResultadoComprobante> {
  const { apr } = await requireFinanzas();
  return enviarComprobante(pagoId, { manual: true, aprId: apr.id });
}
