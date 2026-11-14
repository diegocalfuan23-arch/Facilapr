/** Una conversación de la lista de Conversaciones: lo que hace falta para pintarla. Sin base de datos: lo usa el navegador. */
export type ConversacionResumen = {
  socioId: string;
  nombre: string;
  ultimoMensaje: string;
  ultimaFecha: Date | null;
  sinLeer: number;
  /** La IA le pasó la conversación a una persona y nadie ha respondido. */
  necesitaHumano: boolean;
  rut: string | null;
  numeroCliente: string | null;
  tipo: "SOCIO" | "USUARIO";
  telefono: string | null;
  /** Lo que debe en total (CLP); 0 si está al día. */
  deuda: number;
  /** La IA está pausada solo en esta conversación. */
  iaPausada: boolean;
};
