import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { activoPorId } from "@/lib/activos";
import { generarFichaActivoPdf } from "@/lib/activo-pdf";
import { hoyEnChile } from "@/lib/finanzas-comun";

/**
 * La ficha de un bien del comité en PDF. Solo la directiva (administrador). El filtro por comité impide abrir
 * la ficha de un bien de otro.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "activos")) return new Response("No disponible en tu plan.", { status: 403 });

  const { id } = await params;
  const activo = await activoPorId(apr.id, id);
  if (!activo) return new Response("No encontrado.", { status: 404 });

  const pdf = await generarFichaActivoPdf(
    {
      nombre: apr.nombre,
      razonSocial: apr.razonSocial,
      rut: apr.rut,
      direccion: apr.direccion,
      comuna: apr.comuna,
      telefono: apr.telefono,
      logo: apr.logoUrl,
    },
    activo,
    hoyEnChile()
  );
  const nombre = `Ficha ${activo.codigo ?? ""} ${activo.nombre}`.replace(/[^\w\s.-]/g, "").trim().replace(/\s+/g, "-");

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${nombre}.pdf"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
