import bwipjs from "bwip-js/node";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import { totales, type DatosBoleta, type Emisor } from "@/lib/sii/dte/boleta";
import { rutSii, texto } from "@/lib/sii/dte/xml";

/**
 * La boleta impresa (PDF), según el manual de muestras impresas del SII: una página, todo en texto salvo el timbre,
 * que va como imagen PNG de un código PDF417, a 2 cm o más del borde izquierdo, entre 2×5 y 4×9 cm, con sus leyendas
 * debajo en letra de 6 o más y margen en blanco alrededor.
 */

const CM = 72 / 2.54;
const NEGRO = rgb(0, 0, 0);
const GRIS = rgb(0.35, 0.35, 0.4);

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;
const fecha = (iso: string) => iso.split("-").reverse().join("/");
const rutConPuntos = (rut: string) => {
  const [cuerpo, dv] = (rutSii(rut) ?? rut).split("-");
  return `${Number(cuerpo).toLocaleString("es-CL")}-${dv}`;
};

/** El código de barras del timbre: PDF417 con corrección de errores 5 sobre los bytes del TED en ISO-8859-1. */
export function codigoDelTimbre(timbre: string): Promise<Buffer> {
  // `binarytext`: cada carácter es un byte, tal como se firmó. Las columnas dan una proporción cercana a 2,5 a 1.
  const opciones = { bcid: "pdf417", text: timbre, binarytext: true, eclevel: 5, columns: 15, scale: 4, paddingwidth: 0, paddingheight: 0 };
  // Los tipos de la librería no conocen las opciones propias de PDF417 ni distinguen la variante con promesa.
  return bwipjs.toBuffer(opciones) as unknown as Promise<Buffer>;
}

