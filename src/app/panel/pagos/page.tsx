import type { Metadata } from "next";
import { and, asc, desc, eq, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, pagos, repactaciones, socios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { urlComprobante } from "@/lib/comprobante-enlace";
import { PagosTabla } from "@/components/panel/pagos-tabla";
import type { OpcionSocio } from "@/components/panel/socio-buscador";

export const metadata: Metadata = {
  title: "Pagos",
};

/** Cuántos pagos se cargan: los más recientes. */
const MAXIMO = 1000;

export default async function PagosPage() {
  const { apr } = await requireAdmin();

  const filas = await db
    .select({
      id: pagos.id,
      monto: pagos.monto,
      fecha: pagos.fecha,
      medio: pagos.medio,
      referencia: pagos.referencia,
      pagadoPor: pagos.pagadoPor,
      repactacionId: pagos.repactacionId,
      concepto: pagos.concepto,
      descripcion: pagos.descripcion,
      periodo: boletas.periodo,
      socioNombre: socios.nombre,
      socioRut: socios.rut,
    })
    .from(pagos)
    .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
    // El socio del pago: el que trae él mismo o, en los antiguos, el de su boleta.
    .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
    .where(eq(socios.aprId, apr.id))
    .orderBy(desc(pagos.fecha), desc(pagos.createdAt))
    .limit(MAXIMO);

  // Boletas con saldo: de ahí se elige a qué socio y boleta se le registra un pago.
  const pendientes = await db
    .select({
      id: boletas.id,
      periodo: boletas.periodo,
      montoTotal: boletas.montoTotal,
      montoPagado: boletas.montoPagado,
      socioId: socios.id,
      socioNombre: socios.nombre,
      socioTelefono: socios.telefono,
      socioRut: socios.rut,
      socioNumero: socios.numeroCliente,
      socioTipo: socios.tipo,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(
      and(
        eq(socios.aprId, apr.id),
        ne(boletas.estado, "ANULADA"),
        lt(boletas.montoPagado, boletas.montoTotal)
      )
    )
    .orderBy(asc(socios.nombre), asc(boletas.periodo));

  // Cualquier socio puede pagar una reposición, una reparación u otro cobro.
  const todos = await db
    .select({
      id: socios.id,
      nombre: socios.nombre,
      rut: socios.rut,
      telefono: socios.telefono,
      numeroCliente: socios.numeroCliente,
      tipo: socios.tipo,
    })
    .from(socios)
    .where(and(eq(socios.aprId, apr.id), eq(socios.activo, true)))
    .orderBy(asc(socios.nombre));

  // Los acuerdos de pago (repactaciones), con lo que cada socio ya pagó de ellos.
  const acuerdos = await db
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
    .where(eq(repactaciones.aprId, apr.id))
    .orderBy(desc(repactaciones.createdAt));

  // Con quién se puede hacer un acuerdo: socios con deuda vencida y sin otro acuerdo activo.
  const conDeuda = await db
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
        eq(socios.aprId, apr.id),
        ne(boletas.estado, "ANULADA"),
        lt(boletas.montoPagado, boletas.montoTotal),
        sql`${boletas.fechaVencimiento} < now()`,
        sql`not exists (select 1 from "Repactacion" r where r."socioId" = ${socios.id} and r."estado" = 'ACTIVA')`
      )
    )
    .groupBy(socios.id)
    .orderBy(asc(socios.nombre));

  const sociosConSaldo = new Map<string, OpcionSocio>();
  for (const b of pendientes) {
    sociosConSaldo.set(b.socioId, {
      id: b.socioId,
      nombre: b.socioNombre,
      rut: b.socioRut,
      numeroCliente: b.socioNumero,
      tipo: b.socioTipo,
    });
  }

  return (
    <PagosTabla
      socios={[...sociosConSaldo.values()]}
      todosLosSocios={todos}
      repactaciones={acuerdos.map((a) => ({ ...a, primerVencimiento: a.primerVencimiento.toISOString() }))}
      sociosConDeuda={conDeuda}
      costoReconexion={apr.costoReconexion || null}
      boletasPendientes={pendientes.map((b) => ({
        id: b.id,
        socioId: b.socioId,
        socioNombre: b.socioNombre,
        socioTelefono: b.socioTelefono,
        periodo: b.periodo,
        montoTotal: b.montoTotal,
        montoPagado: b.montoPagado,
      }))}
      comite={{ nombre: apr.nombre, slug: apr.slug, infoPago: apr.infoPago }}
      pagos={filas.map((f) => ({
        ...f,
        fecha: f.fecha.toISOString(),
        comprobanteUrl: urlComprobante(f.id),
      }))}
    />
  );
}
