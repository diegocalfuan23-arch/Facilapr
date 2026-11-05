/** Lo de Personal que también usa el navegador: tipos y textos, sin tocar la base de datos. */

export type Contrato = "SUELDO" | "HONORARIO";

export const TEXTO_CONTRATO: Record<Contrato, string> = {
  SUELDO: "Sueldo",
  HONORARIO: "Honorarios",
};

export const CARGOS_SUGERIDOS = ["Operador", "Tesorero", "Administrativo", "Presidente", "Secretario", "Gasfíter", "Otro"];

/** Con qué rol entra al panel quien tiene cuenta (o «DESACTIVADO» si la directiva le quitó el acceso). */
export type AccesoPanel = "ADMIN" | "OPERADOR" | "TESORERO" | "DESACTIVADO";

export const TEXTO_ACCESO: Record<AccesoPanel, string> = {
  ADMIN: "Administrador",
  OPERADOR: "Operador",
  TESORERO: "Tesorero",
  DESACTIVADO: "Acceso quitado",
};

/** Una persona con cuenta en el panel del comité. */
export type CuentaPanel = { nombre: string; email: string; acceso: AccesoPanel };

export type TrabajadorFila = {
  id: string;
  nombre: string;
  rut: string | null;
  cargo: string;
  telefono: string | null;
  email: string | null;
  contrato: Contrato;
  sueldo: number;
  /** Lo que vale un día de esta persona; null = el sueldo dividido en 30. */
  valorDia: number | null;
  /** Cobra por los días que trabaja, no un sueldo mensual. */
  porDia: boolean;
  /** Horas de la jornada por semana. */
  jornadaSemanal: number;
  /** Días que trabaja a la semana. */
  diasSemana: number;
  /** Lo que se le paga por hora extra; null = la hora ordinaria más el recargo legal. */
  valorHoraExtra: number | null;
  fechaIngreso: string | null;
  afp: string | null;
  /** Centésimas de %: 1058 = 10,58 %. */
  afpTasa: number;
  /** Centésimas de %: 700 = 7 %. */
  saludTasa: number;
  cesantia: boolean;
  activo: boolean;
  notas: string | null;
};

/** Las AFP con lo que cobran de comisión (centésimas de %). Cambian: conviene confirmarlas cada tanto. */
export const AFPS = [
  { nombre: "Capital", comision: 144 },
  { nombre: "Cuprum", comision: 144 },
  { nombre: "Habitat", comision: 127 },
  { nombre: "Modelo", comision: 58 },
  { nombre: "PlanVital", comision: 116 },
  { nombre: "Provida", comision: 145 },
  { nombre: "Uno", comision: 49 },
] as const;

/** La cotización obligatoria a la AFP (10 %) más la comisión de esa AFP, en centésimas de %. */
export const tasaAfp = (comision: number) => 1000 + comision;

/** El aporte del trabajador al seguro de cesantía: 0,6 %. */
export const TASA_CESANTIA = 60;

/** La retención de la boleta de honorarios en 2026: 15,25 %. Sube cada año hasta llegar a 17 % en 2028. */
export const TASA_RETENCION_HONORARIOS = 1525;

export type DescuentosLegales = { afp: number; salud: number; cesantia: number; retencion: number; total: number };

/**
 * Lo que se descuenta por ley de un sueldo bruto: a quien está a sueldo, AFP, salud y seguro de
 * cesantía; a quien está a honorarios, la retención de la boleta. Cada monto se redondea al peso.
 * Es una estimación: no aplica el tope imponible ni impuesto único.
 */
export function descuentosLegales(
  persona: Pick<TrabajadorFila, "contrato" | "afpTasa" | "saludTasa" | "cesantia">,
  bruto: number
): DescuentosLegales {
  if (persona.contrato === "HONORARIO") {
    const retencion = Math.round((bruto * TASA_RETENCION_HONORARIOS) / 10000);
    return { afp: 0, salud: 0, cesantia: 0, retencion, total: retencion };
  }
  const afp = Math.round((bruto * persona.afpTasa) / 10000);
  const salud = Math.round((bruto * persona.saludTasa) / 10000);
  const cesantia = persona.cesantia ? Math.round((bruto * TASA_CESANTIA) / 10000) : 0;
  return { afp, salud, cesantia, retencion: 0, total: afp + salud + cesantia };
}

/** El texto de un porcentaje guardado en centésimas: 1058 → «10,58 %». */
export const textoTasa = (centesimas: number) => `${(centesimas / 100).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;

/** La jornada semanal que se propone: 42 horas desde el 26 de abril de 2026 (Ley 21.561); 44 antes. */
export const JORNADA_SEMANAL_LEGAL = 42;

/** El recargo legal de la hora extra: 50 % sobre la hora ordinaria. */
export const RECARGO_HORA_EXTRA = 0.5;

export type DatosJornada = Pick<TrabajadorFila, "sueldo" | "valorDia" | "porDia" | "jornadaSemanal" | "diasSemana" | "valorHoraExtra">;

/** Cuántas horas dura el día de trabajo de una persona: la jornada de la semana repartida en sus días. */
export const horasPorDia = (j: Pick<DatosJornada, "jornadaSemanal" | "diasSemana">) => (j.jornadaSemanal > 0 && j.diasSemana > 0 ? j.jornadaSemanal / j.diasSemana : 8);

/**
 * Lo que vale una hora ordinaria. Con sueldo mensual se usa la fórmula de la Dirección del Trabajo: el sueldo
 * diario (mensual ÷ 30) por 7 días, repartido en las horas de la semana. A quien cobra por día, su valor del día
 * repartido en las horas de su día.
 */
export function valorHoraOrdinaria(j: DatosJornada): number {
  if (j.porDia) return horasPorDia(j) > 0 ? (j.valorDia ?? 0) / horasPorDia(j) : 0;
  return j.jornadaSemanal > 0 ? (j.sueldo * 7) / (30 * j.jornadaSemanal) : 0;
}

/** Lo que se paga por una hora extra: el valor fijado en la ficha o, si no hay, la hora ordinaria con el 50 % de recargo. */
export function valorDeHoraExtra(j: DatosJornada): number {
  return j.valorHoraExtra && j.valorHoraExtra > 0 ? j.valorHoraExtra : Math.round(valorHoraOrdinaria(j) * (1 + RECARGO_HORA_EXTRA));
}
