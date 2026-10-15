import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, boletas, pagos, socios } from "@/lib/db/schema";

export type ComprobanteDatos = {
  id: string;
  comite: {
    nombre: string;
    razonSocial: string | null;
    rut: string | null;
    direccion: string | null;
    comuna: string;
    telefono: string | null;
  };
  socio: { nombre: string; rut: string | null; numeroCliente: string | null };
  /** Null en un cobro que no es una boleta. */
  periodo: string | null;
  boletaTotal: number | null;
  boletaPagado: number | null;
  /** BOLETA, RECONEXION, REPARACION u OTRO. */
  concepto: string;
  descripcion: string | null;
  /** El pago es parte de un acuerdo de pago (repactación). */
  repactacion: boolean;
  monto: number;
  fecha: Date;
  medio: string;
  referencia: string | null;
  /** Quien pagó, si no es el titular del arranque. */
  pagadoPor: string | null;
};

/** Un pago con todo lo que necesita su comprobante; por id, sin filtrar por comité (enlace firmado). */
export async function comprobantePorId(pagoId: string): Promise<ComprobanteDatos | null> {
  const [f] = await db
    .select({
      id: pagos.id,
      monto: pagos.monto,
      fecha: pagos.fecha,
      medio: pagos.medio,
      referencia: pagos.referencia,
      pagadoPor: pagos.pagadoPor,
      concepto: pagos.concepto,
      descripcion: pagos.descripcion,
      repactacionId: pagos.repactacionId,
      periodo: boletas.periodo,
      boletaTotal: boletas.montoTotal,
      boletaPagado: boletas.montoPagado,
      socioNombre: socios.nombre,
      socioRut: socios.rut,
      socioNumero: socios.numeroCliente,
      comiteNombre: aprs.nombre,
      comiteRazonSocial: aprs.razonSocial,
      comiteRut: aprs.rut,
      comiteDireccion: aprs.direccion,
      comiteComuna: aprs.comuna,
      comiteTelefono: aprs.telefono,
    })
    .from(pagos)
    .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
    // El socio del pago: el que trae él mismo o, en los antiguos, el de su boleta.
    .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
    .innerJoin(aprs, eq(socios.aprId, aprs.id))
    .where(eq(pagos.id, pagoId))
    .limit(1);
  if (!f) return null;

  return {
    id: f.id,
    comite: {
      nombre: f.comiteNombre,
      razonSocial: f.comiteRazonSocial,
      rut: f.comiteRut,
      direccion: f.comiteDireccion,
      comuna: f.comiteComuna,
      telefono: f.comiteTelefono,
    },
    socio: { nombre: f.socioNombre, rut: f.socioRut, numeroCliente: f.socioNumero },
    periodo: f.periodo,
    boletaTotal: f.boletaTotal,
    boletaPagado: f.boletaPagado,
    concepto: f.concepto,
    descripcion: f.descripcion,
    repactacion: f.repactacionId !== null,
    monto: f.monto,
    fecha: f.fecha,
    medio: f.medio,
    referencia: f.referencia,
    pagadoPor: f.pagadoPor,
  };
}
