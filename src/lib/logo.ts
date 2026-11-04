/** Lo que comparten la subida del logo del comité (navegador y servidor) y los recibos. */

export const PREFIJO_LOGO = "data:image/png;base64,";

/** Lado mayor máximo, en píxeles. Sobra para los 44 pt del recibo impreso. */
export const LOGO_MAX_LADO = 320;

/** Peso máximo del PNG. El logo viaja con cada consulta del comité, así que tiene que ser liviano. */
export const LOGO_MAX_BYTES = 40_000;

/** Los bytes del PNG de un logo guardado, o null si el comité no tiene (o está dañado). */
export function bytesDeLogo(logoUrl: string | null): Uint8Array | null {
  if (!logoUrl?.startsWith(PREFIJO_LOGO)) return null;
  return Buffer.from(logoUrl.slice(PREFIJO_LOGO.length), "base64");
}
