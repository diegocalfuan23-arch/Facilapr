import { completarRegistroTarjeta } from "@/lib/cobro-automatico";

/**
 * A donde Flow devuelve al comité después de registrar su tarjeta (con un POST
 * del navegador). Se le pregunta a Flow si quedó guardada, y si corresponde se
 * cobra el primer período; después se manda a Mi plan con el resultado.
 */
async function responder(req: Request, token: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  let resultado = "fallido";
  if (token) {
    try {
      const r = await completarRegistroTarjeta(token);
      resultado = r === "ACTIVA" ? "ok" : r === "COBRO_FALLIDO" ? "cobro" : "fallido";
    } catch (e) {
      console.error("Registro de tarjeta:", e);
    }
  }
  return Response.redirect(`${base}/panel/plan?automatico=${resultado}`, 303);
}

export async function POST(req: Request) {
  const token = new URLSearchParams(await req.text().catch(() => "")).get("token") ?? "";
  return responder(req, token);
}

export async function GET(req: Request) {
  return responder(req, new URL(req.url).searchParams.get("token") ?? "");
}
