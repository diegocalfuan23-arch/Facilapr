import type { Plan } from "@/lib/planes";

/**
 * Los precios están en una unidad de reajuste (hoy UF). Se cambian aquí: la
 * unidad y los montos, sin tocar el resto. El plan anual cobra 11 meses y da 12
 * («1 mes gratis»).
 */
export const UNIDAD = "UF";
export const MESES_GRATIS = 1;

export type ItemPlan = string | { texto: string; pronto?: boolean };

export const PLANES_COMERCIALES: {
  /** El plan de la base de datos al que corresponde. */
  clave: Plan;
  nombre: string;
  descripcion: string;
  /** Precio mensual en `UNIDAD`; null = a medida. */
  mensual: number | null;
  /** En los planes a medida, el precio mínimo («desde X»). */
  desde?: number;
  /** Lo que incluye además del plan anterior. */
  incluye?: string;
  lista: ItemPlan[];
  cta: string;
  destacado: boolean;
}[] = [
  {
    clave: "BASICO",
    nombre: "Comité Pequeño",
    descripcion: "Para APR con hasta 200 socios.",
    mensual: 0.7,
    lista: [
      "Boletas, lecturas y recibo en PDF por WhatsApp",
      "Portal para cada socio: sus boletas, pagos y solicitudes",
      "Hasta 200 socios cargados",
      "1 técnico en terreno",
      "Soporte por correo",
    ],
    cta: "Elegir plan",
    destacado: false,
  },
  {
    clave: "ESTANDAR",
    nombre: "Comité Estándar",
    descripcion: "Para APR con hasta 800 socios.",
    mensual: 1.5,
    incluye: "Todo lo del Pequeño, más:",
    lista: [
      "Chat en tiempo real con tus socios",
      "IA en el chat: responde a tus socios en segundos. Incluye 3 millones de tokens al mes (unas 1.500 respuestas) y puedes sumar packs de +2 millones",
      "Hasta 800 socios cargados",
      "Hasta 3 técnicos en terreno",
      "Sitio público con avisos de corte",
      "Te cargamos tu padrón y dejamos todo configurado",
      "Soporte prioritario",
    ],
    cta: "Elegir plan",
    destacado: true,
  },
  {
    clave: "PREMIUM",
    nombre: "APR Grande",
    descripcion: "Más de 800 socios o varias sedes.",
    mensual: null,
    desde: 4,
    incluye: "Todo lo del Estándar, más:",
    lista: [
      "Socios y técnicos sin tope",
      "IA del chat con más capacidad: 10 millones de tokens al mes (unas 5.000 respuestas) y packs adicionales",
      "Dominio propio y varios administradores con roles",
      { texto: "Conciliación de pagos con la cartola del banco", pronto: true },
      "Múltiples sedes o comités",
      "Acompañamiento en la puesta en marcha",
    ],
    cta: "Conversemos",
    destacado: false,
  },
];

export const formatoPrecio = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

/** Precio de un plan en UF: mensual o anual (11 meses). Null si es a medida. */
export function precioPlan(mensual: number | null, anual: boolean, desde?: number) {
  const base = mensual ?? desde ?? null;
  if (base === null) return null;
  return anual ? base * (12 - MESES_GRATIS) : base;
}
