/** Lo del catastro de arranques que no toca la base de datos: tipos y textos. Lo usan pantallas del navegador. */

export type EstadoArranque = "CORTADO" | "INACTIVO" | "MOROSO" | "AL_DIA";

export const TEXTO_ESTADO_ARRANQUE: Record<EstadoArranque, string> = {
  CORTADO: "Cortado",
  INACTIVO: "Inactivo",
  MOROSO: "Con deuda vencida",
  AL_DIA: "Al día",
};

export type ArranqueFila = {
  id: string;
  /** El N.º de cliente o de arranque, si el comité lo lleva. */
  numero: string | null;
  nombre: string;
  rut: string | null;
  direccion: string | null;
  tipo: "SOCIO" | "USUARIO";
  uso: "RESIDENCIAL" | "COMERCIAL";
  estado: EstadoArranque;
  /** Lo que debe en boletas impagas, en pesos. */
  deuda: number;
  boletasVencidas: number;
  /** La lectura del medidor más reciente (aprobada, o la de su última boleta). */
  ultimaLectura: { valor: number; periodo: string } | null;
  /** El consumo de su última boleta. */
  ultimoConsumo: { m3: number; periodo: string } | null;
};
