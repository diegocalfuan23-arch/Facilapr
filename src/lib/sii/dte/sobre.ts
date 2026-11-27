import type { BoletaFirmada } from "@/lib/sii/dte/boleta";
import { firmar, type Firmante } from "@/lib/sii/dte/firma";
import { el, NS_SII, NS_XSI, rutSii, sello } from "@/lib/sii/dte/xml";

/** El sobre (EnvioBOLETA) con que se mandan las boletas al SII: hasta 500 por envío. */

export const MAXIMO_POR_SOBRE = 500;
/** El RUT del SII, que es quien recibe el sobre. */
const RUT_SII = "60803000-K";
const ID_SOBRE = "SetDoc";

export function armarSobre(
  boletas: BoletaFirmada[],
  datos: {
    rutEmisor: string;
    /** El RUT del dueño del certificado, que es quien envía. */
    rutEnvia: string;
    resolucion: { fecha: string; numero: number };
    firmante: Firmante;
    ahora?: Date;
  }
) {
  if (boletas.length === 0 || boletas.length > MAXIMO_POR_SOBRE) throw new Error(`Un sobre lleva entre 1 y ${MAXIMO_POR_SOBRE} boletas.`);
  const rutEmisor = rutSii(datos.rutEmisor);
  const rutEnvia = rutSii(datos.rutEnvia);
  if (!rutEmisor || !rutEnvia) throw new Error("Revisa el RUT del comité y el de quien envía.");

  const subtotales = [39, 41]
    .map((tipo) => {
      const n = boletas.filter((b) => b.tipo === tipo).length;
      return n > 0 ? `<SubTotDTE>${el("TpoDTE", tipo)}${el("NroDTE", n)}</SubTotDTE>` : "";
    })
    .join("");

  const caratula = `<Caratula version="1.0">${el("RutEmisor", rutEmisor)}${el("RutEnvia", rutEnvia)}${el("RutReceptor", RUT_SII)}${el(
    "FchResol",
    datos.resolucion.fecha
  )}<NroResol>${datos.resolucion.numero}</NroResol>${el("TmstFirmaEnv", sello(datos.ahora))}${subtotales}</Caratula>`;

  const conjunto = `<SetDTE ID="${ID_SOBRE}">\n${caratula}\n${boletas.map((b) => b.xml).join("\n")}\n</SetDTE>`;
  const firma = firmar(conjunto, ID_SOBRE, datos.firmante, [`xmlns="${NS_SII}"`, `xmlns:xsi="${NS_XSI}"`]);

  const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n<EnvioBOLETA xmlns="${NS_SII}" xmlns:xsi="${NS_XSI}" version="1.0" xsi:schemaLocation="${NS_SII} EnvioBOLETA_v11.xsd">\n${conjunto}\n${firma}\n</EnvioBOLETA>`;
  /** Los bytes que se envían. */
  return { xml, bytes: Buffer.from(xml, "latin1") };
}
