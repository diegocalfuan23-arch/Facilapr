import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarCategorias, listarInsumos } from "@/lib/inventario";
import { avanzarLaboresVencidas } from "@/lib/labores-auto";
import { listarHistorial } from "@/lib/inventario-historial";
import { InventarioVista } from "@/components/panel/inventario-vista";
import { ConsultasProvider } from "@/components/panel/consultas-provider";

export const metadata: Metadata = {
  title: "Inventario",
};

export default async function InventarioPage() {
  const { apr } = await requireFinanzas();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "inventario")) redirect("/panel");

  // Una labor que terminó a su hora descuenta materiales: se aplica antes de mostrar el stock.
  await avanzarLaboresVencidas(apr.id);

  const [insumos, categoriasPropias, historial] = await Promise.all([
    listarInsumos(apr.id),
    listarCategorias(apr.id),
    listarHistorial(apr.id),
  ]);

  return (
    <ConsultasProvider>
      <InventarioVista insumos={insumos} categoriasPropias={categoriasPropias} historial={historial} />
    </ConsultasProvider>
  );
}
