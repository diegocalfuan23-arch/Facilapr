import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { comunicados } from "@/lib/db/schema";

export type ComunicadoFila = { id: string; titulo: string; mensaje: string; createdAt: Date };

/**
 * Los últimos comunicados del comité, del más nuevo al más viejo. Con `dias` solo los de ese tiempo hacia atrás (es lo que
 * ve el socio: un aviso de hace meses ya no sirve). Si la tabla todavía no existe, devuelve vacío.
 */
export async function listarComunicados(aprId: string, limite = 5, dias?: number): Promise<ComunicadoFila[]> {
  const desde = dias ? new Date(Date.now() - dias * 86_400_000) : null;
  return db
    .select({ id: comunicados.id, titulo: comunicados.titulo, mensaje: comunicados.mensaje, createdAt: comunicados.createdAt })
    .from(comunicados)
    .where(desde ? and(eq(comunicados.aprId, aprId), gte(comunicados.createdAt, desde)) : eq(comunicados.aprId, aprId))
    .orderBy(desc(comunicados.createdAt))
    .limit(limite)
    .catch((e) => {
      console.error("Comunicados: no se pudieron leer:", e);
      return [];
    });
}