export async function boletaPdf(
  boleta: DatosBoleta,
  { emisor, timbre, resolucion }: { emisor: Emisor; timbre: string; resolucion: { fecha: string; numero: number } }
) {
  const pdf = await PDFDocument.create();
  // Media carta apaisada.
  const ancho = 612;
  const alto = 396;
  const pagina = pdf.addPage([ancho, alto]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const izq = 2 * CM;
  const der = ancho - 32;

  const recortar = (t: string, fuente: PDFFont, tam: number, maximo: number) => {
    let s = texto(t, 200);
    while (s && fuente.widthOfTextAtSize(s, tam) > maximo) s = s.slice(0, -1);
    return s;
  };
  const escribir = (t: string, x: number, y: number, tam = 9, { fuente = normal, color = NEGRO, derecha = false, maximo = 0 } = {}) => {
    const s = maximo ? recortar(t, fuente, tam, maximo) : t;
    pagina.drawText(s, { x: derecha ? x - fuente.widthOfTextAtSize(s, tam) : x, y, size: tam, font: fuente, color });
  };

  // ---- Quién emite, y el recuadro con el documento.
  let y = alto - 40;
  escribir(emisor.razonSocial, izq, y, 12, { fuente: negrita, maximo: 300 });
  for (const linea of [emisor.giro, `${emisor.direccion}, ${emisor.comuna}`]) {
    y -= 12;
    escribir(linea, izq, y, 8.5, { color: GRIS, maximo: 300 });
  }
  const caja = { x: der - 200, y: alto - 92, w: 200, h: 68 };
  pagina.drawRectangle({ x: caja.x, y: caja.y, width: caja.w, height: caja.h, borderWidth: 1.5, borderColor: NEGRO });
  const titulos = [`R.U.T.: ${rutConPuntos(emisor.rut)}`, boleta.tipo === 41 ? "BOLETA NO AFECTA O EXENTA" : "BOLETA", "ELECTRÓNICA", `N° ${boleta.folio}`];
  titulos.forEach((t, i) => {
    const tam = i === 0 || i === 3 ? 11 : 9.5;
    escribir(t, caja.x + (caja.w - negrita.widthOfTextAtSize(t, tam)) / 2, caja.y + caja.h - 16 - i * 15, tam, { fuente: negrita });
  });

  // ---- A quién y por qué período.
  y = alto - 112;
  const receptor: [string, string][] = [
    ["Señor(a)", boleta.receptor.nombre],
    ["R.U.T.", rutConPuntos(boleta.receptor.rut)],
    ["Dirección", [boleta.receptor.direccion, boleta.receptor.comuna].filter(Boolean).join(", ")],
    ...(boleta.receptor.numeroCliente ? ([["N° cliente", boleta.receptor.numeroCliente]] as [string, string][]) : []),
  ];
  const datos: [string, string][] = [
    ["Emisión", fecha(boleta.fecha)],
    ["Vencimiento", fecha(boleta.vencimiento)],
    ...(boleta.periodoDesde && boleta.periodoHasta ? ([["Período", `${fecha(boleta.periodoDesde)} al ${fecha(boleta.periodoHasta)}`]] as [string, string][]) : []),
  ];
  for (let i = 0; i < Math.max(receptor.length, datos.length); i++) {
    if (receptor[i]) {
      escribir(receptor[i][0], izq, y, 8.5, { color: GRIS });
      escribir(receptor[i][1], izq + 58, y, 9, { maximo: 260 });
    }
    if (datos[i]) {
      escribir(datos[i][0], der - 200, y, 8.5, { color: GRIS });
      escribir(datos[i][1], der, y, 9, { derecha: true });
    }
    y -= 12;
  }

  // ---- Detalle y totales.
  y -= 6;
  const raya = () => pagina.drawLine({ start: { x: izq, y }, end: { x: der, y }, thickness: 0.6, color: NEGRO });
  raya();
  y -= 12;
  escribir("Detalle", izq, y, 8.5, { fuente: negrita });
  escribir("Cantidad", der - 150, y, 8.5, { fuente: negrita, derecha: true });
  escribir("Precio", der - 80, y, 8.5, { fuente: negrita, derecha: true });
  escribir("Monto", der, y, 8.5, { fuente: negrita, derecha: true });
  // En media carta caben ocho líneas; el agua usa dos o tres.
  if (boleta.items.length > 8) throw new Error("La boleta impresa admite hasta 8 líneas.");
  for (const item of boleta.items) {
    y -= 12;
    escribir(item.nombre, izq, y, 9, { maximo: der - 220 - izq });
    if (item.cantidad !== undefined) escribir(`${item.cantidad.toLocaleString("es-CL")} ${item.unidad ?? ""}`.trim(), der - 150, y, 9, { derecha: true });
    if (item.precio !== undefined) escribir(`$${item.precio.toLocaleString("es-CL", { maximumFractionDigits: 2 })}`, der - 80, y, 9, { derecha: true });
    escribir(clp(item.monto), der, y, 9, { derecha: true });
  }
  y -= 7;
  raya();

  const t = totales(boleta.tipo, boleta.items);
  const filas: [string, number][] = boleta.tipo === 41 ? [["Exento", t.exento!]] : [["Neto", t.neto!], ["IVA 19 %", t.iva!]];
  for (const [nombre, monto] of filas) {
    y -= 12;
    escribir(nombre, der - 100, y, 9, { derecha: true });
    escribir(clp(monto), der, y, 9, { derecha: true });
  }
  y -= 16;
  escribir("TOTAL", der - 100, y, 11, { fuente: negrita, derecha: true });
  escribir(clp(t.total), der, y, 11, { fuente: negrita, derecha: true });

  // ---- El timbre, abajo a la izquierda.
  const imagen = await pdf.embedPng(await codigoDelTimbre(timbre));
  const proporcion = imagen.width / imagen.height;
  let w = 7.5 * CM;
  let h = w / proporcion;
  if (h > 3.6 * CM) {
    h = 3.6 * CM;
    w = h * proporcion;
  }
  if (w < 5 * CM || h < 2 * CM) throw new Error("El timbre quedaría fuera de los tamaños que acepta el SII.");
  const base = 40;
  if (base + h + 6 > y && izq + w > der - 200) throw new Error("El detalle no deja espacio para el timbre.");
  pagina.drawImage(imagen, { x: izq, y: base, width: w, height: h });
  const centrado = (t: string, yy: number) => escribir(t, izq + (w - normal.widthOfTextAtSize(t, 7)) / 2, yy, 7);
  centrado("Timbre Electrónico SII", base - 12);
  centrado(`Res. ${resolucion.numero} de ${resolucion.fecha.slice(0, 4)} - Verifique documento: www.sii.cl`, base - 21);

  return pdf.save();
}
