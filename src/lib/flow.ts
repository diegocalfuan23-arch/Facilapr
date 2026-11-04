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

// ---------------------------------------------------------------- cobro automático
// Flow guarda la tarjeta del comité (registro hecho en la página de Flow, nunca
// pasa por aquí) y nosotros pedimos cada cobro con el monto del día.

async function postFlow<T>(ruta: string, extra: Record<string, string | number>): Promise<T> {
  const apiKey = process.env.FLOW_API_KEY;
  if (!apiKey) throw new Error("Falta FLOW_API_KEY.");
  const params: Record<string, string | number> = { apiKey, ...extra };
  const cuerpo = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    s: firmar(params),
  });
  const r = await fetch(`${URL_BASE()}${ruta}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: cuerpo,
    signal: AbortSignal.timeout(20000),
  });
  const json = (await r.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!r.ok || !json) throw new Error(json?.message ?? `Flow respondió ${r.status}`);
  return json;
}

async function getFlow<T>(ruta: string, extra: Record<string, string | number>): Promise<T> {
  const apiKey = process.env.FLOW_API_KEY;
  if (!apiKey) throw new Error("Falta FLOW_API_KEY.");
  const params: Record<string, string | number> = { apiKey, ...extra };
  const consulta = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    s: firmar(params),
  });
  const r = await fetch(`${URL_BASE()}${ruta}?${consulta}`, { signal: AbortSignal.timeout(20000) });
  const json = (await r.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!r.ok || !json) throw new Error(json?.message ?? `Flow respondió ${r.status}`);
  return json;
}

/** Crea al comité como cliente de Flow (una vez). `externalId` es el id del comité en Facilapr. */
export async function crearClienteFlow(datos: { nombre: string; correo: string; externalId: string }) {
  const c = await postFlow<{ customerId?: string }>("/customer/create", {
    name: datos.nombre.slice(0, 100),
    email: datos.correo,
    externalId: datos.externalId,
  });
  if (!c.customerId) throw new Error("Flow no devolvió el cliente.");
  return c.customerId;
}

/** Devuelve la página de Flow donde el comité registra su tarjeta. */
export async function iniciarRegistroTarjetaFlow(customerId: string, urlRetorno: string) {
  const r = await postFlow<{ url?: string; token?: string }>("/customer/register", {
    customerId,
    url_return: urlRetorno,
  });
  if (!r.url || !r.token) throw new Error("Flow no devolvió la dirección de registro.");
  return { url: `${r.url}?token=${r.token}`, token: r.token };
}

/** Cómo terminó el registro de la tarjeta. `registrada` es cierto cuando Flow ya la guardó. */
export async function estadoRegistroTarjetaFlow(token: string) {
  const r = await getFlow<{
    status?: number | string;
    customerId?: string;
    creditCardType?: string;
    last4CardDigits?: string;
  }>("/customer/getRegisterStatus", { token });
  return {
    registrada: Number(r.status) === 1,
    /** Lo que Flow respondió tal cual, para el registro de errores. */
    status: r.status ?? null,
    customerId: r.customerId ?? "",
    tipo: r.creditCardType ?? null,
    ultimos: r.last4CardDigits ?? null,
  };
}

/** Cobra `monto` (pesos, con IVA) a la tarjeta registrada. `orden` debe ser único por cobro. */
export async function cobrarTarjetaFlow(datos: { customerId: string; monto: number; asunto: string; orden: string }) {
  const r = await postFlow<{ status?: number | string; flowOrder?: number | string }>("/customer/charge", {
    customerId: datos.customerId,
    amount: datos.monto,
    subject: datos.asunto.slice(0, 120),
    commerceOrder: datos.orden,
    currency: "CLP",
  });
  return { estado: Number(r.status) as EstadoFlow, flowOrder: String(r.flowOrder ?? "") };
}

/** Estado de un pago a partir del número de orden de Flow (para los cobros que quedaron pendientes). */
export async function estadoPagoPorOrdenFlow(flowOrder: string) {
  const r = await getFlow<{ status?: number | string; amount?: number | string }>("/payment/getStatusByFlowOrder", {
    flowOrder,
  });
  return { estado: Number(r.status) as EstadoFlow, monto: Number(r.amount ?? 0) };
}

/** Quita la tarjeta guardada: después de esto Flow ya no puede cobrar sola. */
export async function quitarTarjetaFlow(customerId: string) {
  await postFlow("/customer/unRegister", { customerId });
}
