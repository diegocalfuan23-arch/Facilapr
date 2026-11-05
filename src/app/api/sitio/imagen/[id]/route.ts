import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { aprs, sitioImagenes } from "@/lib/db/schema";
import { puede, type Plan } from "@/lib/planes";

/**
 * Sirve una imagen del sitio público. Cualquiera la ve si el sitio del comité está publicado; si no,
 * solo la ve su propia directiva (para la vista previa del panel).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [fila] = await db
    .select({
      mime: sitioImagenes.mime,
      datos: sitioImagenes.datos,
      aprId: sitioImagenes.aprId,
      plan: aprs.plan,
      publicado: aprs.sitioPublicado,
      activo: aprs.activo,
    })
    .from(sitioImagenes)
    .innerJoin(aprs, eq(aprs.id, sitioImagenes.aprId))
    .where(eq(sitioImagenes.id, id))
    .limit(1)
    .catch(() => []);

  if (!fila) return new Response("No encontrada", { status: 404 });

  const publica = fila.publicado && fila.activo && puede(fila.plan as Plan, "landing");
  if (!publica) {
    const sesion = await auth.api.getSession({ headers: await headers() }).catch(() => null);
    if (!sesion || sesion.user.aprId !== fila.aprId || sesion.user.rol !== "ADMIN") {
      return new Response("No encontrada", { status: 404 });
    }
  }

  return new Response(Buffer.from(fila.datos, "base64"), {
    headers: {
      "Content-Type": fila.mime,
      "X-Content-Type-Options": "nosniff",
      // Cada subida tiene un id nuevo, así que la imagen de un id nunca cambia.
      "Cache-Control": publica ? "public, max-age=31536000, immutable" : "private, max-age=300",
    },
  });
}
