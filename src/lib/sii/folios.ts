/** Lectura del archivo de folios (CAF) que el SII entrega a cada emisor. Sin base de datos. */

/** Las boletas electrónicas: 39 afecta a IVA y 41 exenta. */
export const TIPOS_BOLETA = [
  { tipo: 39, nombre: "Boleta electrónica afecta" },
  { tipo: 41, nombre: "Boleta electrónica exenta" },
] as const;

export const nombreTipoBoleta = (tipo: number) => TIPOS_BOLETA.find((t) => t.tipo === tipo)?.nombre ?? `Documento ${tipo}`;

export type Caf = {
  /** RUT del emisor al que el SII le entregó los folios. */
  rut: string;
  tipo: number;
  desde: number;
  hasta: number;
  /** Fecha de autorización (AAAA-MM-DD). */
  fecha: string;
};

/** Los datos del CAF; null si el archivo no tiene la forma de un archivo de folios completo. */
export function leerCaf(xml: string): Caf | null {
  const uno = (etiqueta: string, dentro = xml) => dentro.match(new RegExp(`<${etiqueta}>\\s*([^<]*?)\\s*</${etiqueta}>`))?.[1] ?? null;
  const rango = xml.match(/<RNG>([\s\S]*?)<\/RNG>/)?.[1];
  // Sin la firma del SII y la llave del emisor no sirve para timbrar.
  if (!/<AUTORIZACION[\s>]/.test(xml) || !/<FRMA[\s>]/.test(xml) || !/<RSASK[\s>]/.test(xml) || !rango) return null;

  const rut = uno("RE");
  const tipo = Number(uno("TD"));
  const desde = Number(uno("D", rango));
  const hasta = Number(uno("H", rango));
  const fecha = uno("FA");
  if (!rut || !fecha || !Number.isInteger(tipo) || !Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 1 || hasta < desde) return null;
  return { rut: rut.toUpperCase(), tipo, desde, hasta, fecha };
}

/** Folios que quedan por usar de un tramo. */
export const foliosDisponibles = (f: { hasta: number; siguiente: number }) => Math.max(0, f.hasta - f.siguiente + 1);
