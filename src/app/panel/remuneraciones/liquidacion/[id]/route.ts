import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { liquidacionPorId } from "@/lib/liquidacion";
import { generarLiquidacionPdf } from "@/lib/liquidacion-pdf";

/**
 * La liquidación de sueldo en PDF. Solo la directiva (administrador): lleva el sueldo y los descuentos de
 * una persona. El filtro por comité impide abrir la liquidación de otro.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return new Response("No disponible en tu plan.", { status: 403 });

  const { id } = await params;
  const liquidacion = await liquidacionPorId(apr.id, id);
  if (!liquidacion) return new Response("No encontrada.", { status: 404 });

  const pdf = await generarLiquidacionPdf(liquidacion);
  const nombre = `Liquidacion ${liquidacion.periodo} ${liquidacion.persona.nombre}`.replace(/[^\w\s.-]/g, "").trim().replace(/\s+/g, "-");

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${nombre}.pdf"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
