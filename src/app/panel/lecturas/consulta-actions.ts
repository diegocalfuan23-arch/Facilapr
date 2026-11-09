"use server";

import { requireApr } from "@/lib/apr-session";
import { datosLecturas, type DatosLecturas } from "@/lib/lecturas-datos";

/** Los datos de la pantalla de Lecturas de la directiva, para que la vuelva a pedir sin recargar la página (la usa TanStack Query). */
export async function consultarLecturas(): Promise<DatosLecturas> {
  const { user, apr } = await requireApr();
  // El operador tiene su propia pantalla de terreno: esta es solo de la directiva.
  if (user.rol !== "ADMIN") throw new Error("Esta pantalla es de la directiva.");
  return datosLecturas(apr.id);
}
