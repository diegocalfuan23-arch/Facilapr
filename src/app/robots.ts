import type { MetadataRoute } from "next";

/**
 * URL canónica del sitio. Sale del entorno porque facilapr.cl se sirve sin
 * www (www.facilapr.cl redirige al dominio raíz): si aquí quedara la
 * variante equivocada, Google indexaría una URL que redirige y se diluiría
 * el posicionamiento entre las dos variantes.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.BETTER_AUTH_URL ??
  "https://facilapr.cl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // El panel y la API son privados: no aporta nada indexarlos.
      // /registro sí queda permitido a propósito: es la página real donde
      // un comité crea su cuenta, es contenido de conversión, no privado.
      //
      // /login, /register, /superadmin-login y /admin* no existen en esta
      // app (grep confirmado) pero Google los tiene indexados: son rutas
      // del sistema anterior que corría en este dominio desde un droplet ya
      // eliminado. Se bloquean igual por si acaso, aunque el arreglo real
      // es pedir su retiro en Search Console — un disallow no borra lo ya
      // indexado, solo evita que se re-rastree.
      disallow: [
        "/panel/",
        "/api/",
        "/pagar/",
        "/login",
        "/register",
        "/superadmin-login",
        "/admin/",
        "/olvide-clave",
        "/reset-password",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
