import { NextRequest } from "next/server";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { datosRendicion } from "@/lib/rendicion";
import { generarRendicionPdf } from "@/lib/rendicion-pdf";

/**
 * La rendición de cuentas de un año en PDF, para presentarla a la asamblea. Solo quien ve Finanzas, y solo en planes que
 * lo incluyen. Lo de Activos, Labores e Incidentes se suma únicamente si el plan lo tiene.
 */
export async function GET(req: NextRequest) {
  const { apr } = await requireFinanzas();
  const plan = apr.plan as Plan;
  if (!puede(plan, "finanzas")) return new Response("No disponible en tu plan.", { status: 403 });

  const hoy = hoyEnChile();
  const anioActual = Number(hoy.slice(0, 4));
  const pedido = Number(req.nextUrl.searchParams.get("anio"));
  const anio = Number.isInteger(pedido) && pedido >= 2000 && pedido <= anioActual ? pedido : anioActual;

  const datos = await datosRendicion(apr.id, anio, hoy, {
    activos: puede(plan, "activos"),
    labores: puede(plan, "inventario"),
    incidentes: puede(plan, "incidentes"),
  });
  const pdf = await generarRendicionPdf(
    {
      nombre: apr.nombre,
      razonSocial: apr.razonSocial,
      rut: apr.rut,
      direccion: apr.direccion,
      comuna: apr.comuna,
      telefono: apr.telefono,
      logo: apr.logoUrl,
    },
    datos,
    hoy
  );

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="Rendicion-de-cuentas-${anio}.pdf"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
