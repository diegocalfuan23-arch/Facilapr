/** Dónde se guarda en el navegador de dónde llegó la persona (la primera vez que abrió el sitio). */
export const CLAVE_ORIGEN = "fl_origen";

/** El origen guardado, o vacío si no hay (o si el navegador no deja leerlo). */
export function origenGuardado(): string {
  try {
    return localStorage.getItem(CLAVE_ORIGEN) ?? "";
  } catch {
    return "";
  }
}
