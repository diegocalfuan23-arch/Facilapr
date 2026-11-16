import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { datosRendicion } from "@/lib/rendicion";
import { periodoDeParametros, seccionesIniciales } from "@/lib/rendicion-periodo";
import { RendicionesVista } from "@/components/panel/rendiciones-vista";
import { ConsultasProvider } from "@/components/panel/consultas-provider";

export const metadata: Metadata = {
  title: "Rendiciones",
};

/**
 * Rendiciones de Finanzas: las cuentas del comité de un mes, trimestre, semestre o año, con las partes que se elijan,
 * para revisarlas y bajarlas en PDF o Excel. La dirección recuerda el período: ?tipo=trimestre&anio=2026&numero=2.
 */
export default async function RendicionesPage({ searchParams }: { searchParams: Promise<{ tipo?: string; anio?: string; numero?: string; c?: string }> }) {
  const { apr } = await requireFinanzas();
  const plan = apr.plan as Plan;

  // Un plan que no incluye Finanzas no tiene este módulo: no se muestra ni por la dirección directa.
  if (!puede(plan, "finanzas")) redirect("/panel");

  const hoy = hoyEnChile();
  const parametros = await searchParams;
  const periodo = periodoDeParametros(parametros, hoy);
  const inicial = await datosRendicion(apr.id, periodo, hoy, {
    activos: puede(plan, "activos"),
    labores: puede(plan, "inventario"),
    incidentes: puede(plan, "incidentes"),
    inventario: puede(plan, "inventario"),
  });

  return (
    <ConsultasProvider>
      <RendicionesVista inicial={inicial} hoy={hoy} seccionesIniciales={seccionesIniciales(parametros.c)} />
    </ConsultasProvider>
  );
}
