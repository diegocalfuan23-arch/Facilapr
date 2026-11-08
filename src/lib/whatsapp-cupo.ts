import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { mensajesWhatsapp } from "@/lib/db/schema";
import type { Plan } from "@/lib/planes";
import { MENSAJES_WHATSAPP_PRUEBA, pruebaActiva } from "@/lib/prueba";
import { credencialesDelComite } from "@/lib/whatsapp-conexion";
import { MENSAJES_WHATSAPP_POR_PLAN, type CupoWhatsapp } from "@/lib/whatsapp-cupo-comun";

export * from "@/lib/whatsapp-cupo-comun";

/**
 * Cuántos mensajes automáticos lleva el comité este mes (hora de Chile) frente al tope de su plan.
 * Los mensajes fallidos no cuentan. Un comité que conectó su propio número no gasta el cupo de Facilapr.
 */
export async function cupoWhatsapp(aprId: string, plan: Plan): Promise<CupoWhatsapp> {
  if (await credencialesDelComite(aprId)) return { limite: null, usados: 0, restantes: null, disponible: true };

  // En la prueba gratuita no se gasta cupo de Meta: el envío cae al manual con wa.me.
  const limite = (await pruebaActiva(aprId)) ? MENSAJES_WHATSAPP_PRUEBA : (MENSAJES_WHATSAPP_POR_PLAN[plan] ?? MENSAJES_WHATSAPP_POR_PLAN.BASICO);
  const [f] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mensajesWhatsapp)
    .where(
      and(
        eq(mensajesWhatsapp.aprId, aprId),
        ne(mensajesWhatsapp.estado, "FALLIDO"),
        sql`${mensajesWhatsapp.createdAt} >= (date_trunc('month', now() AT TIME ZONE 'America/Santiago') AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC'`
      )
    )
    .catch(() => [{ n: 0 }]);
  const usados = f?.n ?? 0;
  const restantes = Math.max(0, limite - usados);
  return { limite, usados, restantes, disponible: restantes > 0 };
}
