import { NextRequest } from "next/server";
import { pagoIdDeCodigo } from "@/lib/comprobante-enlace";
import { generarComprobantePdf } from "@/lib/comprobante-pdf";
import { comprobantePorId } from "@/lib/comprobante";

/**
 * Comprobante de pago en PDF a partir del enlace firmado (ver
 * comprobante-enlace.ts). Sin sesión: lo protege que el código no se puede
 * adivinar. Un código alterado o un pago que ya no existe responden 404.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;

  const pagoId = pagoIdDeCodigo(decodeURIComponent(codigo));
  if (!pagoId) return new Response("No encontrado.", { status: 404 });

  const comprobante = await comprobantePorId(pagoId);
  if (!comprobante) return new Response("No encontrado.", { status: 404 });

  const pdf = await generarComprobantePdf(comprobante);
  const nombre = `Comprobante ${comprobante.periodo} ${comprobante.socio.nombre}`
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${nombre}.pdf"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
