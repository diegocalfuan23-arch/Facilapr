import { firmar, type Firmante } from "@/lib/sii/dte/firma";
import { timbrar, type CafCompleto } from "@/lib/sii/dte/timbre";
import { el, NS_SII, rutSii, sello, texto } from "@/lib/sii/dte/xml";

/**
 * Una boleta electrónica de agua (39 afecta, 41 exenta), según el «Formato Boletas Electrónicas de Ventas y
 * Servicios» 4.2 del SII y su esquema EnvioBOLETA_v11. El agua es un «servicio periódico domiciliario»: exige
 * vencimiento, dirección del servicio y un receptor identificado.
 */

const SERVICIO_PERIODICO_DOMICILIARIO = 2;
const IVA = 0.19;

export type Emisor = {
  rut: string;
  razonSocial: string;
  giro: string;
  direccion: string;
  comuna: string;
};

export type DatosBoleta = {
  tipo: 39 | 41;
  folio: number;
  /** Fechas «AAAA-MM-DD». */
  fecha: string;
  vencimiento: string;
  periodoDesde?: string;
  periodoHasta?: string;
  receptor: { rut: string; nombre: string; direccion: string; comuna?: string; numeroCliente?: string };
  /** Montos en pesos y, en la afecta, con IVA incluido. */
  items: { nombre: string; monto: number; cantidad?: number; precio?: number; unidad?: string }[];
};

export type BoletaFirmada = {
  id: string;
  tipo: 39 | 41;
  folio: number;
  total: number;
  /** El elemento `<DTE>` completo. */
  xml: string;
  /** El timbre, para el código de barras del documento impreso. */
  timbre: string;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const entero = (n: number) => Number.isInteger(n) && n >= 0;

export function totales(tipo: 39 | 41, items: DatosBoleta["items"]) {
  const total = items.reduce((s, i) => s + i.monto, 0);
  if (tipo === 41) return { exento: total, total };
  const neto = Math.round(total / (1 + IVA));
  return { neto, iva: total - neto, total };
}

export function generarBoleta(
  d: DatosBoleta,
  { emisor, caf, firmante, ahora = new Date() }: { emisor: Emisor; caf: CafCompleto; firmante: Firmante; ahora?: Date }
): BoletaFirmada {
  const rutEmisor = rutSii(emisor.rut);
  const rutReceptor = rutSii(d.receptor.rut);
  const direccion = texto(d.receptor.direccion, 70);
  if (!rutEmisor) throw new Error("El RUT del comité no es válido.");
  if (!rutReceptor) throw new Error(`Falta el RUT de ${d.receptor.nombre}.`);
  if (!direccion) throw new Error(`Falta la dirección de ${d.receptor.nombre}.`);
  if (![d.fecha, d.vencimiento].every((f) => FECHA.test(f))) throw new Error("Las fechas van como AAAA-MM-DD.");
  if (d.items.length === 0 || d.items.length > 1000) throw new Error("La boleta lleva entre 1 y 1.000 líneas.");
  if (!d.items.every((i) => entero(i.monto) && texto(i.nombre, 80))) throw new Error("Cada línea lleva nombre y un monto en pesos enteros.");

  const t = totales(d.tipo, d.items);
  if (t.total <= 0) throw new Error("El total de la boleta debe ser mayor que cero.");

  const ahoraSii = sello(ahora);
  const id = `T${d.tipo}F${d.folio}`;
  const timbre = timbrar(
    {
      rutEmisor,
      tipo: d.tipo,
      folio: d.folio,
      fecha: d.fecha,
      rutReceptor,
      nombreReceptor: d.receptor.nombre,
      total: t.total,
      primerItem: d.items[0].nombre,
      sello: ahoraSii,
    },
    caf
  );

  // El orden de los elementos es el del esquema: cambiarlo hace que el SII rechace el envío.
  const encabezado = `<Encabezado><IdDoc>${el("TipoDTE", d.tipo)}${el("Folio", d.folio)}${el("FchEmis", d.fecha)}${el(
    "IndServicio",
    SERVICIO_PERIODICO_DOMICILIARIO
  )}${el("PeriodoDesde", d.periodoDesde)}${el("PeriodoHasta", d.periodoHasta)}${el("FchVenc", d.vencimiento)}</IdDoc><Emisor>${el(
    "RUTEmisor",
    rutEmisor
  )}${el("RznSocEmisor", texto(emisor.razonSocial, 100))}${el("GiroEmisor", texto(emisor.giro, 80))}${el(
    "DirOrigen",
    texto(emisor.direccion, 70)
  )}${el("CmnaOrigen", texto(emisor.comuna, 20))}</Emisor><Receptor>${el("RUTRecep", rutReceptor)}${el(
    "CdgIntRecep",
    texto(d.receptor.numeroCliente ?? "", 20)
  )}${el("RznSocRecep", texto(d.receptor.nombre, 100))}${el("DirRecep", direccion)}${el(
    "CmnaRecep",
    texto(d.receptor.comuna ?? "", 20)
  )}</Receptor><Totales>${el("MntNeto", t.neto)}${el("MntExe", t.exento)}${el("IVA", t.iva)}${el("MntTotal", t.total)}</Totales></Encabezado>`;

  const detalle = d.items
    .map(
      (i, n) =>
        `<Detalle>${el("NroLinDet", n + 1)}${el("IndExe", d.tipo === 41 ? 1 : null)}${el("NmbItem", texto(i.nombre, 80))}${el(
          "QtyItem",
          i.cantidad
        )}${el("UnmdItem", texto(i.unidad ?? "", 4))}${el("PrcItem", i.precio)}${el("MontoItem", i.monto)}</Detalle>`
    )
    .join("\n");

  const documento = `<Documento ID="${id}">\n${encabezado}\n${detalle}\n${timbre}\n${el("TmstFirma", ahoraSii)}\n</Documento>`;
  // La boleta se firma como documento suelto (solo con el espacio de nombres del SII): así la revisa el SII al
  // sacarla del sobre. Es lo primero a confirmar en la certificación.
  const firma = firmar(documento, id, firmante, [`xmlns="${NS_SII}"`]);

  return { id, tipo: d.tipo, folio: d.folio, total: t.total, timbre, xml: `<DTE version="1.0">\n${documento}\n${firma}\n</DTE>` };
}
