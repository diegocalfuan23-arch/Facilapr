import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sitioTema } from "@/lib/db/schema";
import { esColorHex } from "@/lib/sitio-tema-comun";

export * from "@/lib/sitio-tema-comun";

/** El color elegido para el sitio de un comité, o null si usa el de Facilapr. Si la tabla aún no existe, null. */
export async function colorDelSitio(aprId: string): Promise<string | null> {
  try {
    const [fila] = await db.select({ color: sitioTema.color }).from(sitioTema).where(eq(sitioTema.aprId, aprId)).limit(1);
    return fila && esColorHex(fila.color) ? fila.color : null;
  } catch (e) {
    console.error("Sitio: no se pudo leer el color:", e);
    return null;
  }
}
