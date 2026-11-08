import { esFeriado } from "@/lib/feriados";
/** Lo de RR.HH. que también usa el navegador: tipos, textos y cálculos de días, vacaciones y líquido. */

/** PENDIENTE = por revisar; LISTA = revisada, lista para pagar; PAGADA = ya está en la Caja. */
export type EstadoRemuneracion = "PENDIENTE" | "LISTA" | "PAGADA";

/** Una cuota de anticipo o préstamo descontada en una liquidación. */
export type CuotaPrestamoLinea = { concepto: string; monto: number };

/** Lo que pasó en el mes con una persona, según la asistencia y sus ausencias aprobadas. */
export type ResumenAusenciasMes = {
  faltas: number;
  licencia: number;
  permisoSinGoce: number;
  /** Las vacaciones se pagan: se muestran, pero no se descuentan. */
  vacaciones: number;
  /** Los días que no se pagan: faltas, licencia y permiso sin goce (máximo 30). */
  descontables: number;
  /** Los días con asistencia marcada (presente o con atraso): lo que se paga a quien cobra por día. */
  trabajados: number;
  /** Las horas de permisos por horas sin goce, aprobados este mes. Se descuentan como parte de un día. */
  horasPermisoSinGoce: number;
  /** Las horas extras que se registraron en Asistencia este mes. */
  horasExtra: number;
};

export const SIN_AUSENCIAS: ResumenAusenciasMes = { faltas: 0, licencia: 0, permisoSinGoce: 0, vacaciones: 0, descontables: 0, trabajados: 0, horasPermisoSinGoce: 0, horasExtra: 0 };

/** Lo que vale un día de una persona: el valor fijado en su ficha o, si no hay, un treintavo del sueldo. */
export const valorDelDia = (sueldo: number, valorDia: number | null | undefined) => (valorDia && valorDia > 0 ? valorDia : Math.round(sueldo / 30));

/** Las horas de un día si no se sabe la jornada de la persona. */
export const JORNADA_HORAS = 8;

/** Lo que se descuenta por días y horas no pagados: el valor del día por cada día, y una parte de él por cada hora (hasta 30 días). */
export const descuentoPorDias = (sueldo: number, dias: number, valorDia?: number | null, horas = 0, horasDia = JORNADA_HORAS) =>
  Math.round(valorDelDia(sueldo, valorDia) * Math.min(Math.max(dias, 0) + Math.max(horas, 0) / (horasDia > 0 ? horasDia : JORNADA_HORAS), 30));

export type RemuneracionFila = {
  id: string;
  trabajadorId: string;
  trabajador: string;
  cargo: string;
  periodo: string;
  sueldoBase: number;
  /** Lo fijado en la ficha de la persona; null si usa el sueldo dividido en 30. */
  valorDiaFicha: number | null;
  /** Se le paga por día trabajado: el sueldo base del mes sale de los días por el valor del día. */
  porDia: boolean;
  /** La jornada de la persona: sirve para calcular el valor de la hora y de la hora extra. */
  jornadaSemanal: number;
  diasSemana: number;
  valorHoraExtraFicha: number | null;
  diasDescontados: number;
  descAusencias: number;
  /** Horas de permiso sin goce descontadas en esta liquidación. */
  horasDescontadas: number;
  /** Horas extras del mes y lo que se paga por ellas. */
  horasExtra: number;
  montoHorasExtra: number;
  /** Colación y movilización: se suman al líquido sin pasar por los descuentos. */
  noImponible: number;
  /** Lo registrado este mes en asistencia y ausencias, para sugerir los días a descontar. */
  ausenciasMes: ResumenAusenciasMes;
  bonos: number;
  descAfp: number;
  descSalud: number;
  descCesantia: number;
  retencion: number;
  /** Cuotas de anticipos y préstamos que van dentro de «otrosDescuentos». */
  cuotasPrestamo: CuotaPrestamoLinea[];
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

/**
 * Si lo que dice hoy Asistencia (días, permisos, horas extras) no coincide con lo que se cargó en una liquidación
 * que aún no se paga, devuelve un texto con la diferencia; si coincide (o ya está pagada), null.
 */
export function desfaseConAsistencia(f: RemuneracionFila): string | null {
  if (f.estado === "PAGADA") return null;
  const a = f.ausenciasMes;
  const cambios: string[] = [];
  if (f.porDia) {
    const dias = f.valorDiaFicha ? Math.round(f.sueldoBase / f.valorDiaFicha) : null;
    if (dias !== null && dias !== a.trabajados) cambios.push(`días trabajados (${dias} → ${a.trabajados})`);
  } else if (f.diasDescontados !== a.descontables) {
    cambios.push(`días no pagados (${f.diasDescontados} → ${a.descontables})`);
  }
  if (Math.abs(f.horasDescontadas - a.horasPermisoSinGoce) > 0.01) cambios.push(`horas de permiso (${f.horasDescontadas} → ${a.horasPermisoSinGoce})`);
  if (Math.abs(f.horasExtra - a.horasExtra) > 0.01) cambios.push(`horas extras (${f.horasExtra} → ${a.horasExtra})`);
  return cambios.length ? `Asistencia y permisos tienen otros datos: ${cambios.join(", ")}.` : null;
}

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
  /** Solo en un permiso: sin goce de sueldo. */
  sinGoce: boolean;
  /** Solo en un permiso por horas: cuántas. Null si es por días. */
  horas: number | null;
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
  /** Las horas extras de ese día (0 si no hubo). */
  horasExtra: number;
  /** HH:MM: a qué hora llegó, si se anotó. */
  horaLlegada: string | null;
};

