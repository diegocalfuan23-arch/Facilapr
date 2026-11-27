/** Los PDF que la IA del chat puede adjuntar: ella escribe el código y aquí se cambia por el documento. */

export type DocumentoIa = { codigo: string; descripcion: string; nombre: string; clave: string };

export const MAXIMO_DOCUMENTOS = 3;

/** Quita las marcas [DOC:…] del texto y entrega los documentos pedidos. Un código que no está en la lista se ignora. */
export function separarDocumentos(respuesta: string, disponibles: DocumentoIa[]) {
  const marca = /\[\s*DOC\s*:\s*([^\]]*)\]/gi;
  const pedidos = [...respuesta.matchAll(marca)].flatMap((m) => m[1].split(/[,\s]+/)).map((c) => c.trim().toUpperCase());
  const documentos = [...new Set(pedidos)]
    .flatMap((codigo) => disponibles.filter((d) => d.codigo === codigo))
    .slice(0, MAXIMO_DOCUMENTOS);
  const texto = respuesta.replace(marca, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { texto, documentos };
}
