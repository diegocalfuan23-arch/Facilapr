/**
 * Postgres avisa con un código cuando falta una tabla (42P01) o una columna (42703). Drizzle envuelve
 * el error original, así que se mira también su `cause`.
 */
export function codigoPg(e: unknown): string | null {
  const directo = (e as { code?: unknown } | null)?.code;
  if (typeof directo === "string") return directo;
  const causa = (e as { cause?: { code?: unknown } } | null)?.cause?.code;
  return typeof causa === "string" ? causa : null;
}

/**
 * Todo lo que dice un error de la base de datos, junto: Drizzle envuelve el error original y el nombre de la restricción
 * que falló (por ejemplo «Socio_apr_tipo_numero_key») viene en `cause`, no en el mensaje de arriba.
 */
export function textoErrorPg(e: unknown): string {
  const causa = (e as { cause?: { message?: unknown; constraint?: unknown; detail?: unknown } } | null)?.cause;
  return [(e as { message?: unknown } | null)?.message, causa?.message, causa?.constraint, causa?.detail].filter((x): x is string => typeof x === "string").join(" · ");
}

/** El nombre de la restricción que falló (una clave única, por ejemplo), si el error la trae. */
export function restriccionPg(e: unknown): string | null {
  const r = (e as { constraint?: unknown; cause?: { constraint?: unknown } } | null)?.constraint ?? (e as { cause?: { constraint?: unknown } } | null)?.cause?.constraint;
  return typeof r === "string" ? r : null;
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
