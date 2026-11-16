import { Clock3, FileText, HeartPulse, Palmtree, type LucideIcon } from "lucide-react";
import type { AusenciaFila } from "@/lib/rrhh-comun";

/** Cómo se ve cada clase de ausencia: vacaciones, permiso con o sin goce, y licencia. */
export type ClaseAusencia = "VACACIONES" | "CON_GOCE" | "SIN_GOCE" | "LICENCIA";

export const CLASES: Record<ClaseAusencia, { texto: string; color: string; suave: string; tinte: string; desc: string; icono: LucideIcon }> = {
  VACACIONES: { texto: "Vacaciones", color: "bg-[#2FB386]", suave: "bg-[#E6F6EF]", tinte: "text-[#075A3C]", desc: "Descuenta del saldo", icono: Palmtree },
  CON_GOCE: { texto: "Permiso con goce", color: "bg-[#6B46F5]", suave: "bg-[#ECE8FD]", tinte: "text-[#2A07A8]", desc: "No descuenta sueldo ni saldo", icono: FileText },
  SIN_GOCE: { texto: "Permiso sin goce", color: "bg-[#F0A23C]", suave: "bg-[#FFF3E0]", tinte: "text-[#8A4B00]", desc: "Se descuenta en Remuneraciones", icono: Clock3 },
  LICENCIA: { texto: "Licencia médica", color: "bg-[#0B8BD3]", suave: "bg-[#E3F3FD]", tinte: "text-[#0B5E94]", desc: "La paga la isapre o Fonasa", icono: HeartPulse },
};

/** La clase de un registro: un permiso es con o sin goce según se guardó. */
export const claseDe = (a: Pick<AusenciaFila, "tipo" | "sinGoce">): ClaseAusencia => (a.tipo === "PERMISO" ? (a.sinGoce ? "SIN_GOCE" : "CON_GOCE") : a.tipo);

export type SaldoVacaciones = {
  id: string;
  nombre: string;
  ganados: number | null;
  tomados: number;
  saldo: number | null;
  /** AAAA-MM-DD: desde cuándo podrá tomar vacaciones, si aún no cumple su primer año. */
  desde: string | null;
  /** El saldo partido: 15 del período en curso, lo que viene de años anteriores y lo usado en este período. */
  delAnio: number | null;
  acumulados: number | null;
  usadosPeriodo: number | null;
};

/** Las ausencias aprobadas de otras personas que coinciden con las fechas de una (para avisar que se cruzan). */
export function cruces(a: Pick<AusenciaFila, "id" | "trabajadorId" | "desde" | "hasta">, todas: AusenciaFila[]) {
  return todas.filter((o) => o.id !== a.id && o.trabajadorId !== a.trabajadorId && o.estado === "APROBADA" && o.desde <= a.hasta && o.hasta >= a.desde);
}
