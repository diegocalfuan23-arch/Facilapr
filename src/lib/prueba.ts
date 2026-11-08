import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs } from "@/lib/db/schema";

/** Cuántos días dura la prueba gratuita de un comité nuevo. */
export const DIAS_PRUEBA = 10;

/** Durante la prueba la IA del chat tiene un tope bajo (unas 100 respuestas) y los WhatsApp automáticos están apagados. */
export const TOKENS_IA_PRUEBA = 200_000;
export const MENSAJES_WHATSAPP_PRUEBA = 0;

/** El momento en que termina una prueba que parte ahora. */
export function finDePrueba(desde = new Date()) {
  const fin = new Date(desde);
  fin.setUTCDate(fin.getUTCDate() + DIAS_PRUEBA);
  return fin;
}

/** Cuántos días le quedan a la prueba (0 si no está en prueba o ya terminó). */
export function diasDePrueba(hasta: Date | null | undefined) {
  if (!hasta || hasta.getTime() <= Date.now()) return 0;
  return Math.ceil((hasta.getTime() - Date.now()) / 86_400_000);
}

/** ¿El comité está hoy en su prueba gratuita? Si la columna no existe aún en la base, no. */
export async function pruebaActiva(aprId: string): Promise<boolean> {
  try {
    const [f] = await db.select({ hasta: aprs.pruebaHasta }).from(aprs).where(eq(aprs.id, aprId)).limit(1);
    return diasDePrueba(f?.hasta) > 0;
  } catch {
    return false;
  }
}

/**
 * Si la prueba de este comité ya venció, lo devuelve al plan Pequeño y borra la fecha. Se llama al entrar al panel
 * para que el cambio sea exacto; el cron diario cubre a los comités que no vuelven a entrar.
 */
export async function cerrarPruebaSiVencio<T extends { id: string; plan: "BASICO" | "ESTANDAR" | "PREMIUM"; pruebaHasta: Date | null }>(apr: T): Promise<T> {
  if (!apr.pruebaHasta || apr.pruebaHasta.getTime() > Date.now()) return apr;
  try {
    await db
      .update(aprs)
      .set({ plan: apr.plan === "PREMIUM" ? "BASICO" : apr.plan, pruebaHasta: null, updatedAt: new Date() })
      .where(and(eq(aprs.id, apr.id), isNotNull(aprs.pruebaHasta), lt(aprs.pruebaHasta, new Date())));
    return { ...apr, plan: apr.plan === "PREMIUM" ? "BASICO" : apr.plan, pruebaHasta: null };
  } catch (e) {
    console.error("Prueba: no se pudo cerrar la prueba vencida:", e);
    return apr;
  }
}

/** Cierra todas las pruebas vencidas (las usa el cron diario). Devuelve cuántos comités volvieron al plan Pequeño. */
export async function vencerPruebas(): Promise<number> {
  const vencidos = await db
    .update(aprs)
    .set({ plan: sql`case when ${aprs.plan} = 'PREMIUM' then 'BASICO'::"Plan" else ${aprs.plan} end`, pruebaHasta: null, updatedAt: new Date() })
    .where(and(isNotNull(aprs.pruebaHasta), lt(aprs.pruebaHasta, new Date())))
    .returning({ id: aprs.id });
  return vencidos.length;
}
