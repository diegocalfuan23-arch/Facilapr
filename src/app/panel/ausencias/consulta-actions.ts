"use server";

import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { datosAusencias, type DatosAusencias } from "@/lib/ausencias-datos";

/** Los datos del tablero de Vacaciones, para que se vuelvan a pedir sin recargar la página (la usa TanStack Query). */
export async function consultarAusencias(): Promise<DatosAusencias> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) throw new Error("RR.HH. está disponible en el plan Grande.");
  return datosAusencias(apr.id);
}
