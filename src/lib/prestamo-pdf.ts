import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatearRut } from "@/lib/formato";
import { dibujarLogo, seguro } from "@/lib/recibo-pdf";
import type { ComiteFicha } from "@/lib/activo-pdf";
import { TEXTO_TIPO_PRESTAMO, planDeDescuentos, textoMedioEntrega, type PrestamoFila } from "@/lib/prestamos-comun";
import { mesVecino } from "@/lib/finanzas-comun";

/**
 * La autorización de descuento de un anticipo o préstamo en PDF (A4): los datos de lo entregado, el plan de descuentos y
 * espacio para las firmas del trabajador y del comité. Se imprime al registrar el préstamo para que lo firme la persona.
 * Es un documento interno del comité, no un documento tributario.
 */

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const dinero = (n: number) => clp.format(n).replace(/ /g, " ");
const fecha = (iso: string) => iso.split("-").reverse().join("-");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesTexto = (periodo: string) => `${MESES[Number(periodo.slice(5, 7)) - 1]} de ${periodo.slice(0, 4)}`;

const NEGRO = rgb(0.09, 0.09, 0.09);
const GRIS = rgb(0.4, 0.4, 0.4);
const LINEA = rgb(0.78, 0.78, 0.78);
const FONDO = rgb(0.96, 0.96, 0.97);

export type PersonaPrestamo = { nombre: string; rut: string | null; cargo: string; sueldo: number };

