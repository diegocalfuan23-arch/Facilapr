import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarArranques } from "@/lib/arranques";
import { ArranquesVista } from "@/components/panel/arranques-vista";

export const metadata: Metadata = {
  title: "Arranques",
};

export default async function ArranquesPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "arranques")) redirect("/panel");

  const datos = await listarArranques(apr.id);

  return <ArranquesVista arranques={datos.arranques} socios={datos.socios} sinTablas={datos.sinTablas} />;
}
