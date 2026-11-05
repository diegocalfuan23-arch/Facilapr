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
};
