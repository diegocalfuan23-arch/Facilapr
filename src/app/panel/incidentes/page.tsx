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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Incidentes</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Fugas, fallas y cortes del sistema de agua, y lo que costó repararlos.</p>
      </div>

      <IncidentesVista incidentes={incidentes} />
    </div>
  );
}
