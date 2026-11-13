import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatearRut } from "@/lib/formato";
import { dibujarLogo, seguro } from "@/lib/recibo-pdf";
import { TEXTO_ESTADO_ACTIVO, textoCategoriaActivo, valorActual, type ActivoFila } from "@/lib/activos-comun";

/**
 * La ficha de un bien del comité en PDF (A4): sus datos, lo que costó y cuánto vale hoy. Es un documento interno
 * con la depreciación lineal de Activos fijos como referencia, no un documento tributario. Se dibuja a mano con pdf-lib.
 */

export type ComiteFicha = {
  nombre: string;
  razonSocial: string | null;
  rut: string | null;
  direccion: string | null;
  comuna: string | null;
  telefono: string | null;
  logo: string | null;
};

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const dinero = (n: number) => clp.format(n).replace(/ /g, " ");
const fecha = (iso: string) => iso.split("-").reverse().join("-");

const NEGRO = rgb(0.09, 0.09, 0.09);
const GRIS = rgb(0.4, 0.4, 0.4);
const LINEA = rgb(0.78, 0.78, 0.78);
const FONDO = rgb(0.96, 0.96, 0.97);

export async function generarFichaActivoPdf(comite: ComiteFicha, a: ActivoFila, hoy: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Ficha de activo fijo - ${a.nombre}`);
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
  function fila(etiqueta: string, valor: string, o: { negrita?: boolean } = {}) {
    const fuente = o.negrita ? negrita : normal;
    texto(etiqueta, margen, 10.5, { fuente });
    texto(valor, derechaX, 10.5, { fuente, derecha: true });
    y -= 17;
  }
  function seccion(titulo: string) {
    page.drawRectangle({ x: margen, y: y - 5, width: derechaX - margen, height: 19, color: FONDO });
    texto(titulo, margen + 8, 9, { fuente: negrita, color: GRIS });
    y -= 24;
  }

  const baja = a.estado === "BAJA";
  const v = valorActual(a, hoy);
  const valor = baja ? 0 : v.valorLibro;
  const sinDepreciar = a.vidaUtilAnios <= 0;

  // ---- Encabezado.
  const izq = margen + (await dibujarLogo(pdf, page, comite.logo, margen, y + 11, 46));
  texto(comite.nombre, izq, 16, { fuente: negrita });
  texto("FICHA DE ACTIVO FIJO", derechaX, 12, { fuente: negrita, derecha: true });
  y -= 15;
  const sub = [
    comite.razonSocial,
    [comite.rut ? `RUT ${formatearRut(comite.rut)}` : null, comite.telefono].filter(Boolean).join("  ·  "),
    [comite.direccion, comite.comuna].filter(Boolean).join(", "),
  ].filter((s): s is string => Boolean(s));
  const der = [`Emitida el ${fecha(hoy)}`];
  for (let i = 0; i < Math.max(sub.length, der.length); i++) {
    if (sub[i]) texto(sub[i], izq, 9.5, { color: GRIS });
    if (der[i]) texto(der[i], derechaX, 9.5, { color: GRIS, derecha: true });
    y -= 13;
  }
  if (izq > margen) y = Math.min(y, alto - margen - 36 - 4);
  y -= 8;
  linea(1);
  y -= 24;

  // ---- El bien.
  texto("BIEN", margen, 8.5, { fuente: negrita, color: GRIS });
  y -= 18;
  texto(a.nombre, margen, 16, { fuente: negrita });
  y -= 16;
  texto([a.codigo, textoCategoriaActivo(a.categoria), TEXTO_ESTADO_ACTIVO[a.estado]].filter(Boolean).join("  ·  "), margen, 9.5, { color: GRIS });
  y -= 28;

  // ---- Datos.
  seccion("DATOS DEL BIEN");
  fila("Código", a.codigo ?? "Sin código");
  fila("Categoría", textoCategoriaActivo(a.categoria));
  fila("Estado", TEXTO_ESTADO_ACTIVO[a.estado]);
  fila("Ubicación", a.ubicacion ?? "Sin ubicación");
  fila("Responsable", a.responsable ?? "Sin responsable");
  fila("Fecha de adquisición", fecha(a.fechaAdquisicion));
  fila("Vida útil", sinDepreciar ? "No se deprecia" : `${a.vidaUtilAnios} ${a.vidaUtilAnios === 1 ? "año" : "años"}`);
  if (a.proximaMantencion) fila("Próxima mantención", fecha(a.proximaMantencion));
  if (a.estado === "EN_REPARACION" && a.reparacionDesde) {
    fila("En reparación desde", fecha(a.reparacionDesde));
    if (a.reparacionMotivo) fila("Motivo", a.reparacionMotivo.slice(0, 70));
  }
  y -= 8;

  // ---- Valor.
  seccion("VALOR");
  fila("Costo de adquisición", dinero(a.costo));
  fila("Depreciación acumulada", baja ? "—" : dinero(v.depreciado));
  if (!sinDepreciar) fila("Depreciación anual (lineal)", dinero(a.costo / a.vidaUtilAnios));
  y -= 30;

  // ---- Valor actual destacado.
  page.drawRectangle({ x: margen, y: y - 12, width: derechaX - margen, height: 38, color: FONDO });
  y -= 6;
  texto("VALOR ACTUAL", margen + 12, 11, { fuente: negrita });
  texto(baja ? "—" : dinero(valor), derechaX - 12, 18, { fuente: negrita, derecha: true });
  y -= 36;
  if (!baja && a.costo > 0) {
    texto(`Conserva el ${Math.round((valor / a.costo) * 100)}% de su costo.`, margen, 9.5, { color: GRIS });
    y -= 14;
  }
  if (a.costoEnCaja) {
    texto("El costo de este bien quedó anotado como egreso en la Caja.", margen, 9.5, { color: GRIS });
    y -= 14;
  }
  if (a.notas) {
    y -= 6;
    texto("NOTAS", margen, 8.5, { fuente: negrita, color: GRIS });
    y -= 15;
    texto(a.notas.replace(/\s+/g, " ").slice(0, 110), margen, 9.5);
    y -= 14;
  }

  // ---- Pie.
  y = margen + 30;
  linea();
  y -= 13;
  texto("Ficha interna del comité. El valor es una referencia por depreciación lineal y no reemplaza la contabilidad de un contador.", margen, 7.5, { color: GRIS });
  y -= 10;
  texto("Generado con Facilapr · facilapr.cl", margen, 7.5, { color: GRIS });

  return pdf.save();
}
