/** Lo de los archivos del chat que también usa el navegador. */

/** Lo máximo que se sube desde la app: la petición no puede pasar de 4 MB. */
export const ADJUNTO_MAX_BYTES = 3 * 1024 * 1024;

export const ADJUNTO_ACEPTA = "application/pdf,image/png,image/jpeg,image/webp,.docx,.xlsx";

export type Adjunto = {
  nombre: string;
  tipo: string;
  /** Null en los documentos que genera Facilapr (boletas y comprobantes). */
  tamano: number | null;
  url: string;
};

/** El texto que se guarda cuando el archivo va sin mensaje. */
export const textoDeAdjunto = (nombre: string) => `📎 ${nombre}`;
