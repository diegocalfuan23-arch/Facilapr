import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { datosAsistencia } from "@/lib/asistencia-datos";
import { hoyEnChile } from "@/lib/finanzas";
import { AsistenciaVista } from "@/components/panel/asistencia-vista";
import { ConsultasProvider } from "@/components/panel/consultas-provider";

export const metadata: Metadata = {
  title: "Asistencia",
};

export default async function AsistenciaPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const hoy = hoyEnChile();
  const { dia: diaParam } = await searchParams;
  const dia = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) ? diaParam : hoy;

  return (
    <ConsultasProvider>
      <AsistenciaVista dia={dia} datos={await datosAsistencia(apr.id, dia, hoy)} />
    </ConsultasProvider>
  );
}
