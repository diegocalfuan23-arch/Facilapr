import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Enlace personal con el que la directiva invita a un socio a su cuenta en
 * línea. Va por WhatsApp al teléfono que el comité tiene del socio: quien lo
 * abre elige su clave y entra, sin pedir acceso ni esperar aprobación.
 *
 * El código lleva el id del socio y el vencimiento, firmados (HMAC): no se puede
 * adivinar el de otro ni alargar la vigencia, y no necesita columna en la base.
 * Deja de servir apenas el socio crea su cuenta (lo comprueba la página).
 *
 * No lleva puntos a propósito: el proxy no reescribe rutas con punto, y este
 * enlace pasa por /<comité>/cuenta/invitacion/<código>.
 */

import { DIAS_VIGENCIA_INVITACION } from "@/lib/whatsapp";

const VIGENCIA_DIAS = DIAS_VIGENCIA_INVITACION;
const LARGO_FIRMA = 32; // caracteres hex

function firmar(payload: string, uso = "invitacion-socio") {
  const secreto = process.env.BETTER_AUTH_SECRET;
  if (!secreto) throw new Error("Falta BETTER_AUTH_SECRET.");
  return createHmac("sha256", secreto)
    .update(`${uso}:${payload}`)
    .digest("hex")
    .slice(0, LARGO_FIRMA);
}

export function codigoInvitacionSocio(socioId: string) {
  const vence = Math.floor(Date.now() / 1000) + VIGENCIA_DIAS * 86_400;
  const payload = Buffer.from(`${socioId}|${vence}`).toString("base64url");
  return `${payload}${firmar(payload)}`;
}

/** El id del socio si el código es auténtico y no venció; null en cualquier otro caso. */
export function leerInvitacionSocio(codigo: string): string | null {
  if (codigo.length <= LARGO_FIRMA) return null;

  const payload = codigo.slice(0, -LARGO_FIRMA);
  const recibida = Buffer.from(codigo.slice(-LARGO_FIRMA));
  const esperada = Buffer.from(firmar(payload));
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
    return null;
  }

  const [socioId, vence] = Buffer.from(payload, "base64url").toString().split("|");
  if (!socioId || !vence || Number(vence) < Date.now() / 1000) return null;
  return socioId;
}

export function urlInvitacionSocio(slug: string, socioId: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.BETTER_AUTH_URL ??
    "https://facilapr.cl";
  return `${base.replace(/\/$/, "")}/${slug}/cuenta/invitacion/${codigoInvitacionSocio(socioId)}`;
}


// ---------------------------------------------------------------------------
// Restablecer la clave de un socio: la directiva NO elige ni ve la clave nueva.
// Le manda al socio un enlace y el socio elige la suya.
// ---------------------------------------------------------------------------

import { HORAS_VIGENCIA_RESTABLECER } from "@/lib/whatsapp";

const VIGENCIA_RESTABLECER_HORAS = HORAS_VIGENCIA_RESTABLECER;

/**
 * Una huella de la clave actual (no reversible). Va dentro del enlace: en cuanto
 * el socio cambia su clave, la huella ya no coincide y el enlace deja de servir,
 * así sirve una sola vez sin guardar nada en la base.
 */
export function huellaDeClave(claveHash: string) {
  return createHash("sha256").update(`huella:${claveHash}`).digest("hex").slice(0, 16);
}

export function codigoRestablecerClave(socioId: string, huella: string) {
  const vence = Math.floor(Date.now() / 1000) + VIGENCIA_RESTABLECER_HORAS * 3600;
  const payload = Buffer.from(`${socioId}|${vence}|${huella}`).toString("base64url");
  return `${payload}${firmar(payload, "restablecer-clave-socio")}`;
}

export function leerRestablecerClave(
  codigo: string
): { socioId: string; huella: string } | null {
  if (codigo.length <= LARGO_FIRMA) return null;

  const payload = codigo.slice(0, -LARGO_FIRMA);
  const recibida = Buffer.from(codigo.slice(-LARGO_FIRMA));
  const esperada = Buffer.from(firmar(payload, "restablecer-clave-socio"));
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
    return null;
  }

  const [socioId, vence, huella] = Buffer.from(payload, "base64url").toString().split("|");
  if (!socioId || !vence || !huella || Number(vence) < Date.now() / 1000) return null;
  return { socioId, huella };
}

export function urlRestablecerClave(slug: string, socioId: string, huella: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.BETTER_AUTH_URL ??
    "https://facilapr.cl";
  return `${base.replace(/\/$/, "")}/${slug}/cuenta/restablecer/${codigoRestablecerClave(socioId, huella)}`;
}
