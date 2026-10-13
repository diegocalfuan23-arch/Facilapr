import { aplicarPagoFlow } from "@/lib/pago-plan";

/**
 * A donde Flow devuelve al usuario después de pagar (con un POST del navegador).
 * Se revisa el pago de inmediato, por si el aviso de confirmación llega después,
 * y se manda al usuario a Mi plan con el resultado.
 */
async function responder(req: Request, token: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  let resultado = "pendiente";
  if (token) {
    try {
      const r = await aplicarPagoFlow(token);
      resultado = r === "PAGADO" ? "ok" : r === "RECHAZADO" ? "fallido" : "pendiente";
    } catch (e) {
      console.error("Retorno de Flow:", e);
    }
  }
  return Response.redirect(`${base}/panel/plan?pago=${resultado}`, 303);
}

export async function POST(req: Request) {
  const token = new URLSearchParams(await req.text().catch(() => "")).get("token") ?? "";
  return responder(req, token);
}

export async function GET(req: Request) {
  return responder(req, new URL(req.url).searchParams.get("token") ?? "");
}
