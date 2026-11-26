import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatearRut } from "@/lib/formato";
import { dibujarLogo, nombreEnEncabezado, seguro } from "@/lib/recibo-pdf";
import type { ComiteFicha } from "@/lib/activo-pdf";
import { formatearPeriodo } from "@/lib/boletas";
import type { DatosTarifa } from "@/lib/tarifa";
import { mesCortoDe, metros, noFacturada, porcentaje, promedio, totalesDeAgua } from "@/lib/tarifa-comun";

/**
 * Los antecedentes de un año para fijar la tarifa, en PDF (A4): volúmenes, consumo por arranque, facturación,
 * ingresos, costos y tarifa vigente. Solo lleva lo que está registrado; se dibuja a mano con pdf-lib.
 */

type Tarifa = { cargoFijo: number | null; valorM3: number | null; cargoFijoComercial: number | null; valorM3Comercial: number | null };

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const dinero = (n: number) => `${n < 0 ? "-" : ""}${clp.format(Math.abs(n)).replace(/ /g, " ")}`;
const fecha = (iso: string) => iso.split("-").reverse().join("-");

const NEGRO = rgb(0.09, 0.09, 0.09);
const GRIS = rgb(0.4, 0.4, 0.4);
const LINEA = rgb(0.82, 0.82, 0.84);
const FONDO = rgb(0.96, 0.96, 0.97);
const OSCURO = rgb(0.12, 0.22, 0.4);
const CLARO = rgb(0.72, 0.77, 0.86);

