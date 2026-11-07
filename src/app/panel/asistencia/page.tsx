import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { asistenciaDelDia, asistenciaMes, diasCalendarioDelComite, horarioDelComite, horariosDelComite, horasExtraDelMes } from "@/lib/rrhh";
import type { EstadoAsistencia } from "@/lib/rrhh-comun";
import { hoyEnChile } from "@/lib/finanzas";
import { AsistenciaVista } from "@/components/panel/asistencia-vista";

export const metadata: Metadata = {
  title: "Asistencia",
};

/** El mes (AAAA-MM) a `delta` meses de otro. */
function mesVecino(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function AsistenciaPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const hoy = hoyEnChile();
  const { dia: diaParam } = await searchParams;
  const dia = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) ? diaParam : hoy;
  const mes = dia.slice(0, 7);

  // La semana puede cruzar de un mes a otro, y el aviso de días pendientes mira el mes de hoy: se cargan
  // el mes elegido, el anterior, el siguiente y el actual.
  const meses = [...new Set([mesVecino(mes, -1), mes, mesVecino(mes, 1), hoy.slice(0, 7)])];
  const [filas, planillas, extras, horarios, diasComite, comite] = await Promise.all([
    asistenciaDelDia(apr.id, dia),
    Promise.all(meses.map((m) => asistenciaMes(apr.id, m))),
    horasExtraDelMes(apr.id, mes),
    horariosDelComite(apr.id),
    diasCalendarioDelComite(apr.id),
    horarioDelComite(apr.id),
  ]);

  // Por persona y por día (AAAA-MM-DD), lo que pasó, de todos esos meses juntos.
  const grilla: Record<string, Record<string, EstadoAsistencia>> = {};
  for (const planilla of planillas) {
    for (const [id, dias] of Object.entries(planilla)) Object.assign((grilla[id] ??= {}), dias);
  }

  return <AsistenciaVista dia={dia} filas={filas} grilla={grilla} horasExtraMes={extras} horarios={horarios} diasComite={diasComite} comite={comite.horario} toleranciaMin={comite.toleranciaMin} />;
}
