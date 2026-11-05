import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarTrabajadores } from "@/lib/personal";
import { listarAusencias } from "@/lib/rrhh";
import { AusenciasVista } from "@/components/panel/ausencias-vista";

export const metadata: Metadata = {
  title: "Licencias",
};

export default async function LicenciasPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const [personas, ausencias] = await Promise.all([listarTrabajadores(apr.id), listarAusencias(apr.id, ["LICENCIA"])]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Licencias</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Las licencias médicas del personal, con su folio y sus fechas.</p>
      </div>

      <AusenciasVista tipo="LICENCIA" ausencias={ausencias} personas={personas.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre }))} />
    </div>
  );
}
