import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatearRut } from "@/lib/formato";
import { dibujarLogo, seguro } from "@/lib/recibo-pdf";
import type { ComiteFicha } from "@/lib/activo-pdf";
import type { DatosRendicion } from "@/lib/rendicion";

/**
 * La rendición de cuentas de un año en PDF (A4), para presentarla a la asamblea: cómo se movió la plata, cuánto se cobró,
 * en qué se gastó, qué bienes tiene el comité y qué trabajos se hicieron, con espacio para las firmas de la directiva.
 * Se arma con lo que ya está registrado en la app y se dibuja a mano con pdf-lib.
 */

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const dinero = (n: number) => clp.format(n).replace(/ /g, " ");
const fecha = (iso: string) => iso.split("-").reverse().join("-");

const NEGRO = rgb(0.09, 0.09, 0.09);
const GRIS = rgb(0.4, 0.4, 0.4);
const LINEA = rgb(0.78, 0.78, 0.78);
const FONDO = rgb(0.96, 0.96, 0.97);

export async function generarRendicionPdf(comite: ComiteFicha, d: DatosRendicion, hoy: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rendición de cuentas ${d.anio} - ${comite.nombre}`);
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
  /** Recorta un texto largo para que no pise la columna de la derecha. */
  function ajustar(t: string, tam: number, max: number, fuente: PDFFont = normal) {
    let s = seguro(fuente, t);
    if (fuente.widthOfTextAtSize(s, tam) <= max) return s;
    while (s.length > 1 && fuente.widthOfTextAtSize(`${s}…`, tam) > max) s = s.slice(0, -1);
    return `${s.trimEnd()}...`;
  }
  function linea(grosor = 0.6) {
    page.drawLine({ start: { x: margen, y }, end: { x: derechaX, y }, thickness: grosor, color: LINEA });
  }
  /** Si lo que viene no cabe en lo que queda de la hoja, sigue en una nueva. */
  function espacio(necesario: number) {
    if (y - necesario >= margen + 36) return;
    page = pdf.addPage([ancho, alto]);
    y = alto - margen;
  }
  function seccion(titulo: string) {
    espacio(70);
    page.drawRectangle({ x: margen, y: y - 5, width: derechaX - margen, height: 19, color: FONDO });
    texto(titulo, margen + 8, 9, { fuente: negrita, color: GRIS });
    y -= 26;
  }
  function fila(etiqueta: string, valor: string, o: { negrita?: boolean; color?: ReturnType<typeof rgb> } = {}) {
    espacio(20);
    const fuente = o.negrita ? negrita : normal;
    texto(ajustar(etiqueta, 10.5, derechaX - margen - 130, fuente), margen, 10.5, { fuente });
    texto(valor, derechaX, 10.5, { fuente, derecha: true, color: o.color });
    y -= 17;
  }
  /** Una fila con una tercera columna (el porcentaje), para las categorías. */
  function filaCategoria(nombre: string, monto: number, total: number) {
    espacio(20);
    texto(ajustar(nombre, 10.5, derechaX - margen - 150), margen, 10.5);
    texto(total > 0 ? `${Math.round((monto / total) * 100)}%` : "", derechaX - 100, 9.5, { color: GRIS, derecha: true });
    texto(dinero(monto), derechaX, 10.5, { derecha: true });
    y -= 17;
  }
  function vacio(t: string) {
    espacio(20);
    texto(t, margen, 9.5, { color: GRIS });
    y -= 17;
  }

  const anioEnCurso = d.hasta < `${d.anio}-12-31`;

  // ---- Encabezado.
  const izq = margen + (await dibujarLogo(pdf, page, comite.logo, margen, y + 11, 46));
  texto(comite.nombre, izq, 16, { fuente: negrita });
  texto("RENDICIÓN DE CUENTAS", derechaX, 12, { fuente: negrita, derecha: true });
  y -= 15;
  const sub = [
    comite.razonSocial,
    [comite.rut ? `RUT ${formatearRut(comite.rut)}` : null, comite.telefono].filter(Boolean).join("  ·  "),
    [comite.direccion, comite.comuna].filter(Boolean).join(", "),
  ].filter((s): s is string => Boolean(s));
  const der = [anioEnCurso ? `Año ${d.anio}, hasta el ${fecha(d.hasta)}` : `Año ${d.anio}`, `Emitida el ${fecha(hoy)}`];
  for (let i = 0; i < Math.max(sub.length, der.length); i++) {
    if (sub[i]) texto(sub[i], izq, 9.5, { color: GRIS });
    if (der[i]) texto(der[i], derechaX, 9.5, { color: GRIS, derecha: true });
    y -= 13;
  }
  if (izq > margen) y = Math.min(y, alto - margen - 36 - 4);
  y -= 8;
  linea(1);
  y -= 28;

  // ---- Caja.
  const ing = d.resumen.totalIngresos;
  const egr = d.resumen.totalEgresos;
  const resultado = ing - egr;
  seccion("MOVIMIENTO DE LA CAJA");
  if (d.saldoInicio !== null) fila(`Saldo al ${fecha(`${d.anio}-01-01`)}`, dinero(d.saldoInicio));
  fila("Ingresos del período", dinero(ing));
  fila("Egresos del período", dinero(egr));
  fila(resultado >= 0 ? "Resultado (entró más de lo que salió)" : "Resultado (salió más de lo que entró)", `${resultado < 0 ? "-" : ""}${dinero(Math.abs(resultado))}`, { negrita: true });
  if (d.saldoCierre !== null) fila(`Saldo al ${fecha(d.hasta)}${anioEnCurso ? "" : " (cierre)"}`, dinero(d.saldoCierre), { negrita: true });
  else vacio("El comité no tiene registrado su saldo inicial en Caja, por eso no se muestran los saldos.");
  y -= 14;

  // ---- De dónde vino y a dónde fue.
  seccion("DE DÓNDE VINO LA PLATA (INGRESOS)");
  if (d.ingresos.length === 0) vacio("Sin ingresos registrados en el período.");
  for (const c of d.ingresos) filaCategoria(c.nombre, c.monto, ing);
  y -= 14;

  seccion("EN QUÉ SE GASTÓ (EGRESOS)");
  if (d.egresos.length === 0) vacio("Sin egresos registrados en el período.");
  for (const c of d.egresos) filaCategoria(c.nombre, c.monto, egr);
  y -= 14;

  if (d.gastosGrandes.length > 0) {
    seccion("LOS MAYORES GASTOS");
    for (const g of d.gastosGrandes) {
      espacio(30);
      texto(fecha(g.fecha), margen, 9.5, { color: GRIS });
      texto(ajustar(g.concepto, 10.5, derechaX - margen - 190), margen + 62, 10.5);
      texto(dinero(g.monto), derechaX, 10.5, { derecha: true });
      y -= 13;
      const detalle = [g.categoria, g.contraparte].filter(Boolean).join("  ·  ");
      if (detalle) texto(ajustar(detalle, 8.5, derechaX - margen - 190), margen + 62, 8.5, { color: GRIS });
      y -= 13;
    }
    y -= 10;
  }

  // ---- Cobranza.
  const c = d.cobranza;
  seccion("COBRANZA A LOS SOCIOS");
  if (c.boletas === 0) vacio("No hay boletas emitidas en el período.");
  else {
    fila(`Boletas emitidas en ${d.anio}`, `${c.boletas}`);
    fila("Monto emitido", dinero(c.emitido));
    fila("Monto pagado de lo emitido", `${dinero(c.pagado)}${c.emitido > 0 ? `  (${Math.round((c.pagado / c.emitido) * 100)}%)` : ""}`);
  }
  fila("Deuda pendiente de los socios, a hoy", c.deudaTotal > 0 ? `${dinero(c.deudaTotal)}  (${c.sociosConDeuda} ${c.sociosConDeuda === 1 ? "socio" : "socios"})` : "Sin deuda");
  y -= 14;

  // ---- Patrimonio y trabajos.
  if (d.activos) {
    seccion("PATRIMONIO DEL COMITÉ");
    fila("Bienes vigentes", `${d.activos.n}`);
    fila("Valor actual de los bienes (referencia)", dinero(d.activos.valorTotal));
    fila(`Bienes comprados en ${d.anio}`, d.activos.comprados > 0 ? `${d.activos.comprados}  ·  ${dinero(d.activos.costoComprados)}` : "Ninguno");
    y -= 14;
  }
  if (d.labores || d.incidentes) {
    seccion("TRABAJOS Y FALLAS DEL SISTEMA");
    if (d.labores) {
      fila("Labores realizadas", `${d.labores.hechas}`);
      if (d.labores.programadas > 0) fila("Labores programadas o en curso", `${d.labores.programadas}`);
    }
    if (d.incidentes) {
      fila("Fallas o incidentes resueltos", `${d.incidentes.resueltos}`);
      if (d.incidentes.abiertos > 0) fila("Fallas o incidentes aún abiertos", `${d.incidentes.abiertos}`);
    }
    y -= 14;
  }

  // ---- Firmas.
  espacio(130);
  y -= 50;
  const tercio = (derechaX - margen - 40) / 3;
  ["Presidente(a)", "Tesorero(a)", "Secretario(a)"].forEach((cargo, i) => {
    const x = margen + i * (tercio + 20);
    page.drawLine({ start: { x, y }, end: { x: x + tercio, y }, thickness: 0.6, color: NEGRO });
    const w = normal.widthOfTextAtSize(cargo, 9.5);
    page.drawText(cargo, { x: x + (tercio - w) / 2, y: y - 13, size: 9.5, font: normal, color: GRIS });
  });

  // ---- Pie en cada hoja.
  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    const pie = (t: string, yy: number, x: number, derecha = false) => {
      const w = normal.widthOfTextAtSize(t, 7.5);
      p.drawText(t, { x: derecha ? x - w : x, y: yy, size: 7.5, font: normal, color: GRIS });
    };
    p.drawLine({ start: { x: margen, y: margen + 22 }, end: { x: derechaX, y: margen + 22 }, thickness: 0.6, color: LINEA });
    pie("Informe interno con los datos registrados en Facilapr. No reemplaza la contabilidad ni los documentos tributarios del comité.", margen + 10, margen);
    pie(`Generado con Facilapr · facilapr.cl  ·  Hoja ${i + 1} de ${paginas.length}`, margen, margen);
  });

  return pdf.save();
}
