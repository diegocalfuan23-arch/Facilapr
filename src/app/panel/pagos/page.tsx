import type { Metadata } from "next";
import { and, asc, desc, eq, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, pagos, socios } from "@/lib/db/schema";
import { user as usuarios } from "@/lib/db/auth-schema";
import { requireAdmin } from "@/lib/apr-session";
import { urlComprobante } from "@/lib/comprobante-enlace";
import { PagosTabla } from "@/components/panel/pagos-tabla";
import { MercadoPagoCard } from "@/components/panel/mercadopago-card";
import { estadoConexion, modoMp, mpConfigurado } from "@/lib/mercadopago";
import type { OpcionSocio } from "@/components/panel/socio-buscador";

export const metadata: Metadata = {
  title: "Pagos",
};

/** Cuántos pagos se cargan: los más recientes. */
const MAXIMO = 1000;

export default async function PagosPage({ searchParams }: { searchParams: Promise<{ mp?: string; detalle?: string }> }) {
  const { apr } = await requireAdmin();
  const { mp, detalle } = await searchParams;
  const conexionMp = apr.mercadoPagoHabilitado ? await estadoConexion(apr.id) : null;

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
      socioTipo: socios.tipo,
      registradoPor: usuarios.name,
    })
    .from(pagos)
    .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
    // El socio del pago: el que trae él mismo o, en los antiguos, el de su boleta.
    .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
    // Quién del comité lo anotó (los pagos más antiguos pueden no traerlo).
    .leftJoin(usuarios, eq(usuarios.id, pagos.registradoPorId))
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

  // Cuántos socios están al día y cuántos son morosos (con deuda ya vencida), igual que en el Resumen.
  const [estadoSocios] = await db
    .select({
      morosos: sql<number>`count(distinct ${boletas.socioId}) filter (where ${boletas.montoPagado} < ${boletas.montoTotal} and ${boletas.fechaVencimiento} < now())::int`,
      deuda: sql<number>`coalesce(sum(${boletas.montoTotal} - ${boletas.montoPagado}) filter (where ${boletas.montoPagado} < ${boletas.montoTotal} and ${boletas.fechaVencimiento} < now()), 0)::int`,
      conBoletas: sql<number>`count(distinct ${boletas.socioId})::int`,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(eq(socios.aprId, apr.id), eq(socios.activo, true), ne(boletas.estado, "ANULADA")));

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
    <>
      {apr.mercadoPagoHabilitado && (
        <MercadoPagoCard modo={modoMp()} configurado={mpConfigurado()} conexion={conexionMp} aviso={mp} detalle={detalle} />
      )}
      <PagosTabla
      socios={[...sociosConSaldo.values()]}
      resumen={{
        morosos: estadoSocios.morosos,
        deudaVencida: estadoSocios.deuda,
        // Al día: tienen boletas y ninguna vencida sin pagar. Quien aún no tiene boletas no cuenta.
        alDia: estadoSocios.conBoletas - estadoSocios.morosos,
      }}
      todosLosSocios={todos}
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
    </>
  );
}
