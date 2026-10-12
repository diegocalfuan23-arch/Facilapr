import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { evidenciasOrden, ordenes } from "@/lib/db/schema";
import { requireApr } from "@/lib/apr-session";

/**
 * La foto de evidencia de una orden. Solo la ve quien pertenece al comité dueño
 * de la orden: el filtro por aprId es lo que impide abrir la de otro comité
 * cambiando el id.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { apr } = await requireApr();
  const { id } = await params;

  const [foto] = await db
    .select({ mime: evidenciasOrden.mime, datos: evidenciasOrden.datos })
    .from(evidenciasOrden)
    .innerJoin(ordenes, eq(evidenciasOrden.ordenId, ordenes.id))
    .where(and(eq(ordenes.id, id), eq(ordenes.aprId, apr.id)))
    .orderBy(desc(evidenciasOrden.createdAt))
    .limit(1);

  if (!foto) return new Response("No encontrada.", { status: 404 });

  return new Response(Buffer.from(foto.datos, "base64"), {
    headers: {
      "content-type": foto.mime,
      "cache-control": "private, max-age=300",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
