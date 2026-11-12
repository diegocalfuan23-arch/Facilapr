import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarCompras, listarProveedores } from "@/lib/compras";
import { ComprasVista } from "@/components/panel/compras-vista";
import { ConsultasProvider } from "@/components/panel/consultas-provider";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Compras",
};

export default async function ComprasPage() {
  const { apr } = await requireFinanzas();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "finanzas")) redirect("/panel");

  const [compras, proveedores] = await Promise.all([listarCompras(apr.id), listarProveedores(apr.id)]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Compras</h1>
          <p className="mt-1 text-[15px] text-[#5B5970]">Lo que compras a tus proveedores y lo que todavía debes.</p>
        </div>
        <Link href="/panel/compras/nueva" data-tour="com-nueva" className={cn(buttonVariants(), "h-10 rounded-lg px-4 font-semibold")}>
          <Plus />
          Nueva compra
        </Link>
      </div>

      <ConsultasProvider>
        <ComprasVista compras={compras} proveedores={proveedores} />
      </ConsultasProvider>
    </div>
  );
}
