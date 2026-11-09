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
  { valor: "ROBO", texto: "Robo de un bien" },
  { valor: "EXTRAVIO", texto: "Extravío de un bien" },
  { valor: "DANO", texto: "Rotura o daño de un bien" },
  { valor: "OTRO", texto: "Otro" },
] as const;

/** Los tipos que afectan a un bien del comité: piden el bien y su valor. */
export const TIPOS_DE_BIEN = ["ROBO", "EXTRAVIO", "DANO"];
export const afectaUnBien = (tipo: string) => TIPOS_DE_BIEN.includes(tipo);

/** Un bien de Activos que se puede elegir al registrar un robo, extravío o daño. */
export type ActivoAfectable = { id: string; nombre: string; valorLibro: number };

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
  /** Robo, extravío o daño: el activo afectado y lo que valía (pérdida, no es un egreso de Caja). */
  activoId: string | null;
  activoNombre: string | null;
  valorPerdido: number;
};

/** El concepto con que el costo queda en Caja: así se reconoce que viene de Incidentes. */
export const PREFIJO_CONCEPTO_INCIDENTE = "Incidente I-";
