import { procesarPagoMp } from "@/lib/mercadopago-pagos";

/**
 * Aviso de Mercado Pago cuando cambia un pago. Siempre responde 200 salvo si
 * falla algo pasajero (ahí responde 500 y Mercado Pago vuelve a avisar).
 */
async function atender(req: Request) {
  const url = new URL(req.url);
  const aprId = url.searchParams.get("apr");
  const cuerpo = (await req.json().catch(() => null)) as { type?: string; data?: { id?: string | number } } | null;

  const tipo = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? cuerpo?.type;
  const id =
    url.searchParams.get("data.id") ??
    url.searchParams.get("id") ??
    (cuerpo?.data?.id != null ? String(cuerpo.data.id) : null);
  if (!aprId || !id || tipo !== "payment") return new Response("ok");

  try {
    await procesarPagoMp(aprId, id);
  } catch (e) {
    console.error("Aviso de Mercado Pago:", e instanceof Error ? e.message : "error");
    return new Response("error", { status: 500 });
  }
  return new Response("ok");
}

export const POST = atender;
export const GET = atender;
