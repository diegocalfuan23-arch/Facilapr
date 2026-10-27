import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mercadoPagoConexiones } from "@/lib/db/schema";

/**
 * Conexión con Mercado Pago: cada comité vincula su propia cuenta (OAuth) y los
 * pagos de sus socios van directo a esa cuenta. Facilapr no cobra comisión ni
 * recibe el dinero: solo registra el pago.
 *
 * Variables de entorno (en Vercel; nunca en el código):
 *  - MP_CLIENT_ID: el N.º de la aplicación de Facilapr en Mercado Pago.
 *  - MP_CLIENT_SECRET: la clave secreta de esa aplicación.
 *  - CLAVE_CIFRADO_MP: texto largo al azar con el que se cifran los tokens de los comités.
 *  - MP_MODO: "prueba" o "produccion" (por defecto "prueba", para no cobrar de verdad sin querer).
 */

export type ModoMp = "prueba" | "produccion";

export const modoMp = (): ModoMp => (process.env.MP_MODO === "produccion" ? "produccion" : "prueba");

export const mpConfigurado = () =>
  Boolean(process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET && process.env.CLAVE_CIFRADO_MP);

const BASE_SITIO = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "https://facilapr.cl").replace(/\/$/, "");

export const urlCallbackMp = () => `${BASE_SITIO()}/api/mercadopago/callback`;

// ---------------------------------------------------------------- cifrado

function clave() {
  const t = process.env.CLAVE_CIFRADO_MP;
  if (!t) throw new Error("Falta CLAVE_CIFRADO_MP.");
  return createHash("sha256").update(t).digest();
}

/** AES-256-GCM: devuelve iv.etiqueta.cifrado en base64. */
export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), datos].map((b) => b.toString("base64")).join(".");
}

export function descifrar(valor: string) {
  const [iv, etiqueta, datos] = valor.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", clave(), iv);
  d.setAuthTag(etiqueta);
  return Buffer.concat([d.update(datos), d.final()]).toString("utf8");
}

// ---------------------------------------------------------------- state (anti-falsificación)

const VIGENCIA_STATE_MS = 10 * 60 * 1000;

/** Firma el id del comité y la hora, para que el retorno de Mercado Pago no se pueda falsificar. */
export function crearState(aprId: string) {
  const exp = Date.now() + VIGENCIA_STATE_MS;
  const base = `${aprId}.${exp}`;
  const firma = createHmac("sha256", clave()).update(base).digest("hex");
  return `${base}.${firma}`;
}

/** Devuelve el id del comité si el state es válido y no venció. */
export function leerState(state: string | null) {
  if (!state) return null;
  const partes = state.split(".");
  if (partes.length !== 3) return null;
  const [aprId, exp, firma] = partes;
  const esperada = createHmac("sha256", clave()).update(`${aprId}.${exp}`).digest("hex");
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!Number.isFinite(Number(exp)) || Date.now() > Number(exp)) return null;
  return aprId;
}

// ---------------------------------------------------------------- PKCE

/** Par de PKCE: el verifier se guarda (cookie cifrada) y el challenge viaja a Mercado Pago. */
export function generarPkce() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export const COOKIE_PKCE = "mp_pkce";

// ---------------------------------------------------------------- OAuth

/**
 * Dirección de Mercado Pago a la que se manda al comité para que autorice.
 * (Formato tomado de memoria: confirmar contra la documentación de OAuth.)
 */
export function urlAutorizacion(aprId: string, challenge: string) {
  const id = process.env.MP_CLIENT_ID;
  if (!id) throw new Error("Falta MP_CLIENT_ID.");
  const p = new URLSearchParams({
    client_id: id,
    response_type: "code",
    platform_id: "mp",
    state: crearState(aprId),
    redirect_uri: urlCallbackMp(),
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://auth.mercadopago.cl/authorization?${p}`;
}

type RespuestaToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number | string;
  message?: string;
  error?: string;
};

async function pedirToken(cuerpo: Record<string, string>) {
  const id = process.env.MP_CLIENT_ID;
  const secreto = process.env.MP_CLIENT_SECRET;
  if (!id || !secreto) throw new Error("Faltan MP_CLIENT_ID o MP_CLIENT_SECRET.");
  const r = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: id, client_secret: secreto, ...cuerpo }),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await r.json().catch(() => null)) as RespuestaToken | null;
  if (!r.ok || !json?.access_token || !json.refresh_token || !json.user_id) {
    // No se registra el cuerpo completo: podría traer tokens.
    throw new Error(json?.message ?? json?.error ?? `Mercado Pago respondió ${r.status}`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    mpUserId: String(json.user_id),
    expiraEn: new Date(Date.now() + (json.expires_in ?? 15552000) * 1000),
  };
}

/** Cambia el código que dejó el comité por sus tokens y los guarda cifrados. */
export async function conectarCuenta(aprId: string, codigo: string, verifier: string) {
  const t = await pedirToken({
    grant_type: "authorization_code",
    code: codigo,
    code_verifier: verifier,
    redirect_uri: urlCallbackMp(),
  });
  const valores = {
    mpUserId: t.mpUserId,
    accessToken: cifrar(t.accessToken),
    refreshToken: cifrar(t.refreshToken),
    expiraEn: t.expiraEn,
    updatedAt: new Date(),
  };
  await db
    .insert(mercadoPagoConexiones)
    .values({ aprId, ...valores })
    .onConflictDoUpdate({ target: mercadoPagoConexiones.aprId, set: valores });
}

const MARGEN_RENOVAR_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * El token de acceso del comité, listo para usar. Si le queda menos de una
 * semana de vida lo renueva primero (cada renovación entrega un refresh token
 * nuevo, que se guarda).
 */
export async function tokenDelComite(aprId: string) {
  const fila = await db.query.mercadoPagoConexiones.findFirst({ where: eq(mercadoPagoConexiones.aprId, aprId) });
  if (!fila) return null;
  if (fila.expiraEn.getTime() - Date.now() > MARGEN_RENOVAR_MS) return descifrar(fila.accessToken);

  const t = await pedirToken({ grant_type: "refresh_token", refresh_token: descifrar(fila.refreshToken) });
  await db
    .update(mercadoPagoConexiones)
    .set({
      accessToken: cifrar(t.accessToken),
      refreshToken: cifrar(t.refreshToken),
      expiraEn: t.expiraEn,
      updatedAt: new Date(),
    })
    .where(eq(mercadoPagoConexiones.aprId, aprId));
  return t.accessToken;
}

export async function estadoConexion(aprId: string) {
  const fila = await db.query.mercadoPagoConexiones.findFirst({
    where: eq(mercadoPagoConexiones.aprId, aprId),
    columns: { mpUserId: true, expiraEn: true, createdAt: true },
  });
  return fila ?? null;
}

export async function desconectarCuenta(aprId: string) {
  await db.delete(mercadoPagoConexiones).where(eq(mercadoPagoConexiones.aprId, aprId));
}
