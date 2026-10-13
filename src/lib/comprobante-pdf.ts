import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatearPeriodo, saldo } from "@/lib/boletas";
import { formatearRut } from "@/lib/formato";
import { textoMedioPago } from "@/lib/pagos";
import { seguro } from "@/lib/recibo-pdf";
import type { ComprobanteDatos } from "@/lib/comprobante";

/**
 * Comprobante de pago en PDF (A5): lo que recibe el socio cuando el comité
 * registra un pago. Como el recibo, es un comprobante del comité, no un
 * documento tributario del SII.
 */

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const dinero = (n: number) => clp.format(n).replace(/ /g, " ");

const fechaCorta = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const NEGRO = rgb(0.09, 0.09, 0.09);
const GRIS = rgb(0.4, 0.4, 0.4);
const LINEA = rgb(0.78, 0.78, 0.78);
const VERDE = rgb(0.1, 0.45, 0.25);

export async function generarComprobantePdf(c: ComprobanteDatos): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Comprobante de pago ${formatearPeriodo(c.periodo)} - ${c.socio.nombre}`);
  pdf.setProducer("Facilapr");

  const ancho = 419.53;
  const alto = 595.28;
  const margen = 32;
  const page = pdf.addPage([ancho, alto]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const derechaX = ancho - margen;
  let y = alto - margen;

  function texto(
    t: string,
    x: number,
    tam: number,
    o: { fuente?: PDFFont; color?: ReturnType<typeof rgb>; derecha?: boolean } = {}
  ) {
    const fuente = o.fuente ?? normal;
    const limpio = seguro(fuente, t);
    const w = fuente.widthOfTextAtSize(limpio, tam);
    page.drawText(limpio, {
      x: o.derecha ? x - w : x,
      y,
      size: tam,
      font: fuente,
      color: o.color ?? NEGRO,
    });
  }

  function linea(grosor = 0.6) {
    page.drawLine({
      start: { x: margen, y },
      end: { x: derechaX, y },
      thickness: grosor,
      color: LINEA,
    });
  }

  // ---- Encabezado.
  texto(c.comite.nombre, margen, 15, { fuente: negrita });
  texto("COMPROBANTE DE PAGO", derechaX, 11, { fuente: negrita, derecha: true });
  y -= 15;
  const subtitulos = [
    c.comite.razonSocial,
    [c.comite.rut ? `RUT ${formatearRut(c.comite.rut)}` : null, c.comite.telefono]
      .filter(Boolean)
      .join("  ·  "),
    [c.comite.direccion, c.comite.comuna].filter(Boolean).join(", "),
  ].filter((s): s is string => Boolean(s));
  const datosDer = [`N.° ${c.id.slice(-8).toUpperCase()}`, `Pagado el ${fechaCorta.format(c.fecha)}`];
  for (let i = 0; i < Math.max(subtitulos.length, datosDer.length); i++) {
    if (subtitulos[i]) texto(subtitulos[i], margen, 9, { color: GRIS });
    if (datosDer[i]) texto(datosDer[i], derechaX, 9, { color: GRIS, derecha: true });
    y -= 12;
  }
  y -= 6;
  linea(1);
  y -= 22;

  // ---- Socio.
  texto("SOCIO", margen, 8, { fuente: negrita, color: GRIS });
  y -= 15;
  texto(c.socio.nombre, margen, 12, { fuente: negrita });
  y -= 14;
  const datosSocio = [
    c.socio.rut ? `RUT ${formatearRut(c.socio.rut)}` : null,
    c.socio.numeroCliente ? `N.° de cliente ${c.socio.numeroCliente}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (datosSocio) {
    texto(datosSocio, margen, 9.5, { color: GRIS });
    y -= 12;
  }
  y -= 14;
  linea();
  y -= 30;

  // ---- Monto recibido.
  texto("PAGO RECIBIDO", margen, 8, { fuente: negrita, color: GRIS });
  y -= 26;
  texto(dinero(c.monto), margen, 26, { fuente: negrita, color: VERDE });
  y -= 30;

  function fila(etiqueta: string, valor: string, destacada = false) {
    const fuente = destacada ? negrita : normal;
    const tam = destacada ? 11.5 : 10;
    texto(etiqueta, margen, tam, { fuente, color: destacada ? NEGRO : GRIS });
    texto(valor, derechaX, tam, { fuente, derecha: true });
    y -= destacada ? 20 : 16;
  }

  fila("Medio de pago", textoMedioPago(c.medio));
  if (c.pagadoPor) fila("Pagado por", c.pagadoPor);
  if (c.referencia) fila("Referencia", c.referencia);
  fila("Correspondiente a", formatearPeriodo(c.periodo));

  y -= 4;
  linea();
  y -= 20;
  fila("Total de la boleta", dinero(c.boletaTotal));
  fila("Total pagado", dinero(c.boletaPagado));
  const porPagar = saldo(c.boletaTotal, c.boletaPagado);
  if (porPagar > 0) fila("Por pagar", dinero(porPagar), true);
  else fila("Boleta pagada completa", "", true);

  // ---- Pie.
  y = margen + 22;
  linea();
  y -= 14;
  texto(
    "Comprobante de pago del comité. No es un documento tributario del SII.",
    margen,
    8,
    { color: GRIS }
  );
  y -= 11;
  texto("Generado con Facilapr · facilapr.cl", margen, 8, { color: GRIS });

  return pdf.save();
}
