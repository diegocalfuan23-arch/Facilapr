import { NextRequest } from "next/server";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { datosRendicion } from "@/lib/rendicion";
import { generarRendicionPdf } from "@/lib/rendicion-pdf";
import { contenidoDeParametro, periodoDeParametros } from "@/lib/rendicion-periodo";

/**
 * La rendición de cuentas de un período en PDF, para presentarla a la asamblea. Solo quien ve Finanzas, y solo en planes que
 * lo incluyen. Lo de Activos, Labores e Incidentes se suma únicamente si el plan lo tiene.
 * Dirección: ?tipo=trimestre&anio=2026&numero=2&c=ingresos,egresos,compras
 */
export async function GET(req: NextRequest) {
  const { apr } = await requireFinanzas();
  const plan = apr.plan as Plan;
  if (!puede(plan, "finanzas")) return new Response("No disponible en tu plan.", { status: 403 });

  const hoy = hoyEnChile();
  const q = req.nextUrl.searchParams;
  const periodo = periodoDeParametros({ tipo: q.get("tipo") ?? undefined, anio: q.get("anio") ?? undefined, numero: q.get("numero") ?? undefined }, hoy);
  const contenido = contenidoDeParametro(q.get("c"));

  const datos = await datosRendicion(apr.id, periodo, hoy, {
    activos: puede(plan, "activos"),
    labores: puede(plan, "inventario"),
    incidentes: puede(plan, "incidentes"),
    inventario: puede(plan, "inventario"),
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
    hoy,
    // Lo que el plan no incluye no se anuncia en el encabezado.
    { ...contenido, inventario: contenido.inventario && Boolean(datos.inventario), extras: contenido.extras && Boolean(datos.activos || datos.labores || datos.incidentes) }
  );

  const nombre = `Rendicion-${datos.etiqueta.replace(/\./g, "").replace(/\s+/g, "-")}`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${nombre}.pdf"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