const aFecha = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};

/** Los días hábiles (lunes a viernes, sin feriados nacionales) entre dos fechas, ambas incluidas. */
export function diasHabiles(desde: string, hasta: string): number {
  const fin = aFecha(hasta).getTime();
  let n = 0;
  for (let t = aFecha(desde).getTime(); t <= fin; t += 86_400_000) {
    const dia = new Date(t).getUTCDay();
    if (dia !== 0 && dia !== 6 && !esFeriado(new Date(t).toISOString().slice(0, 10))) n++;
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

// ---------------------------------------------------------------- horario laboral y calendario

/** Un día que no es laboral: un feriado (nacional o local) o un día sin operación del comité. */
export type DiaEspecial = {
  /** AAAA-MM-DD */
  fecha: string;
  tipo: "FERIADO" | "SIN_OPERACION";
  nombre: string;
  /** true: viene del código (feriados nacionales) y no se edita. */
  nacional?: boolean;
};

/** Los días de la semana (0 = domingo … 6 = sábado) en que trabaja quien no tiene un horario cargado. */
export const HORARIO_POR_DEFECTO = [1, 2, 3, 4, 5];

/** El texto corto de unos días de la semana: «Lun a Vie», «Lun, Mié y Vie»… */
export function resumenDias(dias: number[]) {
  const orden = [1, 2, 3, 4, 5, 6, 0];
  const corto = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const o = orden.filter((d) => dias.includes(d));
  if (!o.length) return "Ningún día";
  if (o.length === 7) return "Todos los días";
  const seguidos = o.every((d, i) => i === 0 || orden.indexOf(d) === orden.indexOf(o[i - 1]) + 1);
  return o.length > 2 && seguidos ? `${corto[o[0]]} a ${corto[o[o.length - 1]]}` : o.map((d) => corto[d]).join(", ");
}

/** A qué hora abre y cierra el comité un día (HH:MM). */
export type TramoComite = { abre: string; cierra: string };

/** El horario del comité por día de la semana (0 = domingo … 6 = sábado); null = cerrado ese día. */
export type HorarioComite = Record<number, TramoComite | null>;

/** Los minutos que tolera el comité antes de contar un atraso, si no eligió otro valor. */
export const TOLERANCIA_POR_DEFECTO = 10;

/** Los minutos desde la medianoche de una hora HH:MM. */
export const aMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

/** Cuánto dura un tramo, en texto: «9 h», «4 h 30 min». Vacío si el cierre no es posterior a la apertura. */
export function duracionTramo(t: TramoComite) {
  const m = aMinutos(t.cierra) - aMinutos(t.abre);
  if (!(m > 0)) return "";
  return `${Math.floor(m / 60)}${m % 60 ? ` h ${m % 60} min` : " h"}`;
}

/** Un horario de persona: los días en que trabaja y, si la tiene, su hora de ingreso. */
export type HorarioPersona = { dias: number[]; ingreso: string | null };
