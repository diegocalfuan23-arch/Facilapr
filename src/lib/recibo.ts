import { and, asc, eq, inArray, ne, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, boletas, socios } from "@/lib/db/schema";
import { puede, type Plan } from "@/lib/planes";
import { qrComoImagen } from "@/lib/qr";

/**
 * Todo lo que necesita imprimir un recibo, ya resuelto. El recibo es el
 * comprobante de cobro del comité (lo que antes iba en el talonario); no es un
 * documento tributario del SII.
 */
export type ReciboDatos = {
  id: string;
  comite: {
    nombre: string;
    razonSocial: string | null;
    rut: string | null;
    direccion: string | null;
    comuna: string;
    telefono: string | null;
    infoPago: string | null;
  };
  socio: {
    nombre: string;
    rut: string | null;
    numeroCliente: string | null;
    direccion: string | null;
  };
  periodo: string;
  fechaEmision: Date;
  fechaVencimiento: Date;
  lecturaAnterior: number | null;
  lecturaActual: number | null;
  consumoM3: number | null;
  cargoFijo: number | null;
  valorM3: number | null;
  montoTotal: number;
  montoPagado: number;
  estado: "PENDIENTE" | "PAGADA" | "VENCIDA" | "ANULADA";
  /**
   * El QR que lleva al socio a su cuenta en línea, con la dirección corta para quien no
   * tenga cámara. Solo en comités con chat (Estándar y Grande) y con dirección propia.
   */
  portal: { url: string; corta: string; qr: string } | null;
};

async function consultar(condicion: SQL | undefined): Promise<ReciboDatos[]> {
  const filas = await db
    .select({
      id: boletas.id,
      periodo: boletas.periodo,
      fechaEmision: boletas.fechaEmision,
      fechaVencimiento: boletas.fechaVencimiento,
      lecturaAnterior: boletas.lecturaAnterior,
      lecturaActual: boletas.lecturaActual,
      consumoM3: boletas.consumoM3,
      cargoFijo: boletas.cargoFijo,
      valorM3: boletas.valorM3,
      montoTotal: boletas.montoTotal,
      montoPagado: boletas.montoPagado,
      estado: boletas.estado,
      socioNombre: socios.nombre,
      socioRut: socios.rut,
      socioNumero: socios.numeroCliente,
      socioDireccion: socios.direccion,
      comiteNombre: aprs.nombre,
      comiteRazonSocial: aprs.razonSocial,
      comiteRut: aprs.rut,
      comiteDireccion: aprs.direccion,
      comiteComuna: aprs.comuna,
      comiteTelefono: aprs.telefono,
      comiteInfoPago: aprs.infoPago,
      comiteSlug: aprs.slug,
      comitePlan: aprs.plan,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .innerJoin(aprs, eq(socios.aprId, aprs.id))
    .where(condicion)
    .orderBy(asc(socios.nombre));

  const dominio = process.env.NEXT_PUBLIC_DOMINIO_RAIZ ?? "facilapr.cl";
  const portales = new Map<string, ReciboDatos["portal"]>();
  for (const f of filas) {
    if (!f.comiteSlug || !puede(f.comitePlan as Plan, "chat") || portales.has(f.comiteSlug)) continue;
    const url = `https://${dominio}/${f.comiteSlug}/cuenta/entrar`;
    portales.set(f.comiteSlug, {
      url,
      corta: `${dominio}/${f.comiteSlug}/cuenta`,
      qr: await qrComoImagen(url),
    });
  }

  return filas.map((f) => ({
    id: f.id,
    comite: {
      nombre: f.comiteNombre,
      razonSocial: f.comiteRazonSocial,
      rut: f.comiteRut,
      direccion: f.comiteDireccion,
      comuna: f.comiteComuna,
      telefono: f.comiteTelefono,
      infoPago: f.comiteInfoPago,
    },
    socio: {
      nombre: f.socioNombre,
      rut: f.socioRut,
      numeroCliente: f.socioNumero,
      direccion: f.socioDireccion,
    },
    periodo: f.periodo,
    fechaEmision: f.fechaEmision,
    fechaVencimiento: f.fechaVencimiento,
    lecturaAnterior: f.lecturaAnterior,
    lecturaActual: f.lecturaActual,
    consumoM3: f.consumoM3,
    cargoFijo: f.cargoFijo,
    valorM3: f.valorM3,
    montoTotal: f.montoTotal,
    montoPagado: f.montoPagado,
    estado: f.estado,
    portal: f.comiteSlug ? (portales.get(f.comiteSlug) ?? null) : null,
  }));
}

/** Un recibo del comité (la directiva puede ver cualquier estado, incluso anulada). */
export async function reciboDeComite(aprId: string, boletaId: string) {
  const [recibo] = await consultar(
    and(eq(socios.aprId, aprId), eq(boletas.id, boletaId))
  );
  return recibo ?? null;
}

/** Un recibo por id, sin filtrar por comité: solo para el enlace firmado (/r/<código>). */
export async function reciboPorId(boletaId: string) {
  const [recibo] = await consultar(eq(boletas.id, boletaId));
  return recibo ?? null;
}

/** La hoja de talonario de un período: todas las boletas no anuladas. */
export function recibosDelPeriodo(aprId: string, periodo: string) {
  return consultar(
    and(
      eq(socios.aprId, aprId),
      eq(boletas.periodo, periodo),
      ne(boletas.estado, "ANULADA")
    )
  );
}

/** Un recibo de una de las cuentas de la persona: el filtro por ids impide ver el de otro. */
export async function reciboDeSocio(socioIds: string[], boletaId: string) {
  const [recibo] = await consultar(
    and(inArray(boletas.socioId, socioIds), eq(boletas.id, boletaId))
  );
  return recibo ?? null;
}
