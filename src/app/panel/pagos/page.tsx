import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, pagos, socios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { urlComprobante } from "@/lib/comprobante-enlace";
import { PagosTabla } from "@/components/panel/pagos-tabla";

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

  return (
    <PagosTabla
      pagos={filas.map((f) => ({
        ...f,
        fecha: f.fecha.toISOString(),
        comprobanteUrl: urlComprobante(f.id),
      }))}
    />
  );
}
