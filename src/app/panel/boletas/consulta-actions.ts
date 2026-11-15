"use server";

import { requireAdmin } from "@/lib/apr-session";
import { datosBoletas, type DatosBoletas } from "@/lib/boletas-datos";

/** Los datos de la pantalla de Boletas, para que la vuelva a pedir sin recargar la página (la usa TanStack Query). */
export async function consultarBoletas(): Promise<DatosBoletas> {
  const { apr } = await requireAdmin();
  return datosBoletas(apr);
}
