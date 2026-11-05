import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatearPeriodo } from "@/lib/boletas";
import { formatearRut } from "@/lib/formato";
import { textoMedioLinea } from "@/lib/finanzas-comun";
import { dibujarLogo, seguro } from "@/lib/recibo-pdf";
import type { LiquidacionDatos } from "@/lib/liquidacion";

/**
 * Liquidación de sueldo en PDF (A4): lo que se le entrega a la persona y firma. Es un documento interno del
 * comité con los números de Remuneraciones, no un documento tributario. Se dibuja a mano con pdf-lib.
 */

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const dinero = (n: number) => clp.format(n).replace(/ /g, " ");
const fecha = (iso: string) => iso.split("-").reverse().join("-");
const numero = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

const NEGRO = rgb(0.09, 0.09, 0.09);
const GRIS = rgb(0.4, 0.4, 0.4);
const LINEA = rgb(0.78, 0.78, 0.78);
const FONDO = rgb(0.96, 0.96, 0.97);

export async function generarLiquidacionPdf(l: LiquidacionDatos): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Liquidación de sueldo ${l.periodo} - ${l.persona.nombre}`);
  pdf.setProducer("Facilapr");

  const ancho = 595.28;
  const alto = 841.89;
  const margen = 48;
  const page = pdf.addPage([ancho, alto]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const derechaX = ancho - margen;
  let y = alto - margen;

  function texto(t: string, x: number, tam: number, o: { fuente?: PDFFont; color?: ReturnType<typeof rgb>; derecha?: boolean } = {}) {
    const fuente = o.fuente ?? normal;
    const limpio = seguro(fuente, t);
    const w = fuente.widthOfTextAtSize(limpio, tam);
    page.drawText(limpio, { x: o.derecha ? x - w : x, y, size: tam, font: fuente, color: o.color ?? NEGRO });
  }
  function linea(grosor = 0.6) {
    page.drawLine({ start: { x: margen, y }, end: { x: derechaX, y }, thickness: grosor, color: LINEA });
  }
  function fila(etiqueta: string, valor: string, o: { detalle?: string; negrita?: boolean; signo?: "+" | "-" } = {}) {
    const fuente = o.negrita ? negrita : normal;
    texto(etiqueta, margen, 10.5, { fuente });
    if (o.detalle) texto(o.detalle, margen + 230, 9, { color: GRIS });
    texto(`${o.signo ?? ""}${valor}`, derechaX, 10.5, { fuente, derecha: true });
    y -= 17;
  }

  // ---- Encabezado.
  const izq = margen + (await dibujarLogo(pdf, page, l.comite.logo, margen, y + 11, 46));
  texto(l.comite.nombre, izq, 16, { fuente: negrita });
  texto("LIQUIDACIÓN DE SUELDO", derechaX, 12, { fuente: negrita, derecha: true });
  y -= 15;
  const sub = [
    l.comite.razonSocial,
    [l.comite.rut ? `RUT ${formatearRut(l.comite.rut)}` : null, l.comite.telefono].filter(Boolean).join("  ·  "),
    [l.comite.direccion, l.comite.comuna].filter(Boolean).join(", "),
  ].filter((s): s is string => Boolean(s));
  const der = [formatearPeriodo(l.periodo), l.estado === "PAGADA" && l.fechaPago ? `Pagada el ${fecha(l.fechaPago)}` : "Pendiente de pago"];
  for (let i = 0; i < Math.max(sub.length, der.length); i++) {
    if (sub[i]) texto(sub[i], izq, 9.5, { color: GRIS });
    if (der[i]) texto(der[i], derechaX, 9.5, { color: GRIS, derecha: true });
    y -= 13;
  }
  if (izq > margen) y = Math.min(y, alto - margen - 36 - 4);
  y -= 8;
  linea(1);
  y -= 24;

  // ---- Persona.
  texto("TRABAJADOR", margen, 8.5, { fuente: negrita, color: GRIS });
  y -= 16;
  texto(l.persona.nombre, margen, 13, { fuente: negrita });
  y -= 15;
  const datos = [
    l.persona.rut ? `RUT ${formatearRut(l.persona.rut)}` : null,
    l.persona.cargo,
    l.persona.contrato === "HONORARIO" ? "Honorarios" : "Contrato de sueldo",
    l.persona.contrato === "SUELDO" && l.persona.afp ? `AFP ${l.persona.afp}` : null,
    l.persona.fechaIngreso ? `Ingreso ${fecha(l.persona.fechaIngreso)}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  texto(datos, margen, 9.5, { color: GRIS });
  y -= 26;

  // ---- Haberes.
  page.drawRectangle({ x: margen, y: y - 5, width: derechaX - margen, height: 19, color: FONDO });
  texto("HABERES", margen + 8, 9, { fuente: negrita, color: GRIS });
  y -= 24;
  fila(l.persona.porDia ? "Días trabajados" : "Sueldo base", dinero(l.sueldoBase), {
    detalle: l.persona.porDia && l.persona.valorDia ? `a ${dinero(l.persona.valorDia)} por día` : undefined,
  });
  if (l.descAusencias > 0) {
    const partes = [l.diasDescontados > 0 ? `${numero(l.diasDescontados)} ${l.diasDescontados === 1 ? "día" : "días"}` : null, l.horasDescontadas > 0 ? `${numero(l.horasDescontadas)} h` : null]
      .filter(Boolean)
      .join(" + ");
    fila("Días y horas no pagados", dinero(l.descAusencias), { detalle: partes, signo: "-" });
  }
  if (l.montoHorasExtra > 0) fila("Horas extras", dinero(l.montoHorasExtra), { detalle: `${numero(l.horasExtra)} h`, signo: "+" });
  if (l.bonos > 0) fila("Bonos y extras", dinero(l.bonos), { signo: "+" });
  const haberes = Math.max(0, l.sueldoBase - l.descAusencias) + l.bonos + l.montoHorasExtra;
  y -= 2;
  linea();
  y -= 17;
  fila("Total haberes", dinero(haberes), { negrita: true });
  y -= 8;

  // ---- Descuentos.
  page.drawRectangle({ x: margen, y: y - 5, width: derechaX - margen, height: 19, color: FONDO });
  texto("DESCUENTOS", margen + 8, 9, { fuente: negrita, color: GRIS });
  y -= 24;
  if (l.persona.contrato === "HONORARIO") {
    if (l.retencion > 0) fila("Retención de honorarios", dinero(l.retencion), { signo: "-" });
  } else {
    if (l.descAfp > 0) fila("AFP", dinero(l.descAfp), { signo: "-" });
    if (l.descSalud > 0) fila("Salud", dinero(l.descSalud), { signo: "-" });
    if (l.descCesantia > 0) fila("Seguro de cesantía", dinero(l.descCesantia), { signo: "-" });
  }
  if (l.otrosDescuentos > 0) fila("Otros descuentos (anticipos, préstamos)", dinero(l.otrosDescuentos), { signo: "-" });
  y -= 2;
  linea();
  y -= 17;
  fila("Total descuentos", dinero(l.descuentos), { negrita: true });
  y -= 10;

  // ---- Líquido.
  page.drawRectangle({ x: margen, y: y - 12, width: derechaX - margen, height: 38, color: FONDO });
  y -= 6;
  texto("LÍQUIDO A PAGAR", margen + 12, 11, { fuente: negrita });
  texto(dinero(l.liquido), derechaX - 12, 18, { fuente: negrita, derecha: true });
  y -= 36;
  if (l.estado === "PAGADA" && l.fechaPago) {
    texto(`Pagado el ${fecha(l.fechaPago)}${l.medio ? ` por ${textoMedioLinea(l.medio).toLowerCase()}` : ""}.`, margen, 9.5, { color: GRIS });
    y -= 14;
  }
  if (l.nota) {
    texto(`Nota: ${l.nota}`, margen, 9.5, { color: GRIS });
    y -= 14;
  }

  // ---- Firmas.
  y = margen + 120;
  page.drawLine({ start: { x: margen, y }, end: { x: margen + 200, y }, thickness: 0.6, color: NEGRO });
  page.drawLine({ start: { x: derechaX - 200, y }, end: { x: derechaX, y }, thickness: 0.6, color: NEGRO });
  y -= 14;
  texto("Por el comité", margen, 9.5, { color: GRIS });
  texto("Recibí conforme (trabajador)", derechaX - 200, 9.5, { color: GRIS });
  y -= 12;
  texto(l.comite.nombre, margen, 9);
  texto(l.persona.nombre, derechaX - 200, 9);

  // ---- Pie.
  y = margen + 30;
  linea();
  y -= 13;
  texto("Liquidación interna del comité. No es un documento tributario del SII. Los descuentos legales son una estimación sobre lo imponible.", margen, 7.5, { color: GRIS });
  y -= 10;
  texto("Generado con Facilapr · facilapr.cl", margen, 7.5, { color: GRIS });

  return pdf.save();
}
