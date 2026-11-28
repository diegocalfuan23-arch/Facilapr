import { and, asc, desc, eq, isNull, lte, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, siiConfigs, siiDocumentos, siiFolios, socios } from "@/lib/db/schema";
import { descifrarSii } from "@/lib/sii/seguridad";
import { generarBoleta, type DatosBoleta, type Emisor } from "@/lib/sii/dte/boleta";
import { abrirCertificado } from "@/lib/sii/dte/certificado";
import { abrirCaf } from "@/lib/sii/dte/timbre";
import { lineasDeBoleta, motivoParaNoEmitir } from "@/lib/sii/lineas";
import { hoyEnChile } from "@/lib/finanzas-comun";

/**
 * Emitir: a cada boleta del comité se le asigna el folio siguiente, se firma y se guarda. Todo ocurre en una sola
 * transacción por boleta: o quedan el folio gastado y el documento guardado, o no pasa nada. Todavía no se envía al SII.
 */

/** Cuántas boletas se emiten de una vez, para no pasar el tiempo que dura una petición. */
const POR_TANDA = 200;

/** Lo que se guarda junto al documento para volver a imprimirlo igual. */
export type FotoDocumento = { boleta: DatosBoleta; emisor: Emisor; resolucion: { fecha: string; numero: number } };

/** Las boletas de un mes que aún no tienen documento. */
export async function boletasSinEmitir(aprId: string, periodo: string) {
  const filas = await db
    .select({
      id: boletas.id,
      periodo: boletas.periodo,
      montoTotal: boletas.montoTotal,
      montoSubsidio: boletas.montoSubsidio,
      cargoFijo: boletas.cargoFijo,
      valorM3: boletas.valorM3,
      consumoM3: boletas.consumoM3,
      observacion: boletas.observacion,
      fechaVencimiento: boletas.fechaVencimiento,
      nombre: socios.nombre,
      rut: socios.rut,
      direccion: socios.direccion,
      numeroCliente: socios.numeroCliente,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .leftJoin(siiDocumentos, eq(siiDocumentos.boletaId, boletas.id))
    .where(and(eq(socios.aprId, aprId), eq(boletas.periodo, periodo), ne(boletas.estado, "ANULADA"), isNull(siiDocumentos.id)))
    .orderBy(asc(socios.nombre), asc(boletas.id));

  return filas.map(({ nombre, rut, direccion, numeroCliente, ...b }) => ({ ...b, socio: { nombre, rut, direccion, numeroCliente } }));
}

/** Los meses que tienen boletas, del más nuevo al más antiguo. */
export async function periodosConBoletas(aprId: string) {
  const filas = await db
    .selectDistinct({ periodo: boletas.periodo })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(socios.aprId, aprId), ne(boletas.estado, "ANULADA")))
    .orderBy(desc(boletas.periodo))
    .limit(24);
  return filas.map((f) => f.periodo);
}

export type ResultadoEmision =
  | { ok: true; emitidas: number; quedan: number; omitidas: { socio: string; motivo: string }[] }
  | { ok: false; error: string };

