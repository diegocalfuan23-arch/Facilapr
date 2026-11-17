"use server";

import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { datosGiros, type DatosGiros } from "@/lib/giros-datos";

/** Los datos de Giros, para que se vuelvan a pedir sin recargar la página (la usa TanStack Query). */
export async function consultarGiros(): Promise<DatosGiros> {
  const { apr } = await requireFinanzas();
  if (!puede(apr.plan as Plan, "finanzas")) throw new Error("Las finanzas están disponibles desde el plan Estándar.");
  return datosGiros(apr.id);
}
