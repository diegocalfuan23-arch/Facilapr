import { requireAdmin } from "@/lib/apr-session";
import { COOKIE_PKCE, conectarCuenta, descifrar, leerState, mpConfigurado } from "@/lib/mercadopago";

/**
 * A donde Mercado Pago devuelve al comité después de autorizar. El `state` va
 * firmado y trae el comité: se exige que sea el mismo que tiene la sesión
 * abierta, para que nadie pueda conectar su cuenta a nombre de otro comité.
 */
export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  // Al volver se borra la cookie del verifier: ya cumplió su función.
  const volver = (resultado: string, detalle?: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `${base}/panel/pagos?mp=${resultado}${detalle ? `&detalle=${encodeURIComponent(detalle.slice(0, 160))}` : ""}`,
        "Set-Cookie": `${COOKIE_PKCE}=; Path=/api/mercadopago; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      },
    });

  const { apr } = await requireAdmin();
  if (!apr.mercadoPagoHabilitado || !mpConfigurado()) return volver("no-disponible");

  const url = new URL(req.url);
  if (url.searchParams.get("error")) return volver("cancelado");

  const codigo = url.searchParams.get("code");
  const aprDelState = leerState(url.searchParams.get("state"));
  if (!codigo || !aprDelState || aprDelState !== apr.id) return volver("invalido");

  // El verifier de PKCE que dejó la cookie al salir hacia Mercado Pago.
  const cookie = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE_PKCE}=`));
  let verifier = "";
  try {
    verifier = cookie ? descifrar(decodeURIComponent(cookie.slice(COOKIE_PKCE.length + 1))) : "";
  } catch {
    verifier = "";
  }
  if (!verifier) return volver("invalido");

  try {
    await conectarCuenta(apr.id, codigo, verifier);
  } catch (e) {
    // El motivo es el mensaje de Mercado Pago (nunca un token): sirve para saber qué corregir.
    const motivo = e instanceof Error ? e.message : "error";
    console.error("Conexión con Mercado Pago:", motivo);
    return volver("error", motivo);
  }
  return volver("ok");
}