export async function emitirPeriodo(aprId: string, periodo: string): Promise<ResultadoEmision> {
  const config = await db.query.siiConfigs.findFirst({ where: eq(siiConfigs.aprId, aprId) });
  if (!config?.rutEmisor || !config.razonSocial || !config.giro || !config.direccion || !config.comuna || (config.tipoBoleta !== 39 && config.tipoBoleta !== 41))
    return { ok: false, error: "Completa los datos del emisor." };
  if (!config.certificado || !config.certificadoClave) return { ok: false, error: "Falta el certificado digital." };
  const certificado = abrirCertificado(Buffer.from(descifrarSii(config.certificado), "base64"), descifrarSii(config.certificadoClave));
  if (!certificado.ok) return { ok: false, error: certificado.error };
  if (!certificado.vigente) return { ok: false, error: "El certificado digital no está vigente." };

  const tipo = config.tipoBoleta;
  const rut = config.rutEmisor;
  const emisor: Emisor = { rut, razonSocial: config.razonSocial, giro: config.giro, direccion: config.direccion, comuna: config.comuna };
  const fecha = hoyEnChile();
  const resolucion = { fecha: config.resolucionFecha ?? fecha, numero: config.resolucionNumero ?? 0 };

  const pendientes = await boletasSinEmitir(aprId, periodo);
  const omitidas: { socio: string; motivo: string }[] = [];
  const listas = pendientes.filter((b) => {
    const motivo = motivoParaNoEmitir(b);
    if (motivo) omitidas.push({ socio: b.socio.nombre, motivo });
    return !motivo;
  });
  if (listas.length === 0) return { ok: true, emitidas: 0, quedan: 0, omitidas };

  let emitidas = 0;
  for (const b of listas.slice(0, POR_TANDA)) {
    const resultado = await db
      .transaction(async (tx) => {
        // El tramo se bloquea hasta terminar: dos personas emitiendo a la vez no reciben el mismo folio.
        const [tramo] = await tx
          .select()
          .from(siiFolios)
          .where(and(eq(siiFolios.aprId, aprId), eq(siiFolios.tipo, tipo), lte(siiFolios.siguiente, siiFolios.hasta)))
          .orderBy(asc(siiFolios.desde))
          .limit(1)
          .for("update");
        if (!tramo) return "SIN_FOLIOS" as const;

        // Ya con el tramo tomado: puede que otra tanda la haya emitido recién.
        const ya = await tx.select({ id: siiDocumentos.id }).from(siiDocumentos).where(eq(siiDocumentos.boletaId, b.id)).limit(1);
        if (ya.length > 0) return "YA_EMITIDA" as const;

        const caf = abrirCaf(Buffer.from(descifrarSii(tramo.caf), "base64").toString("latin1"));
        if (!caf) throw new Error("El archivo de folios no se puede abrir. Vuelve a cargarlo.");

        const datos: DatosBoleta = {
          tipo,
          folio: tramo.siguiente,
          fecha,
          // El mismo día que muestra el recibo del comité.
          vencimiento: b.fechaVencimiento.toISOString().slice(0, 10),
          receptor: {
            rut: b.socio.rut!,
            nombre: b.socio.nombre,
            direccion: b.socio.direccion!,
            comuna: emisor.comuna,
            numeroCliente: b.socio.numeroCliente ?? undefined,
          },
          items: lineasDeBoleta(b),
        };
        const firmada = generarBoleta(datos, { emisor, caf, firmante: certificado.firmante });

        await tx.insert(siiDocumentos).values({
          aprId,
          boletaId: b.id,
          tipo,
          folio: datos.folio,
          monto: firmada.total,
          datos: { boleta: datos, emisor, resolucion } satisfies FotoDocumento,
          xml: firmada.xml,
        });
        await tx.update(siiFolios).set({ siguiente: tramo.siguiente + 1 }).where(eq(siiFolios.id, tramo.id));
        return "EMITIDA" as const;
      })
      .catch((e: unknown) => {
        // Los mensajes del motor son para la directiva. Los de la base traen la consulta con sus datos: no se muestran ni se registran.
        const deLaBase = !(e instanceof Error) || "query" in e || "code" in e;
        if (deLaBase) console.error("SII: no se pudo guardar una boleta", (e as { cause?: { code?: string } }).cause?.code);
        return { error: deLaBase ? "No se pudo guardar la boleta." : e.message };
      });

    if (resultado === "SIN_FOLIOS") {
      if (emitidas === 0) return { ok: false, error: "No quedan folios para este tipo de boleta." };
      break;
    }
    if (typeof resultado === "object") {
      // Un fallo así se repetiría en las demás: se corta aquí, con lo ya emitido guardado.
      return { ok: false, error: `${b.socio.nombre}: ${resultado.error}${emitidas ? ` Se alcanzaron a emitir ${emitidas}.` : ""}` };
    }
    if (resultado === "EMITIDA") emitidas++;
  }

  return { ok: true, emitidas, quedan: listas.length - emitidas, omitidas };
}
