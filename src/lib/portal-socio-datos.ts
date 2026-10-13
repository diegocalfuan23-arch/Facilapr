import { desc, inArray } from "drizzle-orm";
import { urlComprobante } from "@/lib/comprobante-enlace";
import { db } from "@/lib/db";
import { boletas, pagos } from "@/lib/db/schema";
import { cuentasDelSocio } from "@/lib/socio-session";

/**
 * Las boletas de una persona, de la más nueva a la más antigua. Quien tiene
 * varios arranques (mismo RUT) ve las de todos ellos.
 */
export async function boletasDelPortal(
  socio: Parameters<typeof cuentasDelSocio>[0],
  porCuenta = 24
) {
  const cuentas = await cuentasDelSocio(socio);
  const lista = await db.query.boletas.findMany({
    where: inArray(
      boletas.socioId,
      cuentas.map((c) => c.id)
    ),
    orderBy: [desc(boletas.fechaEmision)],
    limit: porCuenta * cuentas.length,
    with: { socio: { columns: { nombre: true } } },
  });
  return { cuentas, lista };
}

export type PagoPortal = {
  id: string;
  monto: number;
  fecha: Date;
  medio: string;
  referencia: string | null;
  pagadoPor: string | null;
  periodo: string;
  socioNombre: string;
  comprobanteUrl: string;
};

/** Los pagos registrados sobre esas boletas, del más reciente al más antiguo. */
export async function pagosDelPortal(
  lista: { id: string; periodo: string; socio: { nombre: string } }[]
): Promise<PagoPortal[]> {
  if (lista.length === 0) return [];
  const porId = new Map(lista.map((b) => [b.id, b]));
  const filas = await db
    .select()
    .from(pagos)
    .where(inArray(pagos.boletaId, [...porId.keys()]))
    .orderBy(desc(pagos.fecha), desc(pagos.createdAt));

  return filas.flatMap((f) => {
    const b = porId.get(f.boletaId);
    if (!b) return [];
    return [
      {
        id: f.id,
        monto: f.monto,
        fecha: f.fecha,
        medio: f.medio,
        referencia: f.referencia,
        pagadoPor: f.pagadoPor,
        periodo: b.periodo,
        socioNombre: b.socio.nombre,
        comprobanteUrl: urlComprobante(f.id),
      },
    ];
  });
}
