import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { estaBajo, listarCategorias, listarInsumos } from "@/lib/inventario";
import { listarHistorial } from "@/lib/inventario-historial";
import { InventarioVista } from "@/components/panel/inventario-vista";

export const metadata: Metadata = {
  title: "Inventario",
};

export default async function InventarioPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "inventario")) redirect("/panel");

  const [insumos, categoriasPropias, historial] = await Promise.all([
    listarInsumos(apr.id),
    listarCategorias(apr.id),
    listarHistorial(apr.id),
  ]);
  const bajos = insumos.filter(estaBajo).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Inventario</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
          {insumos.length === 0
            ? "Cloro, cañerías, medidores, repuestos: lo que guardas en bodega."
            : bajos > 0
              ? `${insumos.length} en total, ${bajos} a punto de acabarse.`
              : `${insumos.length} ${insumos.length === 1 ? "material registrado" : "materiales registrados"}.`}
        </p>
      </div>

      <InventarioVista insumos={insumos} categoriasPropias={categoriasPropias} historial={historial} />
    </div>
  );
}
