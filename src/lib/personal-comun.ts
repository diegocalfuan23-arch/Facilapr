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
  activo: boolean;
  notas: string | null;
  /** Lo que ya se le pagó por el mes que se está mirando. */
  pagadoMes: number;
};

export type PagoTrabajadorFila = {
  id: string;
  trabajadorId: string;
  trabajador: string;
  periodo: string;
  fecha: string;
  monto: number;
  medio: string;
  nota: string | null;
};

/** El concepto con que el pago queda en Caja: así se reconoce que viene de Personal. */
export const PREFIJO_CONCEPTO_PERSONAL = "Personal · ";
