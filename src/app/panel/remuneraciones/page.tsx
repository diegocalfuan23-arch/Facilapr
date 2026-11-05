import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarRemuneraciones } from "@/lib/rrhh";
import { mesValido, mesVecino, nombreMes } from "@/lib/finanzas";
import { RemuneracionesVista } from "@/components/panel/remuneraciones-vista";

export const metadata: Metadata = {
  title: "Remuneraciones",
};

export default async function RemuneracionesPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const { mes: mesParam } = await searchParams;
  const periodo = mesValido(mesParam);
  const filas = await listarRemuneraciones(apr.id, periodo);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Remuneraciones</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Los sueldos y honorarios de cada mes. Al pagar, quedan en la Caja.</p>
      </div>

      <RemuneracionesVista
        filas={filas}
        periodo={periodo}
        anterior={mesVecino(periodo, -1)}
        siguiente={mesVecino(periodo, 1)}
        mesTexto={nombreMes(periodo)}
      />
    </div>
  );
}
