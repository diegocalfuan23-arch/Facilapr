import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarProveedores } from "@/lib/compras";
import { listarCategorias, listarInsumos, opcionesDeCategoria } from "@/lib/inventario";
import { CompraFormulario } from "@/components/panel/compra-formulario";

export const metadata: Metadata = {
  title: "Nueva compra",
};

export default async function NuevaCompraPage() {
  const { apr } = await requireFinanzas();
  if (!puede(apr.plan as Plan, "finanzas")) redirect("/panel/compras");

  const [proveedores, insumos, categoriasPropias] = await Promise.all([
    listarProveedores(apr.id),
    listarInsumos(apr.id),
    listarCategorias(apr.id),
  ]);

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <Link href="/panel/compras" className="text-[0.9rem] text-muted-foreground hover:underline">
          ← Volver a Compras
        </Link>
        <h1 className="mt-2 text-[1.35rem] font-semibold tracking-tight">Nueva compra</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
          Lo que compraste y a quién. Los materiales suman stock al inventario.
        </p>
      </div>

      <CompraFormulario
        proveedores={proveedores}
        insumos={insumos}
        categorias={opcionesDeCategoria(
          categoriasPropias,
          insumos.map((i) => i.categoria)
        )}
      />
    </div>
  );
}
