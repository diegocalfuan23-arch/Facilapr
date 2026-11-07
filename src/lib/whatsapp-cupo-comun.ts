import type { Plan } from "@/lib/planes";

/**
 * Cuántos mensajes automáticos de WhatsApp (por la API de Meta, desde el número de Facilapr)
 * incluye cada plan al mes. Meta cobra cerca de $17,66 por mensaje de utilidad en Chile
 * (tarifa vigente desde el 1 de octubre de 2026): 100 ≈ $1.800, 300 ≈ $5.300, 1.000 ≈ $17.700.
 * Cuando se acaban, el envío cae al manual con wa.me. Para cambiar un tope basta con editar este número.
 */
export const MENSAJES_WHATSAPP_POR_PLAN: Record<Plan, number> = {
  BASICO: 100,
  ESTANDAR: 300,
  PREMIUM: 1000,
};

/** Lo que usó un comité este mes. `limite` es null si manda por su propio número (no gasta el cupo de Facilapr). */
export type CupoWhatsapp = {
  limite: number | null;
  usados: number;
  /** null: sin tope. */
  restantes: number | null;
  /** Se puede enviar otro mensaje automático. */
  disponible: boolean;
};

export const MENSAJE_SIN_CUPO = "Se acabaron los mensajes automáticos de este mes. Se abre WhatsApp para enviarlo a mano.";
