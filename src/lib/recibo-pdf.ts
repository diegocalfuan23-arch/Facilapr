import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { formatearPeriodo, saldo } from "@/lib/boletas";
import { formatearRut } from "@/lib/formato";
import type { ReciboDatos } from "@/lib/recibo";

/**
 * Recibo de agua en PDF (A5). Es el comprobante de cobro del comité, no un
 * documento tributario. Se dibuja a mano con pdf-lib y las fuentes estándar
 * del PDF: no depende de navegador ni de archivos de fuentes, así que corre
 * igual en Vercel.
 */

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const dinero = (n: number) => clp.format(n).replace(/ /g, " ");

const fechaCorta = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const ESTADO_TEXTO = {
  PENDIENTE: "PENDIENTE DE PAGO",
  PAGADA: "PAGADA",
  VENCIDA: "VENCIDA",
  ANULADA: "ANULADA",
} as const;

const NEGRO = rgb(0.09, 0.09, 0.09);
const GRIS = rgb(0.4, 0.4, 0.4);
const LINEA = rgb(0.78, 0.78, 0.78);

/** Las fuentes estándar no codifican cualquier carácter: lo que no sirve pasa a "?". */
export function seguro(fuente: PDFFont, texto: string) {
  const permitidos = new Set(fuente.getCharacterSet());
  return Array.from(texto.replace(/\s+/g, " "))
    .map((c) => (permitidos.has(c.codePointAt(0)!) ? c : "?"))
    .join("");
}

