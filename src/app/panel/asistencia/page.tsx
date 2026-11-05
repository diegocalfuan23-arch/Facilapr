import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { asistenciaDelDia, resumenAsistenciaMes } from "@/lib/rrhh";
import { diaVecino, hoyEnChile, nombreMes } from "@/lib/finanzas";
import { AsistenciaVista } from "@/components/panel/asistencia-vista";

export const metadata: Metadata = {
  title: "Asistencia",
};

export default async function AsistenciaPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const { dia: diaParam } = await searchParams;
  const dia = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) ? diaParam : hoyEnChile();
  const mes = dia.slice(0, 7);
  const [filas, resumen] = await Promise.all([asistenciaDelDia(apr.id, dia), resumenAsistenciaMes(apr.id, mes)]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Asistencia</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Quién vino cada día. Las vacaciones y licencias aprobadas se marcan solas.</p>
      </div>

      <AsistenciaVista dia={dia} anterior={diaVecino(dia, -1)} siguiente={diaVecino(dia, 1)} filas={filas} resumen={resumen} mesTexto={nombreMes(mes)} />
    </div>
  );
}
