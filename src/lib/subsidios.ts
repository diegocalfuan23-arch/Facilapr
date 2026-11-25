import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios, subsidios } from "@/lib/db/schema";
import { subsidioVigente, type ReglaSubsidio } from "@/lib/boletas";

/** El subsidio que se le aplica a un arranque en un mes; null si no tiene o no está vigente. */
export async function subsidioDe(socioId: string, periodo: string): Promise<ReglaSubsidio | null> {
  const fila = await db.query.subsidios.findFirst({ where: eq(subsidios.socioId, socioId) });
  return subsidioVigente(fila, periodo);
}

/** Los subsidios del comité por socio, para calcular muchas boletas de una vez. */
export async function subsidiosDelApr(aprId: string) {
  const filas = await db
    .select({
      socioId: subsidios.socioId,
      porcentaje: subsidios.porcentaje,
      topeM3: subsidios.topeM3,
      desde: subsidios.desde,
      hasta: subsidios.hasta,
    })
    .from(subsidios)
    .innerJoin(socios, eq(socios.id, subsidios.socioId))
    .where(eq(socios.aprId, aprId));
  return new Map(filas.map((f) => [f.socioId, f]));
}
