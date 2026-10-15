import { and, asc, desc, eq, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, repactaciones, socios } from "@/lib/db/schema";
import type { RepactacionFila, SocioConDeuda } from "@/components/panel/repactaciones-panel";

/** Los acuerdos de pago (repactaciones) del comité, con lo que cada socio ya pagó de ellos. */
export async function acuerdosDelComite(aprId: string): Promise<RepactacionFila[]> {
  const filas = await db
    .select({
      id: repactaciones.id,
      socioNombre: socios.nombre,
      socioTelefono: socios.telefono,
      deudaTotal: repactaciones.deudaTotal,
      cuotas: repactaciones.cuotas,
      primerVencimiento: repactaciones.primerVencimiento,
      estado: repactaciones.estado,
      nota: repactaciones.nota,
      pagado: sql<number>`(select coalesce(sum(p."monto"), 0)::int from "Pago" p where p."repactacionId" = ${repactaciones.id})`,
    })
    .from(repactaciones)
    .innerJoin(socios, eq(repactaciones.socioId, socios.id))
    .where(eq(repactaciones.aprId, aprId))
    .orderBy(desc(repactaciones.createdAt));

  return filas.map((f) => ({ ...f, primerVencimiento: f.primerVencimiento.toISOString() }));
}

/** Con quién se puede hacer un acuerdo: socios con deuda vencida y sin otro acuerdo activo. */
export async function sociosParaRepactar(aprId: string): Promise<SocioConDeuda[]> {
  return db
    .select({
      id: socios.id,
      nombre: socios.nombre,
      rut: socios.rut,
      telefono: socios.telefono,
      numeroCliente: socios.numeroCliente,
      tipo: socios.tipo,
      deuda: sql<number>`sum(${boletas.montoTotal} - ${boletas.montoPagado})::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(
      and(
        eq(socios.aprId, aprId),
        ne(boletas.estado, "ANULADA"),
        lt(boletas.montoPagado, boletas.montoTotal),
        sql`${boletas.fechaVencimiento} < now()`,
        sql`not exists (select 1 from "Repactacion" r where r."socioId" = ${socios.id} and r."estado" = 'ACTIVA')`
      )
    )
    .groupBy(socios.id)
    .orderBy(asc(socios.nombre));
}
