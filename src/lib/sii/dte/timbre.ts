import { createPrivateKey, createSign } from "node:crypto";
import { leerCaf, type Caf } from "@/lib/sii/folios";
import { el, texto } from "@/lib/sii/dte/xml";

/**
 * El timbre electrónico (TED): los datos principales del documento firmados con la llave que el SII entrega junto a
 * los folios (CAF). Es lo que va en el código de barras PDF417 del documento impreso.
 */

export type CafCompleto = Caf & {
  /** El bloque `<CAF>` tal como lo firmó el SII, sin espacios entre etiquetas: va copiado dentro del timbre. */
  bloque: string;
  /** La llave privada de los folios (PEM). Nunca sale del servidor ni se registra. */
  llave: string;
};

/** Abre un archivo de folios para timbrar con él; null si está incompleto. */
export function abrirCaf(xml: string): CafCompleto | null {
  const datos = leerCaf(xml);
  const bloque = xml.match(/<CAF[\s>][\s\S]*?<\/CAF>/)?.[0];
  const llave = xml.match(/<RSASK>\s*([\s\S]*?)\s*<\/RSASK>/)?.[1];
  if (!datos || !bloque || !llave) return null;
  return { ...datos, bloque: bloque.replace(/\r/g, "").replace(/>\s+</g, "><"), llave: llave.replace(/\r/g, "") };
}

export type DatosTimbre = {
  rutEmisor: string;
  tipo: number;
  folio: number;
  fecha: string;
  rutReceptor: string;
  nombreReceptor: string;
  total: number;
  primerItem: string;
  /** «AAAA-MM-DDThh:mm:ss». */
  sello: string;
};

export function timbrar(d: DatosTimbre, caf: CafCompleto) {
  if (d.tipo !== caf.tipo) throw new Error(`Los folios son del documento ${caf.tipo}, no del ${d.tipo}.`);
  if (d.folio < caf.desde || d.folio > caf.hasta) throw new Error(`El folio ${d.folio} está fuera del tramo ${caf.desde} a ${caf.hasta}.`);
  if (d.rutEmisor !== caf.rut) throw new Error("Los folios son de otro RUT.");

  const dd = `<DD>${el("RE", d.rutEmisor)}${el("TD", d.tipo)}${el("F", d.folio)}${el("FE", d.fecha)}${el("RR", d.rutReceptor)}${el(
    "RSR",
    texto(d.nombreReceptor, 40)
  )}${el("MNT", d.total)}${el("IT1", texto(d.primerItem, 40))}${caf.bloque}${el("TSTED", d.sello)}</DD>`;

  // Se firman los bytes en ISO-8859-1, que es la codificación del documento.
  const firma = createSign("RSA-SHA1").update(Buffer.from(dd, "latin1")).sign(createPrivateKey(caf.llave), "base64");
  return `<TED version="1.0">${dd}<FRMT algoritmo="SHA1withRSA">${firma}</FRMT></TED>`;
}
