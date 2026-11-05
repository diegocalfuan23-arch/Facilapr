import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Mapea el subdominio de cada comité a su portal de socios.
 *
 *   pitrelahue.facilapr.cl/              → /cuenta/entrar (la entrada al portal)
 *   pitrelahue.facilapr.cl/cuenta/entrar → /socio/pitrelahue/entrar
 *   pitrelahue.facilapr.cl/cuenta        → /socio/pitrelahue/panel
 *   facilapr.cl/pitrelahue/cuenta/entrar → /socio/pitrelahue/entrar
 *   (/socio/... sigue funcionando en el subdominio por los enlaces ya enviados)
 *
 * El dominio raíz y www siguen sirviendo la app normal.
 */

const DOMINIO_RAIZ = process.env.NEXT_PUBLIC_DOMINIO_RAIZ ?? "facilapr.cl";

/** Hosts que sirven la app, no el portal de un comité. */
const HOSTS_APP = new Set([
  DOMINIO_RAIZ,
  `www.${DOMINIO_RAIZ}`,
  "localhost",
]);

/**
 * El nombre anterior del producto (FacilAgua). Cualquier visita ahí, en
 * cualquier ruta, redirige 301 al dominio actual: nunca sirve la app, para
 * no partir en dos el SEO ni dejar visitas viejas en un dominio muerto.
 */
const DOMINIOS_ANTIGUOS = new Set(["facilagua.com", "www.facilagua.com"]);

/**
 * Rutas del portal de socios con direcciones limpias. "/cuenta" (sin nada
 * más) es el panel; el resto del camino se conserva (entrar, solicitar,
 * recibo/<id>). Las páginas viven en /socio/[slug]/..., pero esa carpeta es un
 * detalle interno: nadie la ve en la barra de direcciones.
 */
function rutaDeCuenta(slug: string, resto: string) {
  const camino = resto.replace(/^\/+/, "");
  return `/socio/${slug}/${camino === "" ? "panel" : camino}`;
}

/** facilapr.cl/<slug>/cuenta/...  (dominio raíz, localhost y previews, sin subdominio). */
const CUENTA_EN_RAIZ = /^\/([a-z0-9][a-z0-9-]{1,39})\/cuenta(\/.*)?$/;

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "")
    .toLowerCase()
    .split(":")[0]; // fuera el puerto

  if (DOMINIOS_ANTIGUOS.has(host)) {
    const destino = request.nextUrl.clone();
    destino.protocol = "https";
    destino.host = DOMINIO_RAIZ;
    destino.port = "";
    return NextResponse.redirect(destino, 301);
  }

  const sirveLaApp =
    !host || HOSTS_APP.has(host) || host.endsWith(".vercel.app");

  if (sirveLaApp) {
    const enRaiz = request.nextUrl.pathname.match(CUENTA_EN_RAIZ);
    if (!enRaiz) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = rutaDeCuenta(enRaiz[1], enRaiz[2] ?? "");
    return NextResponse.rewrite(url);
  }

  if (host.endsWith(`.${DOMINIO_RAIZ}`)) {
    const slug = host.slice(0, -(DOMINIO_RAIZ.length + 1));
    // Solo el primer nivel: "a.b.facilapr.cl" no es un comité válido.
    if (!slug || slug.includes(".")) return NextResponse.next();

    const url = request.nextUrl.clone();

    if (url.pathname === "/cuenta" || url.pathname.startsWith("/cuenta/")) {
      url.pathname = rutaDeCuenta(slug, url.pathname.slice("/cuenta".length));
      return NextResponse.rewrite(url);
    }

    if (url.pathname.startsWith("/socio")) {
      url.pathname = `/socio/${slug}${url.pathname.slice("/socio".length)}`;
      return NextResponse.rewrite(url);
    }

    // La portada de un comité es la entrada a su portal de socios.
    if (url.pathname === "/") {
      url.pathname = "/cuenta/entrar";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Excluimos estáticos, imágenes y las rutas internas de la app: si el proxy
  // las tocara, un subdominio no podría cargar su propio CSS.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.).*)",
  ],
};
