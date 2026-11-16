import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { datosAusencias } from "@/lib/ausencias-datos";
import { AusenciasVista } from "@/components/panel/ausencias-vista";
import { ConsultasProvider } from "@/components/panel/consultas-provider";

export const metadata: Metadata = {
  title: "Ausencias",
};

export default async function AusenciasPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const { tipo } = await searchParams;

  return (
    <ConsultasProvider>
      <AusenciasVista datos={await datosAusencias(apr.id)} filtroInicial={tipo === "LICENCIA" ? "LICENCIA" : "todos"} />
    </ConsultasProvider>
  );
}
