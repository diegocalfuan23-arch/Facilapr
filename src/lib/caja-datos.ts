import {
  diaVecino,
  hoyEnChile,
  libroDelDia,
  libroDelMes,
  listarCategoriasMovimiento,
  mesVecino,
  resumenPeriodo,
  resumir,
  saldoBancoDe,
  saldoInicialDe,
  tendenciaDisponible,
} from "@/lib/finanzas";
import type { DatosCaja } from "@/lib/finanzas-comun";

/** El disponible día a día: los últimos 7 días en la vista del día, o el mes entero (hasta hoy) en la del mes. */
async function tendenciaDelPeriodo(aprId: string, esDia: boolean, dia: string, mes: string) {
  if (esDia) return tendenciaDisponible(aprId, dia, 7);
  const ultimo = diaVecino(`${mesVecino(mes, 1)}-01`, -1);
  const hoy = hoyEnChile();
  const hasta = ultimo < hoy ? ultimo : hoy;
  if (hasta < `${mes}-01`) return null;
  return tendenciaDisponible(aprId, hasta, Number(hasta.slice(8)));
}

/**
 * Lo que muestra la Caja para un día o un mes. La usan la página (al abrirse) y la acción que vuelve a pedir los datos
 * sin recargar.
 */
export async function datosCaja(aprId: string, esDia: boolean, dia: string, mes: string): Promise<DatosCaja> {
  const desde = esDia ? dia : `${mes}-01`;
  const hasta = esDia ? diaVecino(dia, 1) : `${mesVecino(mes, 1)}-01`;

  // Todo sale junto: el libro y el resumen no dependen uno del otro para pedirse.
  const lineasP = esDia ? libroDelDia(aprId, dia) : libroDelMes(aprId, mes);
  const [lineas, resumen, saldoInicialBase, categoriasPropias, saldoBanco, tendencia] = await Promise.all([
    lineasP,
    resumenPeriodo(aprId, desde, hasta, lineasP),
    saldoInicialDe(aprId),
    listarCategoriasMovimiento(aprId),
    saldoBancoDe(aprId),
    tendenciaDelPeriodo(aprId, esDia, dia, mes).catch(() => null),
  ]);
  const saldoInicial = saldoInicialBase ? { ...saldoInicialBase, banco: Math.min(saldoBanco, saldoInicialBase.monto) } : null;

  return { resumen, lineas, porCategoria: resumir(lineas, categoriasPropias).porCategoria, categoriasPropias, saldoInicial, tendencia };
}
