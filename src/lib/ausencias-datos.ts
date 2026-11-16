import { listarTrabajadores } from "@/lib/personal";
import { listarAusencias, saldoVacaciones, vacacionesTomadas, vacacionesTomadasDetalle } from "@/lib/rrhh";
import { hoyEnChile } from "@/lib/finanzas-comun";
import type { AusenciaFila } from "@/lib/rrhh-comun";
import type { SaldoVacaciones } from "@/lib/ausencias-clases";

/** Todo lo que muestra el tablero de Vacaciones: las ausencias, las personas activas y el saldo de cada una. */
export type DatosAusencias = {
  ausencias: AusenciaFila[];
  personas: { id: string; nombre: string }[];
  saldos: SaldoVacaciones[];
};

/** Los datos del tablero. La usan la página (al abrirse) y la consulta que lo mantiene al día sin recargar. */
export async function datosAusencias(aprId: string): Promise<DatosAusencias> {
  const [todas, ausencias, tomadas, detalle] = await Promise.all([
    listarTrabajadores(aprId),
    listarAusencias(aprId, ["VACACIONES", "PERMISO", "LICENCIA"]),
    vacacionesTomadas(aprId),
    vacacionesTomadasDetalle(aprId),
  ]);
  const activas = todas.filter((p) => p.activo);
  const hoy = hoyEnChile();
  const saldos = activas.map((p) => {
    const s = saldoVacaciones(p.fechaIngreso, tomadas[p.id] ?? 0, hoy, detalle[p.id] ?? []);
    return {
      id: p.id,
      nombre: p.nombre,
      ganados: s?.ganados ?? null,
      tomados: tomadas[p.id] ?? 0,
      saldo: s?.saldo ?? null,
      desde: s?.primerAniversario ?? null,
      delAnio: s?.delAnio ?? null,
      acumulados: s?.acumulados ?? null,
      usadosPeriodo: s?.usadosPeriodo ?? null,
    };
  });
  return { ausencias, personas: activas.map((p) => ({ id: p.id, nombre: p.nombre })), saldos };
}
