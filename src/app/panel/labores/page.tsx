import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarLabores } from "@/lib/labores";
import { avanzarLaboresVencidas } from "@/lib/labores-auto";
import { listarInsumos } from "@/lib/inventario";
import { operadoresDelComite, rutasDelComite } from "@/lib/rutas";
import { LaboresVista } from "@/components/panel/labores-vista";

export const metadata: Metadata = {
  title: "Labores",
};

export default async function LaboresPage({ searchParams }: { searchParams: Promise<{ insumo?: string }> }) {
  const { user, apr } = await requireAdmin();
  const { insumo } = await searchParams;

  // Las labores usan el inventario: van con el mismo plan.
  if (!puede(apr.plan as Plan, "inventario")) redirect("/panel");

  // Las labores que llegaron a su hora pasan solas de estado antes de mostrarlas.
  await avanzarLaboresVencidas(apr.id);
  const [labores, insumos, todasLasRutas, operadores] = await Promise.all([listarLabores(apr.id), listarInsumos(apr.id), rutasDelComite(apr.id, user.id, "ADMIN"), operadoresDelComite(apr.id)]);
  const rutas = todasLasRutas.filter((r) => r.aprobada).map((r) => ({ id: r.id, nombre: r.nombre }));

  return <LaboresVista labores={labores} insumos={insumos} rutas={rutas} responsables={operadores.map((o) => o.nombre)} insumoInicial={insumos.some((i) => i.id === insumo) ? insumo : undefined} />;
}
