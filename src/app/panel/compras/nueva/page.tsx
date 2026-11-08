import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarProveedores } from "@/lib/compras";
import { listarInsumos } from "@/lib/inventario";
import { CompraFormulario } from "@/components/panel/compra-formulario";

export const metadata: Metadata = {
  title: "Nueva compra",
};

export default async function NuevaCompraPage({ searchParams }: { searchParams: Promise<{ proveedor?: string }> }) {
  const { apr } = await requireFinanzas();
  if (!puede(apr.plan as Plan, "finanzas")) redirect("/panel/compras");

  const { proveedor } = await searchParams;
  const [proveedores, insumos] = await Promise.all([listarProveedores(apr.id), listarInsumos(apr.id)]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <Link href="/panel/compras" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5B5970] hover:text-[#15132B]">
          <ArrowLeft className="size-4" aria-hidden />
          Compras
        </Link>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight">Nueva compra</h1>
        <p className="mt-0.5 text-[0.95rem] text-[#5B5970]">Registra lo que compraste. Los materiales suman stock al inventario y el pago queda en la Caja.</p>
      </div>

      <CompraFormulario proveedores={proveedores} insumos={insumos} proveedorInicial={proveedor} />
    </div>
  );
}
