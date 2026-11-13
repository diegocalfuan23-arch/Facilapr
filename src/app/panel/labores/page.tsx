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

  return <LaboresVista labores={labores} insumos={insumos} />;
}