function envolver(fuente: PDFFont, tam: number, texto: string, ancho: number) {
  const palabras = seguro(fuente, texto).split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (fuente.widthOfTextAtSize(prueba, tam) <= ancho || !actual) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export async function generarReciboPdf(r: ReciboDatos): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Recibo de agua ${formatearPeriodo(r.periodo)} - ${r.socio.nombre}`);
  pdf.setProducer("Facilapr");

  const ancho = 419.53;
  const alto = 595.28;
  const margen = 32;
  const util = ancho - margen * 2;
  const page: PDFPage = pdf.addPage([ancho, alto]);

  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = alto - margen;

  function texto(
    t: string,
    x: number,
    tam: number,
    opciones: { fuente?: PDFFont; color?: ReturnType<typeof rgb>; derecha?: boolean } = {}
  ) {
    const fuente = opciones.fuente ?? normal;
    const limpio = seguro(fuente, t);
    const w = fuente.widthOfTextAtSize(limpio, tam);
    page.drawText(limpio, {
      x: opciones.derecha ? x - w : x,
      y,
      size: tam,
      font: fuente,
      color: opciones.color ?? NEGRO,
    });
  }

  function linea(grosor = 0.6) {
    page.drawLine({
      start: { x: margen, y },
      end: { x: ancho - margen, y },
      thickness: grosor,
      color: LINEA,
    });
  }

  // ---- Encabezado: comité a la izquierda, datos del recibo a la derecha.
  const derechaX = ancho - margen;
  texto(r.comite.nombre, margen, 15, { fuente: negrita });
  texto("RECIBO DE AGUA", derechaX, 11, { fuente: negrita, derecha: true });
  y -= 15;

  const subtitulos = [
    r.comite.razonSocial,
    [r.comite.rut ? `RUT ${formatearRut(r.comite.rut)}` : null, r.comite.telefono]
      .filter(Boolean)
      .join("  ·  "),
    [r.comite.direccion, r.comite.comuna].filter(Boolean).join(", "),
  ].filter((s): s is string => Boolean(s));

  const datosDer = [
    `N.° ${r.id.slice(-8).toUpperCase()}`,
    `Emitido el ${fechaCorta.format(r.fechaEmision)}`,
  ];
  const filas = Math.max(subtitulos.length, datosDer.length);
  for (let i = 0; i < filas; i++) {
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
  texto(r.socio.nombre, margen, 12, { fuente: negrita });
  y -= 14;
  const datosSocio = [
    r.socio.rut ? `RUT ${formatearRut(r.socio.rut)}` : null,
    r.socio.numeroCliente ? `N.° de cliente ${r.socio.numeroCliente}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (datosSocio) {
    texto(datosSocio, margen, 9.5, { color: GRIS });
    y -= 12;
  }
  if (r.socio.direccion) {
    texto(r.socio.direccion, margen, 9.5, { color: GRIS });
    y -= 12;
  }

  y -= 12;
  linea();
  y -= 24;

  // ---- Período y vencimiento.
  texto(formatearPeriodo(r.periodo), margen, 16, { fuente: negrita });
  texto(`Vence el ${fechaCorta.format(r.fechaVencimiento)}`, derechaX, 10, {
    derecha: true,
    color: GRIS,
  });
  y -= 28;

  // ---- Detalle.
  function fila(etiqueta: string, valor: string, destacada = false) {
    const fuente = destacada ? negrita : normal;
    const tam = destacada ? 12 : 10;
    texto(etiqueta, margen, tam, { fuente, color: destacada ? NEGRO : GRIS });
    texto(valor, derechaX, tam, { fuente, derecha: true });
    y -= destacada ? 20 : 16;
  }

  const conLecturas = r.lecturaAnterior !== null && r.lecturaActual !== null;
  if (conLecturas) {
    fila("Lectura anterior", `${r.lecturaAnterior} m³`);
    fila("Lectura actual", `${r.lecturaActual} m³`);
  }
  if (r.consumoM3 !== null) fila("Consumo del período", `${r.consumoM3} m³`);

  if (r.cargoFijo !== null && r.valorM3 !== null && r.consumoM3 !== null) {
    fila("Cargo fijo", dinero(r.cargoFijo));
    fila(
      `Consumo: ${r.consumoM3} m³ × ${dinero(r.valorM3)}`,
      dinero(r.consumoM3 * r.valorM3)
    );
  }

  y -= 2;
  linea();
  y -= 20;
  fila("TOTAL", dinero(r.montoTotal), true);

  if (r.montoPagado > 0) {
    fila("Pagado", dinero(r.montoPagado));
    const porPagar = saldo(r.montoTotal, r.montoPagado);
    if (porPagar > 0) fila("Por pagar", dinero(porPagar), true);
  }

  // ---- Estado.
  y -= 6;
  const estado = ESTADO_TEXTO[r.estado];
  const wEstado = negrita.widthOfTextAtSize(estado, 10) + 20;
  page.drawRectangle({
    x: margen,
    y: y - 6,
    width: wEstado,
    height: 22,
    borderColor: NEGRO,
    borderWidth: 1,
  });
  texto(estado, margen + 10, 10, { fuente: negrita });
  y -= 36;

  // ---- Cómo pagar. Con QR, el texto deja libre el rincón de abajo a la derecha.
  if (r.comite.infoPago?.trim()) {
    texto("CÓMO PAGAR", margen, 8, { fuente: negrita, color: GRIS });
    y -= 14;
    for (const l of envolver(normal, 10, r.comite.infoPago.trim(), r.portal ? util - 72 : util)) {
      texto(l, margen, 10);
      y -= 13;
    }
  }

  // ---- Pie.
  y = margen + 22;
  if (r.portal) {
    // El QR ocupa la esquina de abajo a la derecha: la línea y el pie se quedan a su izquierda.
    page.drawLine({
      start: { x: margen, y },
      end: { x: derechaX - 64, y },
      thickness: 0.6,
      color: LINEA,
    });
    y -= 14;
    texto("Comprobante de cobro del comité.", margen, 8, { color: GRIS });
    y -= 10;
    texto("No es un documento tributario del SII.", margen, 8, { color: GRIS });
    y -= 10;
    texto("Generado con Facilapr · facilapr.cl", margen, 8, { color: GRIS });

    const png = await pdf.embedPng(Buffer.from(r.portal.qr.split(",")[1], "base64"));
    const lado = 54;
    page.drawImage(png, { x: derechaX - lado, y: margen - 8, width: lado, height: lado });
    y = margen - 8 + lado + 8;
    texto("Tu cuenta en línea", derechaX, 6.5, { fuente: negrita, color: GRIS, derecha: true });
    return pdf.save();
  }
  linea();
  y -= 14;
  texto(
    "Comprobante de cobro del comité. No es un documento tributario del SII.",
    margen,
    8,
    { color: GRIS }
  );
  y -= 11;
  texto("Generado con Facilapr · facilapr.cl", margen, 8, { color: GRIS });

  return pdf.save();
}
