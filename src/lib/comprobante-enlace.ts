import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Enlace al comprobante de pago en PDF. Igual que el del recibo (ver
 * recibo-enlace.ts): va firmado con el id del pago, no necesita columna y quien
 * lo recibe lo abre sin iniciar sesión.
 */

const LARGO_FIRMA = 22;

function firma(pagoId: string) {
  const secreto = process.env.BETTER_AUTH_SECRET;
  if (!secreto) throw new Error("Falta BETTER_AUTH_SECRET.");
  return createHmac("sha256", secreto)
    .update(`comprobante:${pagoId}`)
    .digest("base64url")
    .slice(0, LARGO_FIRMA);
}

export function codigoComprobante(pagoId: string) {
  return `${pagoId}.${firma(pagoId)}`;
}

/** El id del pago si el código es auténtico; null si fue alterado. */
export function pagoIdDeCodigo(codigo: string): string | null {
  const punto = codigo.lastIndexOf(".");
  if (punto <= 0) return null;

  const id = codigo.slice(0, punto);
  const recibida = Buffer.from(codigo.slice(punto + 1));
  const esperada = Buffer.from(firma(id));

  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada)
    ? id
    : null;
}

export function urlComprobante(pagoId: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.BETTER_AUTH_URL ??
    "https://facilapr.cl";
  return `${base.replace(/\/$/, "")}/p/${codigoComprobante(pagoId)}`;
}
