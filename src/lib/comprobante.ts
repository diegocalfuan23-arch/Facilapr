import { eq } from "drizzle-orm";
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
  periodo: string;
  boletaTotal: number;
  boletaPagado: number;
  monto: number;
  fecha: Date;
  medio: string;
  referencia: string | null;
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
    .innerJoin(boletas, eq(pagos.boletaId, boletas.id))
    .innerJoin(socios, eq(boletas.socioId, socios.id))
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
    monto: f.monto,
    fecha: f.fecha,
    medio: f.medio,
    referencia: f.referencia,
  };
}
