import { requireAdmin } from "@/lib/apr-session";
import { COOKIE_PKCE, cifrar, generarPkce, mpConfigurado, urlAutorizacion } from "@/lib/mercadopago";

/** Manda a la directiva a Mercado Pago para que autorice a Facilapr a cobrar en su cuenta. */
export async function GET() {
  const { apr } = await requireAdmin();
  if (!apr.mercadoPagoHabilitado || !mpConfigurado()) {
    return Response.redirect(new URL("/panel/pagos?mp=no-disponible", process.env.NEXT_PUBLIC_SITE_URL ?? "https://facilapr.cl"), 303);
  }
  const { verifier, challenge } = generarPkce();
  // El verifier queda en una cookie cifrada que solo el servidor puede leer; vuelve con el retorno de Mercado Pago.
  const cookie = `${COOKIE_PKCE}=${encodeURIComponent(cifrar(verifier))}; Path=/api/mercadopago; Max-Age=600; HttpOnly; Secure; SameSite=Lax`;
  return new Response(null, {
    status: 302,
    headers: { Location: urlAutorizacion(apr.id, challenge), "Set-Cookie": cookie },
  });
}
