import { Resend } from "resend";
import { remitente } from "@/lib/correo/remitente";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const REMITENTE = remitente("Facilapr");

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Avisa al dueño de Facilapr, la primera vez, que un socio buscó un comité que no está: es una directiva a la que conviene
 * escribirle. Nunca debe fallar la búsqueda del socio: cualquier problema se anota y se sigue.
 */
export async function avisarComiteBuscado(datos: { nombre: string; comuna: string }): Promise<void> {
  if (!resend) return;
  try {
    const { error } = await resend.emails.send({
      from: REMITENTE,
      to: process.env.CORREO_AVISOS ?? process.env.CORREO_RESPUESTAS ?? "contacto@facilapr.cl",
      subject: `Un socio busca su comité: ${datos.nombre} (${datos.comuna})`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #18181b; line-height: 1.55;">
          <p style="font-size: 1.05em;"><strong>Un socio buscó su comité en Facilapr y no lo encontró.</strong></p>
          <p>Comité: <strong>${escapar(datos.nombre)}</strong><br />Comuna: <strong>${escapar(datos.comuna)}</strong></p>
          <p style="color: #71717a; font-size: 0.9em;">Es una directiva a la que puedes escribirle. Si más socios lo piden, el aviso no se repite: lo ves sumado en la tabla.</p>
        </div>
      `,
      text: `Un socio buscó su comité en Facilapr y no lo encontró.\nComité: ${datos.nombre}\nComuna: ${datos.comuna}`,
    });
    if (error) console.error("No se pudo avisar del comité buscado:", error.message);
  } catch (e) {
    console.error("No se pudo avisar del comité buscado:", e);
  }
}
