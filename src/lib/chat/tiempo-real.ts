import { SignJWT } from "jose";

/**
 * El chat en tiempo real va por el servidor Socket.IO propio (servicio-chat/,
 * alojado en Railway). Vercel es serverless y no puede mantener WebSockets, así
 * que publica cada mensaje nuevo al servicio con una llamada interna firmada.
 *
 * Variables: CHAT_URL_INTERNA y CHAT_EMIT_SECRET (publicar), CHAT_JWT_SECRET
 * (token del navegador) y NEXT_PUBLIC_CHAT_URL (donde se conecta el navegador).
 */
export const EVENTO_MENSAJE_NUEVO = "mensaje-nuevo";

/** Avisa a la lista de Conversaciones de la directiva que algo se movió en el chat de un socio. */
export const EVENTO_CONVERSACION_ACTIVA = "conversacion-activa";

export const salaChatSocio = (socioId: string) => `chat-socio-${socioId}`;

/** La sala que escucha la directiva de un comité para enterarse de la actividad de todas sus conversaciones. */
export const salaChatComite = (aprId: string) => `chat-comite-${aprId}`;

/** Publica un evento en una sala del servicio de chat (el servicio no guarda nada: solo lo reenvía a quien escucha). */
async function emitir(sala: string, evento: string, datos: unknown) {
  const url = process.env.CHAT_URL_INTERNA;
  const secreto = process.env.CHAT_EMIT_SECRET;
  if (!url || !secreto) throw new Error("Falta CHAT_URL_INTERNA o CHAT_EMIT_SECRET.");

  const r = await fetch(new URL("/emitir", url), {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-secret": secreto },
    body: JSON.stringify({ sala, evento, datos }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`El servicio de chat respondió ${r.status}`);
}

/** Publica un mensaje nuevo a quienes están escuchando el chat de ese socio. */
export async function publicarMensajeEnVivo(socioId: string, mensaje: unknown) {
  await emitir(salaChatSocio(socioId), EVENTO_MENSAJE_NUEVO, mensaje);
}

/** Avisa a la directiva del comité que hubo un mensaje en la conversación de ese socio. */
export async function publicarActividadComite(aprId: string, socioId: string) {
  await emitir(salaChatComite(aprId), EVENTO_CONVERSACION_ACTIVA, { socioId });
}

/** Token corto que el navegador presenta al servidor Socket.IO para entrar a una sala. */
export async function firmarTokenChat(salas: string[]) {
  const secreto = process.env.CHAT_JWT_SECRET;
  if (!secreto) throw new Error("Falta CHAT_JWT_SECRET.");
  return new SignJWT({ salas })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("facilapr")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(secreto));
}
