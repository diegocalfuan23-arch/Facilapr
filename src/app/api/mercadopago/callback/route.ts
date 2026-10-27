import { requireAdmin } from "@/lib/apr-session";
import { conectarCuenta, leerState, mpConfigurado } from "@/lib/mercadopago";

/**
 * A donde Mercado Pago devuelve al comité después de autorizar. El `state` va
 * firmado y trae el comité: se exige que sea el mismo que tiene la sesión
 * abierta, para que nadie pueda conectar su cuenta a nombre de otro comité.
 */
export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  const volver = (resultado: string) => Response.redirect(`${base}/panel/pagos?mp=${resultado}`, 303);

  const { apr } = await requireAdmin();
  if (!apr.mercadoPagoHabilitado || !mpConfigurado()) return volver("no-disponible");

  const url = new URL(req.url);
  if (url.searchParams.get("error")) return volver("cancelado");

  const codigo = url.searchParams.get("code");
  const aprDelState = leerState(url.searchParams.get("state"));
  if (!codigo || !aprDelState || aprDelState !== apr.id) return volver("invalido");

  try {
    await conectarCuenta(apr.id, codigo);
  } catch (e) {
    console.error("Conexión con Mercado Pago:", e instanceof Error ? e.message : "error");
    return volver("error");
  }
  return volver("ok");
}
