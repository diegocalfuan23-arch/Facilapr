/**
 * URL canónica del sitio. Sale del entorno porque facilapr.cl se sirve sin www
 * (www.facilapr.cl redirige al dominio raíz): así los datos estructurados y los
 * enlaces apuntan siempre a la variante correcta.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.BETTER_AUTH_URL ??
  "https://facilapr.cl"
).replace(/\/$/, "");
