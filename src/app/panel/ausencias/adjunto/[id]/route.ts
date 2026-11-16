import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ausenciaAdjuntos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";

const TIPOS = ["application/pdf", "image/png", "image/jpeg"];

/**
 * Abre el archivo de una licencia médica. Solo la directiva. El filtro por comité impide abrir el archivo de otro, y solo
 * se sirven los tipos que se aceptan al adjuntar (PDF o imagen).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return new Response("No disponible en tu plan.", { status: 403 });

  const { id } = await params;
  const [doc] = await db
    .select({ nombre: ausenciaAdjuntos.nombre, tipo: ausenciaAdjuntos.tipo, contenido: ausenciaAdjuntos.contenido })
    .from(ausenciaAdjuntos)
    .where(and(eq(ausenciaAdjuntos.id, id), eq(ausenciaAdjuntos.aprId, apr.id)))
    .limit(1)
    .catch(() => []);
  if (!doc || !TIPOS.includes(doc.tipo)) return new Response("No encontrado.", { status: 404 });

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
