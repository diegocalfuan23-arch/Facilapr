import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const REMITENTE = "Facilapr <contacto@facilapr.cl>";

const escapar = (t: string) =>
  t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Envía el correo de recuperación de clave. Los socios inician sesión con un
 * correo sintético (rut@aprId.socio.local) que no es entregable — si alguien
 * pide resetear esa cuenta, Better Auth igual llama a esta función, así que
 * se descarta en silencio en vez de intentar enviar a un dominio inexistente.
 */
export async function enviarCorreoResetPassword({
  destinatario,
  nombre,
  url,
}: {
  destinatario: string;
  nombre: string;
  url: string;
}) {
  if (destinatario.endsWith(".socio.local")) return;

  if (!resend) {
    console.error(
      "RESEND_API_KEY no configurada: no se pudo enviar el correo de recuperación."
    );
    return;
  }

  try {
    await resend.emails.send({
      from: REMITENTE,
      to: destinatario,
      subject: "Recupera el acceso a tu cuenta de Facilapr",
      // Versión en texto: algunos clientes no muestran el HTML, y un enlace
      // visible es lo que permite recuperar la clave igual.
      text: `Hola ${nombre},

Recibimos una solicitud para restablecer la contraseña de tu cuenta en Facilapr. Crea una contraseña nueva en este enlace (vence en 1 hora):

${url}

Si no fuiste tú quien la solicitó, puedes ignorar este correo: tu contraseña actual sigue funcionando.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
          <p>Hola ${escapar(nombre)},</p>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Facilapr.</p>
          <p style="margin: 28px 0;">
            <a href="${url}" style="background: #1e1b4b; color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600;">
              Crear una contraseña nueva
            </a>
          </p>
          <p style="color: #52525b; font-size: 0.85em; word-break: break-all;">
            Si el botón no funciona, copia y pega esta dirección en tu navegador:<br />
            <a href="${escapar(url)}" style="color: #1e1b4b;">${escapar(url)}</a>
          </p>
          <p style="color: #71717a; font-size: 0.9em;">
            Si no fuiste tú quien la solicitó, puedes ignorar este correo: tu contraseña actual sigue funcionando. Este enlace vence en 1 hora.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("No se pudo enviar el correo de recuperación:", error);
  }
}
