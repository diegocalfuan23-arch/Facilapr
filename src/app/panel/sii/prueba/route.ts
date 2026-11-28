import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { siiConfigs } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { cifradoListo, descifrarSii, siiHabilitado } from "@/lib/sii/seguridad";
import { generarBoleta, type DatosBoleta, type Emisor } from "@/lib/sii/dte/boleta";
import { abrirCertificado } from "@/lib/sii/dte/certificado";
import { boletaPdf } from "@/lib/sii/dte/impreso";
import { certificadoDePrueba, foliosDePrueba } from "@/lib/sii/dte/prueba";
import { armarSobre } from "@/lib/sii/dte/sobre";
import { rutSii } from "@/lib/sii/dte/xml";
import { hoyEnChile } from "@/lib/finanzas-comun";

export const dynamic = "force-dynamic";

const DIA = 86_400_000;
const fechaCorta = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago" });

/**
 * Una boleta de muestra en PDF para revisar el motor sin enviar nada al SII. Usa los datos del emisor y folios
 * inventados; si el comité ya cargó su certificado, comprueba que abre y firma con él.
 */
export async function GET() {
  const { apr } = await requireAdmin();
  if (!siiHabilitado(apr.slug)) return new Response("No disponible.", { status: 404 });

  const config = await db.query.siiConfigs.findFirst({ where: eq(siiConfigs.aprId, apr.id) });
  const rut = rutSii(config?.rutEmisor ?? apr.rut ?? "");
  if (!rut) return new Response("Guarda primero los datos del emisor, con su RUT.", { status: 400 });

  let firmante = null;
  let nota = "Sin certificado cargado: se firmó con uno temporal.";
  if (config?.certificado && config.certificadoClave) {
    if (!cifradoListo()) return new Response("Falta configurar el cifrado en el servidor.", { status: 500 });
    const abierto = abrirCertificado(Buffer.from(descifrarSii(config.certificado), "base64"), descifrarSii(config.certificadoClave));
    if (!abierto.ok) return new Response(`Certificado del comité: ${abierto.error}`, { status: 400 });
    firmante = abierto.firmante;
    nota = `Certificado del comité: abre y firma. ${abierto.vigente ? "Vence" : "NO ESTÁ VIGENTE, venció o vence"} el ${fechaCorta.format(abierto.vence)}.`;
  }
  firmante ??= certificadoDePrueba();

  const tipo = config?.tipoBoleta === 39 ? 39 : 41;
  const emisor: Emisor = {
    rut,
    razonSocial: config?.razonSocial ?? apr.razonSocial ?? apr.nombre,
    giro: config?.giro ?? "Distribución de agua potable rural",
    direccion: config?.direccion ?? apr.direccion ?? "Sin dirección",
    comuna: config?.comuna ?? apr.comuna ?? "Sin comuna",
  };
  const hoy = hoyEnChile();
  const enQuinceDias = new Date(Date.parse(`${hoy}T12:00:00Z`) + 15 * DIA).toISOString().slice(0, 10);
  const datos: DatosBoleta = {
    tipo,
    folio: 1,
    fecha: hoy,
    vencimiento: enQuinceDias,
    // Un socio inventado: la muestra no usa datos de ninguna persona.
    receptor: { rut: "11111111-1", nombre: "Socio de prueba", direccion: "Parcela 1", comuna: emisor.comuna, numeroCliente: "100" },
    items: [
      { nombre: "Cargo fijo", monto: apr.tarifaCargoFijo ?? 4000 },
      { nombre: "Consumo de agua", monto: (apr.tarifaMetroCubico ?? 500) * 12, cantidad: 12, precio: apr.tarifaMetroCubico ?? 500, unidad: "m3" },
    ],
  };
  const resolucion = { fecha: config?.resolucionFecha ?? hoy, numero: config?.resolucionNumero ?? 0 };

  try {
    const boleta = generarBoleta(datos, { emisor, caf: foliosDePrueba(rut, tipo), firmante });
    // El sobre se arma para comprobar que se puede; no se guarda ni se envía.
    armarSobre([boleta], { rutEmisor: rut, rutEnvia: config?.representanteRut ?? rut, resolucion, firmante });
    const pdf = await boletaPdf(datos, { emisor, timbre: boleta.timbre, resolucion, prueba: nota });
    return new Response(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="Boleta-de-prueba.pdf"',
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    // Los mensajes del motor son para la directiva y no llevan datos del certificado ni de los folios.
    return new Response(e instanceof Error ? e.message : "No se pudo generar la boleta.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
