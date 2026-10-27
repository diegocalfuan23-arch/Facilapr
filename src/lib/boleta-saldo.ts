import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, pagos } from "@/lib/db/schema";
import { estadoQueCorresponde, type EstadoBoleta } from "@/lib/boletas";

/** Deja Boleta.montoPagado y el estado de acuerdo con la suma de sus pagos. */
export async function recalcularBoleta(boletaId: string) {
  const [suma] = await db
    .select({ total: sql<number>`coalesce(sum(${pagos.monto}), 0)::int` })
    .from(pagos)
    .where(eq(pagos.boletaId, boletaId));
  const [boleta] = await db
    .select({
      montoTotal: boletas.montoTotal,
      fechaVencimiento: boletas.fechaVencimiento,
      estado: boletas.estado,
    })
    .from(boletas)
    .where(eq(boletas.id, boletaId))
    .limit(1);
  if (!boleta) return null;

  const pagado = suma?.total ?? 0;
  await db
    .update(boletas)
    .set({
      montoPagado: pagado,
      estado: estadoQueCorresponde(
        boleta.montoTotal,
        pagado,
        boleta.fechaVencimiento,
        boleta.estado as EstadoBoleta
      ),
      updatedAt: new Date(),
    })
    .where(eq(boletas.id, boletaId));
  return { pagado, montoTotal: boleta.montoTotal };
}
