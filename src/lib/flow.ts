import { createHmac } from "node:crypto";

/**
 * Cliente mínimo de Flow (flow.cl), la pasarela con la que los comités pagan su
 * plan. Flow firma cada petición: se ordenan los parámetros por nombre, se
 * concatenan nombre y valor, y se aplica HMAC-SHA256 con la clave secreta.
 *
 * Variables de entorno (en Vercel):
 *  - FLOW_API_KEY y FLOW_SECRET_KEY: las claves de la cuenta de Flow.
 *  - FLOW_API_URL: https://www.flow.cl/api (producción, por defecto) o
 *    https://sandbox.flow.cl/api para probar con dinero de mentira.
 */

const URL_BASE = () => (process.env.FLOW_API_URL ?? "https://www.flow.cl/api").replace(/\/$/, "");

export const flowConfigurado = () => Boolean(process.env.FLOW_API_KEY && process.env.FLOW_SECRET_KEY);

function firmar(params: Record<string, string | number>) {
  const secreto = process.env.FLOW_SECRET_KEY;
  if (!secreto) throw new Error("Falta FLOW_SECRET_KEY.");
  const cadena = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return createHmac("sha256", secreto).update(cadena).digest("hex");
}

export type EstadoFlow = 1 | 2 | 3 | 4; // 1 pendiente · 2 pagada · 3 rechazada · 4 anulada

/** Crea la orden de pago; devuelve la dirección a la que hay que mandar al usuario. */
export async function crearPagoFlow(datos: {
  orden: string;
  asunto: string;
  monto: number;
  correo: string;
  urlConfirmacion: string;
  urlRetorno: string;
}) {
  const apiKey = process.env.FLOW_API_KEY;
  if (!apiKey) throw new Error("Falta FLOW_API_KEY.");

  const params: Record<string, string | number> = {
    apiKey,
    commerceOrder: datos.orden,
    subject: datos.asunto,
    currency: "CLP",
    amount: datos.monto,
    email: datos.correo,
    urlConfirmation: datos.urlConfirmacion,
    urlReturn: datos.urlRetorno,
  };
  const cuerpo = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), s: firmar(params) });

  const r = await fetch(`${URL_BASE()}/payment/create`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: cuerpo,
    signal: AbortSignal.timeout(15000),
  });
  const json = (await r.json().catch(() => null)) as { url?: string; token?: string; flowOrder?: number; message?: string } | null;
  if (!r.ok || !json?.url || !json.token) {
    throw new Error(json?.message ?? `Flow respondió ${r.status}`);
  }
  return { url: `${json.url}?token=${json.token}`, token: json.token, flowOrder: String(json.flowOrder ?? "") };
}

/** Pregunta a Flow cómo quedó un pago. Es la única fuente confiable: lo que llega al navegador no se cree. */
export async function estadoPagoFlow(token: string) {
  const apiKey = process.env.FLOW_API_KEY;
  if (!apiKey) throw new Error("Falta FLOW_API_KEY.");

  const params = { apiKey, token };
  const consulta = new URLSearchParams({ ...params, s: firmar(params) });
  const r = await fetch(`${URL_BASE()}/payment/getStatus?${consulta}`, { signal: AbortSignal.timeout(15000) });
  const json = (await r.json().catch(() => null)) as
    | { status?: EstadoFlow; commerceOrder?: string; amount?: number | string; flowOrder?: number }
    | null;
  if (!r.ok || !json?.commerceOrder || !json.status) throw new Error(`Flow respondió ${r.status}`);
  return {
    estado: json.status,
    orden: json.commerceOrder,
    monto: Number(json.amount ?? 0),
    flowOrder: String(json.flowOrder ?? ""),
  };
}
