"use server";

import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { datosRendicion, type DatosRendicion } from "@/lib/rendicion";
import { periodoBienFormado, periodoYaEmpezo, type PeriodoRendicion } from "@/lib/rendicion-periodo";

/** Los datos de la rendición de un período, para que la pantalla los pida al cambiar de período sin recargar (la usa TanStack Query). */
export async function consultarRendicion(periodo: PeriodoRendicion): Promise<DatosRendicion> {
  const { apr } = await requireFinanzas();
  const plan = apr.plan as Plan;
  if (!puede(plan, "finanzas")) throw new Error("Las finanzas están disponibles desde el plan Estándar.");
  const hoy = hoyEnChile();
  if (!periodoBienFormado(periodo) || !periodoYaEmpezo(periodo, hoy)) throw new Error("Ese período no es válido.");
  return datosRendicion(apr.id, periodo, hoy, {
    activos: puede(plan, "activos"),
    labores: puede(plan, "inventario"),
    incidentes: puede(plan, "incidentes"),
  });
}
