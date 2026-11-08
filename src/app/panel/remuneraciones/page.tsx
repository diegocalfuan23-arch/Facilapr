import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarRemuneraciones, personasSinLiquidacion } from "@/lib/rrhh";
import { mesValido, mesVecino, nombreMes } from "@/lib/finanzas";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { RemuneracionesVista } from "@/components/panel/remuneraciones-vista";
import { ConsultasProvider } from "@/components/panel/consultas-provider";

export const metadata: Metadata = {
  title: "Remuneraciones",
};

export default async function RemuneracionesPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const { mes: mesParam } = await searchParams;
  const periodo = mesValido(mesParam);
  const [filas, faltan] = await Promise.all([listarRemuneraciones(apr.id, periodo), personasSinLiquidacion(apr.id, periodo)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">Remuneraciones</h1>
        <p className="mt-0.5 hidden text-[0.95rem] text-[#5B5970] sm:block">
          Días trabajados + horas extras = imponible; se restan imposiciones y préstamos. Al pagar queda en la Caja.
        </p>
      </div>

      <ConsultasProvider>
        <RemuneracionesVista
          datos={{ filas, faltan }}
          periodo={periodo}
          anterior={mesVecino(periodo, -1)}
          siguiente={mesVecino(periodo, 1)}
          mesTexto={nombreMes(periodo)}
          mesEnCurso={hoyEnChile().slice(0, 7) === periodo}
        />
      </ConsultasProvider>
    </div>
  );
}