export async function generarAutorizacionPrestamoPdf(comite: ComiteFicha, p: PrestamoFila, persona: PersonaPrestamo, hoy: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const tipo = TEXTO_TIPO_PRESTAMO[p.tipo];
  pdf.setTitle(`Autorización de descuento ${p.codigo} - ${persona.nombre}`);
  pdf.setProducer("Facilapr");

  const ancho = 595.28;
  const alto = 841.89;
  const margen = 48;
  const derechaX = ancho - margen;
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([ancho, alto]);
  let y = alto - margen;

  function texto(t: string, x: number, tam: number, o: { fuente?: PDFFont; color?: ReturnType<typeof rgb>; derecha?: boolean } = {}) {
    const fuente = o.fuente ?? normal;
    const limpio = seguro(fuente, t);
    const w = fuente.widthOfTextAtSize(limpio, tam);
    page.drawText(limpio, { x: o.derecha ? x - w : x, y, size: tam, font: fuente, color: o.color ?? NEGRO });
  }
  function espacio(necesario: number) {
    if (y - necesario >= margen + 30) return;
    page = pdf.addPage([ancho, alto]);
    y = alto - margen;
  }
  function seccion(titulo: string) {
    espacio(60);
    page.drawRectangle({ x: margen, y: y - 5, width: derechaX - margen, height: 19, color: FONDO });
    texto(titulo, margen + 8, 9, { fuente: negrita, color: GRIS });
    y -= 26;
  }
  function fila(etiqueta: string, valor: string, o: { negrita?: boolean } = {}) {
    espacio(20);
    const fuente = o.negrita ? negrita : normal;
    texto(etiqueta, margen, 10.5, { fuente });
    texto(valor, derechaX, 10.5, { fuente, derecha: true });
    y -= 17;
  }
  /** Un párrafo que baja de línea cuando llega al borde. */
  function parrafo(t: string, tam = 10.5) {
    const palabras = seguro(normal, t).split(/\s+/);
    let linea = "";
    for (const palabra of palabras) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (normal.widthOfTextAtSize(prueba, tam) > derechaX - margen) {
        espacio(18);
        texto(linea, margen, tam);
        y -= 15;
        linea = palabra;
      } else linea = prueba;
    }
    if (linea) {
      espacio(18);
      texto(linea, margen, tam);
      y -= 15;
    }
  }

  // ---- Encabezado.
  const izq = margen + (await dibujarLogo(pdf, page, comite.logo, margen, y + 11, 46));
  texto(comite.nombre, izq, 16, { fuente: negrita });
  texto("AUTORIZACIÓN DE DESCUENTO", derechaX, 12, { fuente: negrita, derecha: true });
  y -= 15;
  const sub = [
    comite.razonSocial,
    [comite.rut ? `RUT ${formatearRut(comite.rut)}` : null, comite.telefono].filter(Boolean).join("  ·  "),
    [comite.direccion, comite.comuna].filter(Boolean).join(", "),
  ].filter((s): s is string => Boolean(s));
  const der = [`${tipo} ${p.codigo}`, `Emitida el ${fecha(hoy)}`];
  for (let i = 0; i < Math.max(sub.length, der.length); i++) {
    if (sub[i]) texto(sub[i], izq, 9.5, { color: GRIS });
    if (der[i]) texto(der[i], derechaX, 9.5, { color: GRIS, derecha: true });
    y -= 13;
  }
  if (izq > margen) y = Math.min(y, alto - margen - 36 - 4);
  y -= 8;
  page.drawLine({ start: { x: margen, y }, end: { x: derechaX, y }, thickness: 1, color: LINEA });
  y -= 28;

  // ---- La persona y lo entregado.
  seccion("PERSONA");
  fila("Nombre", persona.nombre);
  if (persona.rut) fila("RUT", formatearRut(persona.rut));
  fila("Cargo", persona.cargo);
  y -= 8;

  seccion(`${tipo.toUpperCase()} ENTREGADO`);
  fila("Monto entregado", dinero(p.monto), { negrita: true });
  fila("Entregado el", fecha(p.fecha));
  fila("Entregado por", textoMedioEntrega(p.medioEntrega));
  fila("Cuotas", p.cuotas === 1 ? "Se descuenta de una vez" : `${p.cuotas} cuotas de ${dinero(p.cuotaMonto)}`);
  if (persona.sueldo > 0) fila("Cuota sobre el sueldo bruto", `${((p.cuotaMonto / persona.sueldo) * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`);
  if (p.nota) fila("Motivo", p.nota.slice(0, 70));
  y -= 8;

  // ---- El plan.
  seccion("PLAN DE DESCUENTOS");
  const plan = planDeDescuentos({ descuentos: p.descuentos, cuotaMonto: p.cuotaMonto, saldo: p.saldo, estado: p.estado, primerPeriodo: p.primerPeriodo }, (m) => mesVecino(m, 1));
  for (const i of plan) {
    espacio(20);
    texto(`Liquidación de ${mesTexto(i.periodo)}`, margen, 10.5);
    texto(i.estado === "HECHO" ? "Descontada" : "", derechaX - 90, 9.5, { color: GRIS, derecha: true });
    texto(dinero(i.monto), derechaX, 10.5, { derecha: true });
    y -= 17;
  }
  y -= 8;

  // ---- La autorización.
  seccion("AUTORIZACIÓN");
  parrafo(
    `Yo, ${persona.nombre}${persona.rut ? `, RUT ${formatearRut(persona.rut)}` : ""}, declaro haber recibido de ${comite.nombre} la suma de ${dinero(p.monto)} por concepto de ${tipo.toLowerCase()}, y autorizo que se descuente de mis remuneraciones en las liquidaciones indicadas en este documento.`
  );

  // ---- Firmas.
  espacio(110);
  y -= 50;
  const mitad = (derechaX - margen - 40) / 2;
  [
    { x: margen, linea1: persona.nombre, linea2: persona.rut ? `RUT ${formatearRut(persona.rut)}` : "Trabajador(a)" },
    { x: margen + mitad + 40, linea1: comite.nombre, linea2: "Directiva del comité" },
  ].forEach((f) => {
    page.drawLine({ start: { x: f.x, y }, end: { x: f.x + mitad, y }, thickness: 0.6, color: NEGRO });
    const w1 = normal.widthOfTextAtSize(seguro(normal, f.linea1), 9.5);
    page.drawText(seguro(normal, f.linea1), { x: f.x + Math.max(0, (mitad - w1) / 2), y: y - 13, size: 9.5, font: normal, color: NEGRO });
    const w2 = normal.widthOfTextAtSize(seguro(normal, f.linea2), 9);
    page.drawText(seguro(normal, f.linea2), { x: f.x + Math.max(0, (mitad - w2) / 2), y: y - 26, size: 9, font: normal, color: GRIS });
  });

  // ---- Pie en cada hoja.
  const paginas = pdf.getPages();
  paginas.forEach((pg, i) => {
    const pie = (t: string, yy: number, x: number) => pg.drawText(t, { x, y: yy, size: 7.5, font: normal, color: GRIS });
    pg.drawLine({ start: { x: margen, y: margen + 22 }, end: { x: derechaX, y: margen + 22 }, thickness: 0.6, color: LINEA });
    pie("Documento interno del comité. No reemplaza la contabilidad ni los documentos tributarios.", margen + 10, margen);
    pie(`Generado con Facilapr · facilapr.cl  ·  Hoja ${i + 1} de ${paginas.length}`, margen, margen);
  });

  return pdf.save();
}
