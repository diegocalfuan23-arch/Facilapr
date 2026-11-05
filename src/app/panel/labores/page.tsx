import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarLabores } from "@/lib/labores";
import { avanzarLaboresVencidas } from "@/lib/labores-auto";
import { listarInsumos } from "@/lib/inventario";
import { LaboresVista } from "@/components/panel/labores-vista";

export const metadata: Metadata = {
  title: "Labores",
};

export default async function LaboresPage() {
  const { apr } = await requireAdmin();

  // Las labores usan el inventario: van con el mismo plan.
  if (!puede(apr.plan as Plan, "inventario")) redirect("/panel");

  // Las labores que llegaron a su hora pasan solas de estado antes de mostrarlas.
  await avanzarLaboresVencidas(apr.id);
  const [labores, insumos] = await Promise.all([listarLabores(apr.id), listarInsumos(apr.id)]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Labores</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Los trabajos del comité y los materiales que usan: al marcarlos como hechos, se descuentan del inventario.</p>
      </div>

      <LaboresVista labores={labores} insumos={insumos} />
    </div>
  );
}