export async function generarTarifaPdf(comite: ComiteFicha & { region: string | null }, d: DatosTarifa, tarifa: Tarifa, hoy: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Antecedentes tarifarios ${d.anio} - ${comite.nombre}`);
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
  function ajustar(t: string, tam: number, max: number, fuente: PDFFont = normal) {
    let s = seguro(fuente, t);
    if (fuente.widthOfTextAtSize(s, tam) <= max) return s;
    while (s.length > 1 && fuente.widthOfTextAtSize(`${s}...`, tam) > max) s = s.slice(0, -1);
    return `${s.trimEnd()}...`;
  }
  function linea(grosor = 0.6) {
    page.drawLine({ start: { x: margen, y }, end: { x: derechaX, y }, thickness: grosor, color: LINEA });
  }
  /** Si lo que viene no cabe en lo que queda de la hoja, sigue en una nueva. Dice si cambió de hoja. */
  function espacio(necesario: number) {
    if (y - necesario >= margen + 36) return false;
    page = pdf.addPage([ancho, alto]);
    y = alto - margen;
    return true;
  }
  /** `junto`: lo que ocupa el contenido que no conviene separar del título. */
  function seccion(titulo: string, junto = 50) {
    espacio(junto + 30);
    page.drawRectangle({ x: margen, y: y - 5, width: derechaX - margen, height: 19, color: FONDO });
    texto(titulo, margen + 8, 9, { fuente: negrita, color: GRIS });
    y -= 26;
  }
  function fila(etiqueta: string, valor: string, o: { negrita?: boolean } = {}) {
    espacio(20);
    const fuente = o.negrita ? negrita : normal;
    texto(ajustar(etiqueta, 10.5, derechaX - margen - 150, fuente), margen, 10.5, { fuente });
    texto(valor, derechaX, 10.5, { fuente, derecha: true });
    y -= 17;
  }
  function vacio(t: string) {
    espacio(20);
    texto(t, margen, 9.5, { color: GRIS });
    y -= 17;
  }
  function conParte(nombre: string, monto: number, total: number) {
    espacio(20);
    texto(ajustar(nombre, 10.5, derechaX - margen - 170), margen, 10.5);
    texto(total > 0 ? porcentaje((monto / total) * 100) : "", derechaX - 100, 9.5, { color: GRIS, derecha: true });
    texto(dinero(monto), derechaX, 10.5, { derecha: true });
    y -= 17;
  }

  // ---- Encabezado.
  const izq = margen + (await dibujarLogo(pdf, page, comite.logo, margen, y + 11, 46));
  const titulo = "ANTECEDENTES TARIFARIOS";
  const nombre = nombreEnEncabezado(negrita, comite.nombre, 16, derechaX - negrita.widthOfTextAtSize(titulo, 12) - 12 - izq);
  texto(titulo, derechaX, 12, { fuente: negrita, derecha: true });
  for (const l of nombre.lineas) {
    texto(l, izq, nombre.tam, { fuente: negrita });
    y -= 15;
  }
  const sub = [
    comite.razonSocial,
    comite.rut ? `RUT ${formatearRut(comite.rut)}` : null,
    [comite.direccion, comite.comuna, comite.region].filter(Boolean).join(", "),
  ].filter((s): s is string => Boolean(s));
  const enCurso = d.anio === Number(hoy.slice(0, 4));
  const der = [enCurso ? `Año ${d.anio}, hasta el ${fecha(hoy)}` : `Año ${d.anio}`, `Emitido el ${fecha(hoy)}`];
  for (let i = 0; i < Math.max(sub.length, der.length); i++) {
    if (sub[i]) texto(ajustar(sub[i], 9.5, derechaX - izq - 160), izq, 9.5, { color: GRIS });
    if (der[i]) texto(der[i], derechaX, 9.5, { color: GRIS, derecha: true });
    y -= 13;
  }
  if (izq > margen) y = Math.min(y, alto - margen - 36 - 4);
  y -= 8;
  linea(1);
  y -= 28;

  // ---- Resumen.
  const agua = totalesDeAgua(d.meses);
  const resultado = d.totalIngresos - d.totalEgresos;
  seccion("RESUMEN");
  fila("Cuentas activas", `${d.cuentas.socios + d.cuentas.usuarios}  (${d.cuentas.socios} socios y ${d.cuentas.usuarios} usuarios)`);
  fila("Agua producida", agua.producido > 0 ? `${metros(agua.producido)} m³` : "Sin registro");
  fila("Agua facturada", `${metros(agua.facturado)} m³`);
  fila("Agua no facturada", agua.noFacturada === null ? "Sin registro de producción" : `${porcentaje(agua.noFacturada)}  (${agua.mesesComparables} ${agua.mesesComparables === 1 ? "mes" : "meses"})`);
  fila("Resultado de caja (ingresos menos egresos)", dinero(resultado), { negrita: true });
  y -= 14;

  // ---- Volúmenes.
  seccion("VOLÚMENES PRODUCIDOS Y FACTURADOS (m³)", 190);
  const maximo = Math.max(0, ...d.meses.map((m) => Math.max(m.producido ?? 0, m.facturado)));
  if (maximo > 0) {
    const altoGrafico = 90;
    const base = y - altoGrafico;
    const paso = (derechaX - margen) / d.meses.length;
    const barra = Math.min(14, paso / 2 - 4);
    d.meses.forEach((m, i) => {
      const centro = margen + paso * i + paso / 2;
      if (m.producido) page.drawRectangle({ x: centro - barra - 1, y: base, width: barra, height: (m.producido / maximo) * altoGrafico, color: CLARO });
      if (m.facturado) page.drawRectangle({ x: centro + 1, y: base, width: barra, height: (m.facturado / maximo) * altoGrafico, color: OSCURO });
      const etiqueta = mesCortoDe(m.mes);
      page.drawText(etiqueta, { x: centro - normal.widthOfTextAtSize(etiqueta, 8) / 2, y: base - 11, size: 8, font: normal, color: GRIS });
    });
    page.drawLine({ start: { x: margen, y: base }, end: { x: derechaX, y: base }, thickness: 0.6, color: LINEA });
    y = base - 26;
    page.drawRectangle({ x: margen, y, width: 7, height: 7, color: CLARO });
    texto("Producido", margen + 11, 8, { color: GRIS });
    page.drawRectangle({ x: margen + 70, y, width: 7, height: 7, color: OSCURO });
    texto("Facturado", margen + 81, 8, { color: GRIS });
    y -= 20;
  }
  const columnas = [margen + 140, margen + 230, margen + 320, margen + 400, derechaX];
  const cabeza = () => {
    texto("MES", margen, 8.5, { fuente: negrita, color: GRIS });
    ["PRODUCIDO", "FACTURADO", "NO FACT. %", "ARRANQUES", "M³ POR ARR."].forEach((t, i) => texto(t, columnas[i], 8.5, { fuente: negrita, color: GRIS, derecha: true }));
    y -= 15;
  };
  espacio(40);
  cabeza();
  for (const m of d.meses) {
    if (espacio(20)) cabeza();
    texto(formatearPeriodo(m.mes), margen, 10);
    [
      m.producido === null ? "-" : metros(m.producido),
      metros(m.facturado),
      noFacturada(m.producido, m.facturado) === null ? "-" : porcentaje(noFacturada(m.producido, m.facturado)),
      `${m.arranques}`,
      m.arranques > 0 ? promedio(m.facturado / m.arranques) : "-",
    ].forEach((t, i) => texto(t, columnas[i], 10, { derecha: true }));
    y -= 15;
  }
  espacio(30);
  y += 5;
  linea();
  y -= 14;
  texto("Total", margen, 10, { fuente: negrita });
  texto(agua.producido > 0 ? metros(agua.producido) : "-", columnas[0], 10, { fuente: negrita, derecha: true });
  texto(metros(agua.facturado), columnas[1], 10, { fuente: negrita, derecha: true });
  texto(agua.noFacturada === null ? "-" : porcentaje(agua.noFacturada), columnas[2], 10, { fuente: negrita, derecha: true });
  y -= 14;
  texto("El agua no facturada considera solo los meses con producción anotada y boletas.", margen, 8, { color: GRIS });
  y -= 24;

  // ---- Consumo por arranque.
  const consumo = d.consumo;
  seccion(consumo ? `CONSUMO POR ARRANQUE - ${formatearPeriodo(consumo.mes).toUpperCase()}` : "CONSUMO POR ARRANQUE", 150);
  if (!consumo) vacio("No hay boletas con consumo en el año.");
  else {
    for (const r of consumo.rangos) {
      espacio(20);
      texto(r.nombre, margen, 10.5);
      texto(`${r.arranques}`, margen + 150, 10.5, { derecha: true });
      const parte = r.arranques / consumo.arranques;
      texto(porcentaje(parte * 100), margen + 215, 9.5, { color: GRIS, derecha: true });
      if (parte > 0) page.drawRectangle({ x: margen + 230, y, width: parte * (derechaX - margen - 230), height: 7, color: OSCURO });
      y -= 16;
    }
    y -= 4;
    fila("Arranques con consumo en el mes", `${consumo.arranques}`);
    fila("Consumo del mes", `${metros(consumo.m3)} m³`);
    fila("Promedio por arranque", `${promedio(consumo.m3 / consumo.arranques)} m³`, { negrita: true });
  }
  y -= 14;

  // ---- Facturación.
  const f = d.facturacion;
  seccion("LO COBRADO EN LAS BOLETAS DEL AÑO", 120);
  if (f.boletas === 0) vacio("No hay boletas en el año.");
  else {
    if (f.cargoFijo) fila("Cargo fijo", dinero(f.cargoFijo));
    if (f.variable) fila("Cargo por consumo", dinero(f.variable));
    if (f.sinDesglose) fila("Boletas ingresadas solo con el monto", dinero(f.sinDesglose));
    if (f.ajustes) fila("Otros cargos y ajustes", dinero(f.ajustes));
    if (f.subsidio) fila("Menos subsidio municipal", dinero(-f.subsidio));
    fila(`Total de ${f.boletas} ${f.boletas === 1 ? "boleta" : "boletas"}`, dinero(f.total), { negrita: true });
  }
  y -= 14;

  // ---- Ingresos y costos.
  seccion("INGRESOS DESGLOSADOS (dinero recibido)", 60);
  if (d.ingresos.length === 0) vacio("Sin ingresos registrados en el año.");
  for (const l of d.ingresos) conParte(l.nombre, l.monto, d.totalIngresos);
  fila("Total de ingresos", dinero(d.totalIngresos), { negrita: true });
  y -= 14;

  seccion("COSTOS Y GASTOS (dinero pagado)", 60);
  if (d.egresos.length === 0) vacio("Sin egresos registrados en el año.");
  for (const l of d.egresos) conParte(l.nombre, l.monto, d.totalEgresos);
  fila("Total de egresos", dinero(d.totalEgresos), { negrita: true });
  fila("Resultado de caja", dinero(resultado), { negrita: true });
  y -= 14;

  if (d.inversiones && d.inversiones.length > 0) {
    seccion("BIENES ADQUIRIDOS EN EL AÑO", 60);
    for (const l of d.inversiones) fila(l.nombre, dinero(l.monto));
    fila("Total", dinero(d.inversiones.reduce((s, l) => s + l.monto, 0)), { negrita: true });
    y -= 14;
  }

  // ---- Tarifa vigente: entera en la misma hoja.
  seccion("TARIFA VIGENTE", 80);
  const valor = (n: number | null) => (n === null ? "Sin registro" : dinero(n));
  const hayComercial = tarifa.cargoFijoComercial !== null && tarifa.valorM3Comercial !== null;
  fila(hayComercial ? "Cargo fijo mensual (residencial)" : "Cargo fijo mensual", valor(tarifa.cargoFijo));
  fila(hayComercial ? "Valor del m³ (residencial)" : "Valor del m³", valor(tarifa.valorM3));
  if (hayComercial) {
    fila("Cargo fijo mensual (comercial)", valor(tarifa.cargoFijoComercial));
    fila("Valor del m³ (comercial)", valor(tarifa.valorM3Comercial));
  }

  // ---- Firmas.
  espacio(110);
  y -= 60;
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
    const pie = (t: string, yy: number) => p.drawText(t, { x: margen, y: yy, size: 7.5, font: normal, color: GRIS });
    p.drawLine({ start: { x: margen, y: margen + 22 }, end: { x: derechaX, y: margen + 22 }, thickness: 0.6, color: LINEA });
    pie("Referencia: art. 65 del Reglamento de la Ley 20.998. No reemplaza el plan de cuentas regulatorio ni la contabilidad.", margen + 10);
    pie(`Datos registrados en Facilapr · facilapr.cl  ·  Hoja ${i + 1} de ${paginas.length}`, margen);
  });

  return pdf.save();
}
