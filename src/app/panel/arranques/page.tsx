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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Arranques</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">Los arranques de tu red y los socios que abastece cada uno.</p>
      </div>

      <ArranquesVista arranques={datos.arranques} socios={datos.socios} sinTablas={datos.sinTablas} />
    </div>
  );
}
