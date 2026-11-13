import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarActivos } from "@/lib/activos";
import { ActivosVista } from "@/components/panel/activos-vista";
import { ConsultasProvider } from "@/components/panel/consultas-provider";

export const metadata: Metadata = {
  title: "Activos fijos",
};

export default async function ActivosPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "activos")) redirect("/panel");

  const activos = await listarActivos(apr.id);

  return (
    <ConsultasProvider>
      <ActivosVista activos={activos} />
    </ConsultasProvider>
  );
}
