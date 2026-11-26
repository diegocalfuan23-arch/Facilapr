import { NextRequest } from "next/server";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { datosTarifa } from "@/lib/tarifa";
import { anioPedido } from "@/lib/tarifa-comun";
import { generarTarifaPdf } from "@/lib/tarifa-pdf";

/** Los antecedentes tarifarios de un año en PDF: ?anio=2026. Solo quien ve Finanzas, y solo en planes que lo incluyen. */
export async function GET(req: NextRequest) {
  const { apr } = await requireFinanzas();
  const plan = apr.plan as Plan;
  if (!puede(plan, "finanzas")) return new Response("No disponible en tu plan.", { status: 403 });

  const hoy = hoyEnChile();
  const anio = anioPedido(req.nextUrl.searchParams.get("anio"), hoy);
  const datos = await datosTarifa(apr.id, anio, hoy, { activos: puede(plan, "activos") });
  const pdf = await generarTarifaPdf(
    {
      nombre: apr.nombre,
      razonSocial: apr.razonSocial,
      rut: apr.rut,
      direccion: apr.direccion,
      comuna: apr.comuna,
      region: apr.region,
      telefono: apr.telefono,
      logo: apr.logoUrl,
    },
    datos,
    {
      cargoFijo: apr.tarifaCargoFijo,
      valorM3: apr.tarifaMetroCubico,
      cargoFijoComercial: apr.tarifaCargoFijoComercial,
      valorM3Comercial: apr.tarifaMetroCubicoComercial,
    },
    hoy
  );

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="Antecedentes-tarifarios-${anio}.pdf"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
