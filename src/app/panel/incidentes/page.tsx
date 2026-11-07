import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarIncidentes } from "@/lib/incidentes";
import { IncidentesVista } from "@/components/panel/incidentes-vista";

export const metadata: Metadata = {
  title: "Incidentes",
};

export default async function IncidentesPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "incidentes")) redirect("/panel");

  const incidentes = await listarIncidentes(apr.id);

  return <IncidentesVista incidentes={incidentes} />;
}
