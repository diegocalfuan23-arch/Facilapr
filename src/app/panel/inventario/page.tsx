import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/apr-session";
import { NOMBRE_PLAN, planMinimoPara, puede, type Plan } from "@/lib/planes";
import { estaBajo, listarCategorias, listarInsumos } from "@/lib/inventario";
import { listarHistorial } from "@/lib/inventario-historial";
import { InventarioVista } from "@/components/panel/inventario-vista";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Inventario",
};

export default async function InventarioPage() {
  const { apr } = await requireAdmin();

  if (!puede(apr.plan as Plan, "inventario")) {
    return (
      <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Inventario</h1>
        <p className="text-[0.9rem] text-muted-foreground">
          Lleva el control de la bodega de tu comité: cloro, cañerías, medidores y repuestos, con aviso cuando algo se esté
          acabando. Disponible en el plan {NOMBRE_PLAN[planMinimoPara("inventario")]}.
        </p>
        <Link href="/panel/plan" className={cn(buttonVariants())}>
          Ver planes
        </Link>
      </div>
    );
  }

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
