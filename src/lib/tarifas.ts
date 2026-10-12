import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";

/** El uso del agua de un arranque (RESIDENCIAL por defecto): de ahí sale qué tarifa se le aplica. */
export async function usoDeSocio(socioId: string) {
  const socio = await db.query.socios.findFirst({
    where: eq(socios.id, socioId),
    columns: { uso: true },
  });
  return socio?.uso ?? "RESIDENCIAL";
}
