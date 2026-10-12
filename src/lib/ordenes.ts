/** Textos y reglas compartidas de las órdenes en terreno (sin base de datos: sirve también en el navegador). */

/** Trabajo en terreno: lo hace alguien con foto de respaldo. */
export type TipoCampo = "CORTE" | "REPOSICION" | "REPARACION";
/** Todo lo que se puede pedir o registrar: además de terreno, lo que sale del socio y se resuelve en oficina. */
export type TipoOrden = TipoCampo | "RECLAMO" | "BAJA" | "REANUDACION";
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
  RECLAMO: { texto: "Reclamo", ejecucion: "" },
  BAJA: { texto: "Baja del servicio", ejecucion: "" },
  REANUDACION: { texto: "Reanudación del servicio", ejecucion: "" },
};

/** Lo que un socio puede pedir desde su portal. */
export const TIPOS_SOCIO: TipoOrden[] = ["RECLAMO", "REPOSICION", "REPARACION", "BAJA", "REANUDACION"];

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
