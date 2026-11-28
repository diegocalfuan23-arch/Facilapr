import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { siiDocumentos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { siiHabilitado } from "@/lib/sii/seguridad";
import { boletaPdf } from "@/lib/sii/dte/impreso";
import type { FotoDocumento } from "@/lib/sii/emision";

export const dynamic = "force-dynamic";

/** El PDF de un documento emitido, impreso con lo que se firmó. */
export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const { apr } = await requireAdmin();
  if (!siiHabilitado(apr.slug)) return new Response("No disponible.", { status: 404 });

  const { id } = await params;
  const documento = await db.query.siiDocumentos.findFirst({ where: and(eq(siiDocumentos.id, id), eq(siiDocumentos.aprId, apr.id)) });
  const timbre = documento?.xml.match(/<TED[\s>][\s\S]*?<\/TED>/)?.[0];
  if (!documento || !timbre) return new Response("No encontramos esa boleta.", { status: 404 });

  const foto = documento.datos as FotoDocumento;
  const pdf = await boletaPdf(foto.boleta, {
    emisor: foto.emisor,
    timbre,
    resolucion: foto.resolucion,
    // Mientras el SII no la reciba, no vale como documento tributario.
    prueba: documento.estado === "FIRMADA" || documento.estado === "RECHAZADA" ? "Sin aceptar por el SII." : undefined,
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="Boleta-${documento.folio}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
