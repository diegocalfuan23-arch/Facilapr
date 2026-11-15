"use server";

import { requireAdmin } from "@/lib/apr-session";
import { datosSocios } from "@/lib/socios-datos";
import type { SocioFila } from "@/components/panel/socios-tabla";

/** Las cuentas de la pantalla de Socios, para que la vuelva a pedir sin recargar la página (la usa TanStack Query). */
export async function consultarSocios(): Promise<SocioFila[]> {
  const { apr } = await requireAdmin();
  return datosSocios(apr);
}
