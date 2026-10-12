import { desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas } from "@/lib/db/schema";
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
