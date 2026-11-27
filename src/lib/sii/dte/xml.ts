/**
 * El XML de los documentos del SII se escribe aquí a mano y ya en su forma canónica (C14N): sin elementos vacíos
 * abreviados, sin caracteres que haya que escapar y sin espacios que cambien entre lo que se firma y lo que se envía.
 */

export const NS_SII = "http://www.sii.cl/SiiDte";
export const NS_XSI = "http://www.w3.org/2001/XMLSchema-instance";

const REEMPLAZOS: Record<string, string> = { "“": "", "”": "", "‘": "", "’": "", "–": "-", "—": "-", "…": "...", "&": " y " };

/**
 * Un texto apto para el documento: cabe en ISO-8859-1, no trae signos que obliguen a escapar (el timbre se firma tal
 * cual se escribe) y no pasa del largo que acepta el SII.
 */
export function texto(valor: string, maximo: number) {
  return [...valor.normalize("NFC")]
    .map((c) => REEMPLAZOS[c] ?? c)
    .join("")
    .replace(/[<>"']/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximo)
    .trim();
}

/** «12.345.678-k» → «12345678-K», como lo pide el SII. Null si no tiene forma de RUT. */
export function rutSii(rut: string) {
  const limpio = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  const partes = limpio.match(/^(\d{2,9})([0-9K])$/);
  return partes ? `${partes[1]}-${partes[2]}` : null;
}

/** Un elemento con su contenido. Si el contenido es un texto vacío o no existe, el elemento no se escribe. */
export function el(nombre: string, contenido: string | number | null | undefined) {
  return contenido === null || contenido === undefined || contenido === "" ? "" : `<${nombre}>${contenido}</${nombre}>`;
}

/** Base64 en líneas de 64: el SII rechaza líneas muy largas. */
export const enLineas = (base64: string) => base64.replace(/\s+/g, "").replace(/(.{64})(?=.)/g, "$1\n");

const HORA_CHILE = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** «AAAA-MM-DDThh:mm:ss» en hora de Chile. */
export const sello = (fecha = new Date()) => HORA_CHILE.format(fecha).replace(" ", "T");
