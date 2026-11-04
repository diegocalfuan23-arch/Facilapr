import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarCompras, listarProveedores } from "@/lib/compras";
import { ComprasVista } from "@/components/panel/compras-vista";

export const metadata: Metadata = {
  title: "Compras",
};

export default async function ComprasPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "finanzas")) redirect("/panel");

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
