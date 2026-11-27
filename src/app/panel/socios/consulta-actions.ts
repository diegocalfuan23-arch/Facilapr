"use server";

import { requireAdmin } from "@/lib/apr-session";
import { datosSocios } from "@/lib/socios-datos";
import { fichaSocio, type FichaSocio } from "@/lib/ficha-socio";
import type { SocioFila } from "@/components/panel/socios-tabla";

/** Las cuentas de la pantalla de Socios, para que la vuelva a pedir sin recargar la página (la usa TanStack Query). */
export async function consultarSocios(): Promise<SocioFila[]> {
  const { apr } = await requireAdmin();
  return datosSocios(apr);
}

/** La ficha de una persona del comité. Null si no es de él. */
export async function consultarFicha(socioId: string): Promise<FichaSocio | null> {
  const { apr } = await requireAdmin();
  return fichaSocio(apr.id, socioId);
}
