import { Resend } from "resend";
import { remitente } from "@/lib/correo/remitente";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const REMITENTE = remitente("Diego de Facilapr");

const escapar = (t: string) =>
  t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export type ResultadoEnvio = { ok: true } | { ok: false; error: string; sinConfigurar?: boolean };

/**
 * Responde a quien escribió por el formulario de contacto. El mensaje lo escribe
 * el dueño en el panel; aquí solo se le da formato y se envía. Las respuestas
 * del destinatario llegan a `CORREO_RESPUESTAS` (o a contacto@facilapr.cl si no se
 * define), no a una casilla que nadie lea.
 */
export async function enviarRespuestaConsulta({
  destinatario,
  asunto,
  mensaje,
  consultaOriginal,
}: {
  destinatario: string;
  asunto: string;
  mensaje: string;
  consultaOriginal: string | null;
}): Promise<ResultadoEnvio> {
  if (!resend) {
    return {
      ok: false,
      sinConfigurar: true,
      error: "RESEND_API_KEY no está configurada en Facilapr: no se puede enviar el correo.",
    };
  }

  const cuerpo = escapar(mensaje).replace(/\r?\n/g, "<br />");
  const cita = consultaOriginal
    ? `<blockquote style="margin: 24px 0 0; padding-left: 12px; border-left: 3px solid #e4e4e7; color: #71717a; font-size: 0.9em;">
         Tu consulta: ${escapar(consultaOriginal).replace(/\r?\n/g, "<br />")}
       </blockquote>`
    : "";

  try {
    const { error } = await resend.emails.send({
      from: REMITENTE,
      to: destinatario,
      replyTo: process.env.CORREO_RESPUESTAS ?? "contacto@facilapr.cl",
      subject: asunto,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #18181b; line-height: 1.55;">
          <p>${cuerpo}</p>
          ${cita}
        </div>
      `,
      text: mensaje,
    });
    if (error) {
      return { ok: false, error: `El servicio de correo rechazó el envío: ${error.message}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("No se pudo enviar la respuesta a una consulta:", e);
    return { ok: false, error: "No se pudo enviar el correo. Inténtalo otra vez." };
  }
}
