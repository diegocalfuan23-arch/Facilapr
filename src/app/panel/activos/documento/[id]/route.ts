import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { activoDocumentos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { DOC_TIPOS } from "@/lib/activos-comun";

/**
 * Abre un archivo adjunto a un bien (factura, garantía, plano). Solo la directiva. El filtro por comité impide abrir el
 * archivo de otro, y solo se sirven los tipos que se aceptan al adjuntar (PDF o imagen).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "activos")) return new Response("No disponible en tu plan.", { status: 403 });

  const { id } = await params;
  const [doc] = await db
    .select({ nombre: activoDocumentos.nombre, tipo: activoDocumentos.tipo, contenido: activoDocumentos.contenido })
    .from(activoDocumentos)
    .where(and(eq(activoDocumentos.id, id), eq(activoDocumentos.aprId, apr.id)))
    .limit(1)
    .catch(() => []);
  if (!doc || !(DOC_TIPOS as readonly string[]).includes(doc.tipo)) return new Response("No encontrado.", { status: 404 });

  return new Response(Buffer.from(doc.contenido, "base64"), {
    headers: {
      "content-type": doc.tipo,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.nombre)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
