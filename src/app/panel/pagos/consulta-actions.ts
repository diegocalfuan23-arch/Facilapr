"use server";

import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { datosPagos, type DatosPagos } from "@/lib/pagos-datos";

/** Los datos de la pantalla de Pagos, para que la vuelva a pedir sin recargar la página (la usa TanStack Query). */
export async function consultarPagos(): Promise<DatosPagos> {
  const { apr } = await requireFinanzas();
  if (!puede(apr.plan as Plan, "finanzas")) throw new Error("Las finanzas están disponibles desde el plan Estándar.");
  return datosPagos(apr);
}
