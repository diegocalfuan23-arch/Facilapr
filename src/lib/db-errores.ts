/**
 * Postgres avisa con un código cuando falta una tabla (42P01) o una columna (42703). Drizzle envuelve
 * el error original, así que se mira también su `cause`.
 */
function codigoPg(e: unknown): string | null {
  const directo = (e as { code?: unknown } | null)?.code;
  if (typeof directo === "string") return directo;
  const causa = (e as { cause?: { code?: unknown } } | null)?.cause?.code;
  return typeof causa === "string" ? causa : null;
}

/** true si el error es porque la base de datos no tiene todavía una tabla o columna que el código espera. */
export function faltaEsquema(e: unknown): boolean {
  const c = codigoPg(e);
  return c === "42P01" || c === "42703";
}

/**
 * El mensaje que se le muestra a quien usa el panel cuando algo no se pudo guardar. Si la causa es
 * que falta actualizar la base de datos, lo dice claro en vez de pedir «inténtalo de nuevo».
 */
export function mensajeError(e: unknown, generico: string): string {
  return faltaEsquema(e) ? "Falta actualizar la base de datos para usar esta sección. Avisa a soporte." : generico;
}
