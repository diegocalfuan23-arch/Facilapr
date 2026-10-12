/** Textos y reglas compartidas de las órdenes en terreno (sin base de datos: sirve también en el navegador). */

export type TipoOrden = "CORTE" | "REPOSICION" | "REPARACION";
export type EstadoOrden =
  | "SOLICITADA"
  | "EN_TRAMITE"
  | "POR_CONFIRMAR"
  | "COMPLETADA"
  | "RECHAZADA"
  | "CANCELADA";

export const TIPOS_ORDEN: Record<TipoOrden, { texto: string; ejecucion: string }> = {
  CORTE: { texto: "Corte", ejecucion: "Foto del medidor con el servicio cortado" },
  REPOSICION: { texto: "Reposición", ejecucion: "Foto del medidor con el servicio repuesto" },
  REPARACION: { texto: "Reparación", ejecucion: "Foto de la reparación hecha" },
};

export const ESTADOS_ORDEN: Record<EstadoOrden, string> = {
  SOLICITADA: "Solicitada",
  EN_TRAMITE: "En trámite",
  POR_CONFIRMAR: "Por dar de alta",
  COMPLETADA: "Completada",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
};

/** Tamaño máximo de la foto en base64 (≈ 700 KB). La app la comprime antes de enviarla. */
export const MAX_FOTO_BASE64 = 950_000;
