import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { movimientoAdjuntos } from "@/lib/db/schema";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";

const TIPOS = ["application/pdf", "image/png", "image/jpeg"];

/**
 * Abre el comprobante de un movimiento (el id es el del movimiento). Solo quien administra las finanzas. El filtro por
 * comité impide abrir el archivo de otro, y solo se sirven los tipos que se aceptan al adjuntar (PDF o imagen).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { apr } = await requireFinanzas();
  if (!puede(apr.plan as Plan, "finanzas")) return new Response("No disponible en tu plan.", { status: 403 });

  const { id } = await params;
  const [doc] = await db
    .select({ nombre: movimientoAdjuntos.nombre, tipo: movimientoAdjuntos.tipo, contenido: movimientoAdjuntos.contenido })
    .from(movimientoAdjuntos)
    .where(and(eq(movimientoAdjuntos.movimientoId, id), eq(movimientoAdjuntos.aprId, apr.id)))
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
