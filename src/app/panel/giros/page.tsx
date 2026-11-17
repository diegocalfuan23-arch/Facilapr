import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { datosGiros } from "@/lib/giros-datos";
import { GirosVista } from "@/components/panel/giros-vista";
import { ConsultasProvider } from "@/components/panel/consultas-provider";

export const metadata: Metadata = {
  title: "Giros",
};

export default async function GirosPage() {
  const { apr } = await requireFinanzas();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "finanzas")) redirect("/panel");

  return (
    <ConsultasProvider>
      <GirosVista datos={await datosGiros(apr.id)} />
    </ConsultasProvider>
  );
}
