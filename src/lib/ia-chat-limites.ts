import type { Plan } from "@/lib/planes";

/** Constantes y tipos de la cuota de IA: sin base de datos, para poder usarlos también en el navegador. */

/**
 * Cuánta IA del chat puede usar cada comité. Se mide en tokens (lo que de
 * verdad cuesta) y se muestra también como respuestas aproximadas, que es lo
 * que se entiende. Una respuesta del chat gasta del orden de 2.000 tokens: va
 * la ficha del socio, sus boletas, la conversación y las reglas.
 */

/** Tokens incluidos cada mes en el plan. El 1 de cada mes parten de cero. */
export const CUOTA_TOKENS_MES: Record<Plan, number> = {
  BASICO: 0,
  ESTANDAR: 3_000_000,
  PREMIUM: 10_000_000,
};

/** Un pack adicional (add-on). No vence: se usa cuando la cuota del mes se agota. */
export const PACK_TOKENS = 2_000_000;

export type UsoIaChat = {
  /** Tokens incluidos en el plan este mes. */
  cuotaMes: number;
  /** Tokens que el comité ya gastó este mes. */
  usadoMes: number;
  /** Lo que queda de la cuota del mes. */
  restanteMes: number;
  /** Tokens de packs comprados que todavía no se gastan. */
  extraRestante: number;
  /** Packs comprados desde siempre, en tokens. */
  extraComprado: number;
  /** Todo lo que se puede gastar ahora: cuota del mes + packs. */
  disponible: number;
  /** Respuestas aproximadas que alcanzan con lo disponible. */
  respuestasDisponibles: number;
  /** Respuestas que ya dio la IA este mes. */
  respuestasMes: number;
  /** Primer día del mes siguiente (ISO), cuando la cuota vuelve a empezar. */
  reinicia: string;
};
