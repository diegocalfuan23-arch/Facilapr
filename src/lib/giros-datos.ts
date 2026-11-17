import { bancoAlCierre, bolsillosAl, diaVecino, hoyEnChile, saldoInicialDe, traspasosEntre } from "@/lib/finanzas";
import type { Bolsillos, TraspasoConSaldo } from "@/lib/finanzas-comun";

/** Todo lo que muestra Giros y depósitos: cuánta plata hay en cada lugar y el historial. */
export type DatosGiros = {
  bolsillos: Bolsillos | null;
  haySaldoInicial: boolean;
  traspasos: TraspasoConSaldo[];
  /** AAAA-MM-DD en Chile, del momento en que se pidieron los datos. */
  hoy: string;
};

/** Los datos de Giros. Los usan la página (al abrirse) y la consulta que los mantiene al día sin recargar. */
export async function datosGiros(aprId: string): Promise<DatosGiros> {
  const hoy = hoyEnChile();
  const [bolsillos, saldoInicial, todos] = await Promise.all([
    bolsillosAl(aprId, diaVecino(hoy, 1)).catch(() => null),
    saldoInicialDe(aprId),
    traspasosEntre(aprId, "2000-01-01", "2100-01-01"),
  ]);
  const traspasos = todos.slice(0, 300);
  // El saldo del banco al cierre de cada día en que hubo un giro o un depósito.
  const bancos = await bancoAlCierre(aprId, traspasos.map((t) => t.fecha));
  return { bolsillos, haySaldoInicial: saldoInicial !== null, traspasos: traspasos.map((t) => ({ ...t, bancoAlCierre: bancos[t.fecha] ?? null })), hoy };
}
