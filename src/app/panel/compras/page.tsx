import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/apr-session";
import { NOMBRE_PLAN, planMinimoPara, puede, type Plan } from "@/lib/planes";
import { listarCompras, listarProveedores } from "@/lib/compras";
import { ComprasVista } from "@/components/panel/compras-vista";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Compras",
};

export default async function ComprasPage() {
  const { apr } = await requireAdmin();

  if (!puede(apr.plan as Plan, "finanzas")) {
    return (
      <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Compras</h1>
        <p className="text-[0.9rem] text-muted-foreground">
          Registra lo que compras a tus proveedores, sube el stock del inventario y lleva lo que debes. Disponible en el plan{" "}
          {NOMBRE_PLAN[planMinimoPara("finanzas")]}.
        </p>
        <Link href="/panel/plan" className={cn(buttonVariants())}>
          Ver planes
        </Link>
      </div>
    );
  }

  const [compras, proveedores] = await Promise.all([listarCompras(apr.id), listarProveedores(apr.id)]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Compras</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Lo que compras a tus proveedores y lo que todavía debes.</p>
      </div>

      <ComprasVista compras={compras} proveedores={proveedores} />
    </div>
  );
}
