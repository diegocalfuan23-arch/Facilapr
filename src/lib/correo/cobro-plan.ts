import { Resend } from "resend";
import { remitente } from "@/lib/correo/remitente";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const REMITENTE = remitente("Facilapr");

const escapar = (t: string) =>
  t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Avisa al administrador del comité que el cobro automático de su plan no pasó.
 * `suspendido` es cierto cuando ya fallaron los tres intentos y el cobro quedó
 * apagado hasta que registre otra tarjeta.
 */
export async function enviarCorreoCobroFallido({
  destinatario,
  nombre,
  comite,
  suspendido,
  url,
}: {
  destinatario: string;
  nombre: string;
  comite: string;
  suspendido: boolean;
  url: string;
}) {
  if (!resend) {
    console.error("RESEND_API_KEY no configurada: no se pudo avisar del cobro fallido.");
    return;
  }

  const asunto = suspendido
    ? "Pausamos el pago automático de tu plan Facilapr"
    : "No pudimos cobrar tu plan Facilapr";
  const cuerpo = suspendido
    ? `Intentamos cobrar el plan de ${comite} tres veces y la tarjeta no pasó, así que pausamos el pago automático. No se te cobró nada. Para seguir con el plan, registra otra tarjeta o paga en línea desde Mi plan:`
    : `No pudimos cobrar el plan de ${comite} a tu tarjeta registrada. Volveremos a intentarlo mañana. Si la tarjeta venció o no tiene saldo, puedes cambiarla o pagar en línea desde Mi plan:`;

  try {
    await resend.emails.send({
      from: REMITENTE,
      to: destinatario,
      subject: asunto,
      text: `Hola ${nombre},\n\n${cuerpo}\n\n${url}\n\nSi tienes dudas, responde este correo.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
          <p>Hola ${escapar(nombre)},</p>
          <p>${escapar(cuerpo)}</p>
          <p style="margin: 28px 0;">
            <a href="${escapar(url)}" style="background: #1e1b4b; color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600;">
              Ir a Mi plan
            </a>
          </p>
          <p style="color: #71717a; font-size: 0.9em;">Si tienes dudas, responde este correo.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("No se pudo enviar el aviso de cobro fallido:", error);
  }
}
