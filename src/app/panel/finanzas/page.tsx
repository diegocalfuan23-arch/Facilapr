import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/apr-session";
import { NOMBRE_PLAN, planMinimoPara, puede, type Plan } from "@/lib/planes";
import { libroDelMes, mesValido, mesVecino, nombreMes, resumir } from "@/lib/finanzas";
import { FinanzasVista } from "@/components/panel/finanzas-vista";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Finanzas",
};

export default async function FinanzasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { apr } = await requireAdmin();
  const plan = apr.plan as Plan;

  if (!puede(plan, "finanzas")) {
    return (
      <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center">
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Finanzas</h1>
        <p className="text-[0.9rem] text-muted-foreground">
          Lleva los ingresos y egresos de tu comité, mes a mes, en un solo lugar. Disponible en el plan{" "}
          {NOMBRE_PLAN[planMinimoPara("finanzas")]}.
        </p>
        <Link href="/panel/plan" className={cn(buttonVariants())}>
          Ver planes
        </Link>
      </div>
    );
  }

  const mes = mesValido((await searchParams).mes);
  const lineas = await libroDelMes(apr.id, mes);

  return (
    <FinanzasVista
      mes={mes}
      nombreMes={nombreMes(mes)}
      mesAnterior={mesVecino(mes, -1)}
      mesSiguiente={mesVecino(mes, 1)}
      lineas={lineas}
      resumen={resumir(lineas)}
    />
  );
}
