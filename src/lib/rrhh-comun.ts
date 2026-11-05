/** Lo de RR.HH. que también usa el navegador: tipos, textos y cálculos de días, vacaciones y líquido. */

export type EstadoRemuneracion = "PENDIENTE" | "PAGADA";

export type RemuneracionFila = {
  id: string;
  trabajadorId: string;
  trabajador: string;
  cargo: string;
  periodo: string;
  sueldoBase: number;
  bonos: number;
  descAfp: number;
  descSalud: number;
  descCesantia: number;
  retencion: number;
  otrosDescuentos: number;
  /** La suma de todo lo que se descuenta. */
  descuentos: number;
  liquido: number;
  /** Cómo está pagada la persona y qué tasas tiene: sirve para recalcular los descuentos al editar. */
  contrato: "SUELDO" | "HONORARIO";
  afpTasa: number;
  saludTasa: number;
  cesantiaPaga: boolean;
  estado: EstadoRemuneracion;
  fechaPago: string | null;
  medio: string | null;
  nota: string | null;
};

/** Lo que se le paga a la persona: base más bonos, menos descuentos; nunca menos que cero. */
export const liquidoDe = (base: number, bonos: number, descuentos: number) => Math.max(0, base + bonos - descuentos);

/** El concepto con que el pago de un sueldo queda en Caja: así se reconoce que viene de Remuneraciones. */
export const PREFIJO_CONCEPTO_REMUNERACION = "Remuneración · ";

export type TipoAusencia = "VACACIONES" | "LICENCIA" | "PERMISO";
export type EstadoAusencia = "SOLICITADA" | "APROBADA" | "RECHAZADA";

export const TEXTO_TIPO_AUSENCIA: Record<TipoAusencia, string> = {
  VACACIONES: "Vacaciones",
  LICENCIA: "Licencia médica",
  PERMISO: "Permiso",
};

export const TEXTO_ESTADO_AUSENCIA: Record<EstadoAusencia, string> = {
  SOLICITADA: "Solicitada",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

export type AusenciaFila = {
  id: string;
  trabajadorId: string;
  trabajador: string;
  tipo: TipoAusencia;
  desde: string;
  hasta: string;
  dias: number;
  estado: EstadoAusencia;
  detalle: string | null;
  nota: string | null;
};

export type EstadoAsistencia = "PRESENTE" | "ATRASO" | "AUSENTE" | "PERMISO" | "VACACIONES" | "LICENCIA";

export const TEXTO_ESTADO_ASISTENCIA: Record<EstadoAsistencia, string> = {
  PRESENTE: "Presente",
  ATRASO: "Atraso",
  AUSENTE: "Ausente",
  PERMISO: "Permiso",
  VACACIONES: "Vacaciones",
  LICENCIA: "Licencia",
};

/** Los estados que se marcan a mano; vacaciones y licencia llegan solas desde Ausencias. */
export const ESTADOS_ASISTENCIA_MANUAL: EstadoAsistencia[] = ["PRESENTE", "ATRASO", "AUSENTE", "PERMISO"];

export type AsistenciaDia = {
  trabajadorId: string;
  nombre: string;
  cargo: string;
  estado: EstadoAsistencia | null;
  /** true si el estado viene de una vacación o licencia aprobada, no de una marca manual. */
  automatico: boolean;
  nota: string | null;
};

const aFecha = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};

/** Los días hábiles (lunes a viernes) entre dos fechas, ambas incluidas. No descuenta feriados. */
export function diasHabiles(desde: string, hasta: string): number {
  const fin = aFecha(hasta).getTime();
  let n = 0;
  for (let t = aFecha(desde).getTime(); t <= fin; t += 86_400_000) {
    const dia = new Date(t).getUTCDay();
    if (dia !== 0 && dia !== 6) n++;
  }
  return n;
}

/** Los días corridos entre dos fechas, ambas incluidas. */
export function diasCorridos(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000) + 1;
}

/** Cuántos días de una ausencia cuentan: hábiles para vacaciones y permisos, corridos para licencias. */
export function diasDe(tipo: TipoAusencia, desde: string, hasta: string): number {
  return tipo === "LICENCIA" ? diasCorridos(desde, hasta) : diasHabiles(desde, hasta);
}

/** Días de vacaciones que se ganan por mes trabajado (15 hábiles al año). */
export const DIAS_VACACIONES_POR_MES = 1.25;

/**
 * El saldo de vacaciones: lo ganado desde el ingreso (1,25 días por mes cumplido) menos lo tomado.
 * Sin fecha de ingreso no se puede calcular y devuelve null.
 */
export function saldoVacaciones(fechaIngreso: string | null, tomados: number, hoy: string) {
  if (!fechaIngreso) return null;
  const [ya, ma, da] = fechaIngreso.split("-").map(Number);
  const [yh, mh, dh] = hoy.split("-").map(Number);
  const meses = Math.max(0, (yh - ya) * 12 + (mh - ma) - (dh < da ? 1 : 0));
  const ganados = Math.round(meses * DIAS_VACACIONES_POR_MES * 100) / 100;
  return { ganados, tomados, saldo: Math.round((ganados - tomados) * 100) / 100 };
}
