/** Lo de los subsidios que usa el navegador: meses, vigencia y los datos de la pantalla. */

import type { ReglaSubsidio } from "@/lib/boletas";

const indice = (mes: string) => {
  const [a, m] = mes.split("-").map(Number);
  return a * 12 + m - 1;
};

/** Cuántos meses hay de `a` hasta `b` («AAAA-MM»). */
export const mesesEntre = (a: string, b: string) => indice(b) - indice(a);

export function sumarMeses(mes: string, n: number) {
  const t = indice(mes) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export type EstadoSubsidio = "futuro" | "vigente" | "porVencer" | "vencido";

/** Cómo está un subsidio visto desde un mes. «Por vencer»: termina ese mes o el siguiente. */
export function estadoSubsidio(s: { desde: string; hasta: string | null }, mes: string): EstadoSubsidio {
  if (mes < s.desde) return "futuro";
  if (!s.hasta) return "vigente";
  if (s.hasta < mes) return "vencido";
  return mesesEntre(mes, s.hasta) <= 1 ? "porVencer" : "vigente";
}

export type Beneficiario = ReglaSubsidio & {
  id: string;
  socioId: string;
  nombre: string;
  rut: string | null;
  numeroCliente: string | null;
  desde: string;
  hasta: string | null;
  decreto: string | null;
  /** Su boleta del mes: lo que se subsidia (o se subsidiará al aplicar) y lo que paga. Null si no tiene. */
  boleta: { consumoM3: number | null; subsidio: number; paga: number } | null;
  /** Boletas vencidas sin pagar: con deuda se puede perder el beneficio. */
  vencidas: number;
};

export type SocioSubsidiable = {
  id: string;
  nombre: string;
  rut: string | null;
  numeroCliente: string | null;
  /** m³ al mes de sus últimas boletas; null si aún no tiene consumo. */
  promedio: number | null;
  cargoFijo: number | null;
  valorM3: number | null;
};
