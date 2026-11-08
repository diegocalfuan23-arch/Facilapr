import { asistenciaDelDia, asistenciaMes, diasCalendarioDelComite, horarioDelComite, horariosDelComite, horasExtraDelMes } from "@/lib/rrhh";
import type { DatosAsistencia, EstadoAsistencia } from "@/lib/rrhh-comun";

/** El mes (AAAA-MM) a `delta` meses de otro. */
function mesVecino(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Lo que muestra la pantalla de Asistencia para un día. La semana puede cruzar de un mes a otro, y el aviso de días
 * pendientes mira el mes de hoy: se cargan el mes elegido, el anterior, el siguiente y el actual. La usan la página
 * (al abrirse) y la acción que vuelve a pedir los datos sin recargar.
 */
export async function datosAsistencia(aprId: string, dia: string, hoy: string): Promise<DatosAsistencia> {
  const mes = dia.slice(0, 7);
  const meses = [...new Set([mesVecino(mes, -1), mes, mesVecino(mes, 1), hoy.slice(0, 7)])];
  const [filas, planillas, horasExtraMes, horarios, diasComite, comite] = await Promise.all([
    asistenciaDelDia(aprId, dia),
    Promise.all(meses.map((m) => asistenciaMes(aprId, m))),
    horasExtraDelMes(aprId, mes),
    horariosDelComite(aprId),
    diasCalendarioDelComite(aprId),
    horarioDelComite(aprId),
  ]);

  const grilla: Record<string, Record<string, EstadoAsistencia>> = {};
  for (const planilla of planillas) {
    for (const [id, dias] of Object.entries(planilla)) Object.assign((grilla[id] ??= {}), dias);
  }

  return { filas, grilla, horasExtraMes, horarios, diasComite, comite: comite.horario, toleranciaMin: comite.toleranciaMin };
}
