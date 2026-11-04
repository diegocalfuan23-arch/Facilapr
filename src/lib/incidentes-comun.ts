/** Lo de Incidentes que también usa el navegador: tipos y textos, sin tocar la base de datos. */

export type EstadoIncidente = "ABIERTO" | "EN_REPARACION" | "RESUELTO";
export type PrioridadIncidente = "BAJA" | "MEDIA" | "ALTA";

export const TEXTO_ESTADO_INCIDENTE: Record<EstadoIncidente, string> = {
  ABIERTO: "Abierto",
  EN_REPARACION: "En reparación",
  RESUELTO: "Resuelto",
};

export const TEXTO_PRIORIDAD: Record<PrioridadIncidente, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
};

export const TIPOS_INCIDENTE = [
  { valor: "FUGA", texto: "Fuga o rotura de matriz" },
  { valor: "BOMBA", texto: "Falla de bomba o motor" },
  { valor: "TURBIEDAD", texto: "Agua turbia o con mal olor" },
  { valor: "PRESION", texto: "Sin agua o baja presión" },
  { valor: "ELECTRICO", texto: "Corte de luz o falla eléctrica" },
  { valor: "OTRO", texto: "Otro" },
] as const;

export const textoTipoIncidente = (valor: string) => TIPOS_INCIDENTE.find((t) => t.valor === valor)?.texto ?? "Otro";

export type IncidenteFila = {
  id: string;
  numero: number;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  lugar: string | null;
  prioridad: PrioridadIncidente;
  estado: EstadoIncidente;
  fecha: string;
  fechaResolucion: string | null;
  responsable: string | null;
  solucion: string | null;
  costo: number;
  /** true si el costo ya quedó como egreso en la Caja. */
  costoEnCaja: boolean;
};

/** El concepto con que el costo queda en Caja: así se reconoce que viene de Incidentes. */
export const PREFIJO_CONCEPTO_INCIDENTE = "Incidente I-";
