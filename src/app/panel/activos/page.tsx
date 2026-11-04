import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarActivos } from "@/lib/activos";
import { ActivosVista } from "@/components/panel/activos-vista";

export const metadata: Metadata = {
  title: "Activos fijos",
};

export default async function ActivosPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "activos")) redirect("/panel");

  const activos = await listarActivos(apr.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Activos fijos</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Los bienes del comité: qué tienes, cuánto costó y cuánto vale hoy.</p>
      </div>

      <ActivosVista activos={activos} />
    </div>
  );
}
