import type { Metadata } from "next";
import { and, asc, desc, eq, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, pagos, socios } from "@/lib/db/schema";
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
      periodo: boletas.periodo,
      socioNombre: socios.nombre,
      socioRut: socios.rut,
    })
    .from(pagos)
    .innerJoin(boletas, eq(pagos.boletaId, boletas.id))
    .innerJoin(socios, eq(boletas.socioId, socios.id))
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
