import type { Metadata } from "next";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { datosResumen } from "@/lib/resumen";
import { DEMO } from "@/lib/demo-dashboard";
import { ResumenVista } from "@/components/panel/resumen-vista";

export const metadata: Metadata = {
  title: "Resumen",
};

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ mes?: string; demo?: string }> }) {
  // requireAdmin lleva al tesorero a su Caja.
  const { user, apr } = await requireAdmin();
  const { mes, demo } = await searchParams;

  // Con ?demo=1 se ven cifras inventadas y con su aviso; nunca por defecto: un dirigente podría tomarlas por suyas.
  if (demo === "1") {
    const opciones = DEMO.periodo.opciones;
    return <ResumenVista d={{ ...DEMO, saludo: `Buenos días, ${user.name.trim().split(/\s+/)[0] || "Admin"}`, periodo: { ...DEMO.periodo, valor: opciones.some((o) => o.valor === mes) ? (mes as string) : DEMO.periodo.valor } }} />;
  }

  const plan = apr.plan as Plan;
  const d = await datosResumen({
    aprId: apr.id,
    usuarioNombre: user.name,
    periodoPedido: mes,
    conCaja: puede(plan, "finanzas"),
    conInventario: puede(plan, "inventario"),
  });

  return <ResumenVista d={d} />;
}
