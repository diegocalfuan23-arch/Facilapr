import { requireAdmin } from "@/lib/apr-session";
import { mpConfigurado, urlAutorizacion } from "@/lib/mercadopago";

/** Manda a la directiva a Mercado Pago para que autorice a Facilapr a cobrar en su cuenta. */
export async function GET() {
  const { apr } = await requireAdmin();
  if (!apr.mercadoPagoHabilitado || !mpConfigurado()) {
    return Response.redirect(new URL("/panel/configuracion?mp=no-disponible", process.env.NEXT_PUBLIC_SITE_URL ?? "https://facilapr.cl"), 303);
  }
  return Response.redirect(urlAutorizacion(apr.id), 302);
}
