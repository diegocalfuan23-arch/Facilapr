/** Lo de Personal que también usa el navegador: tipos y textos, sin tocar la base de datos. */

export type Contrato = "SUELDO" | "HONORARIO";

export const TEXTO_CONTRATO: Record<Contrato, string> = {
  SUELDO: "Sueldo",
  HONORARIO: "Honorarios",
};

export const CARGOS_SUGERIDOS = ["Operador", "Tesorero", "Administrativo", "Presidente", "Secretario", "Gasfíter", "Otro"];

export type TrabajadorFila = {
  id: string;
  nombre: string;
  rut: string | null;
  cargo: string;
  telefono: string | null;
  email: string | null;
  contrato: Contrato;
  sueldo: number;
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
