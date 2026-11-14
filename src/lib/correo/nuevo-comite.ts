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
 * Avisa al dueño de Facilapr, en el momento, que un comité se acaba de registrar: así se entera al instante y no horas
 * después al revisar el panel. Va a `CORREO_AVISOS` (o, si no se define, a `CORREO_RESPUESTAS` o contacto@facilapr.cl).
 * Nunca debe impedir el registro: cualquier falla se anota y se sigue.
 */
export async function avisarNuevoComite(datos: { comite: string; comuna: string; persona: string; cargo: string; correo: string; telefono: string; origen: string }): Promise<void> {
  if (!resend) {
    console.error("RESEND_API_KEY no configurada: no se pudo avisar del nuevo comité.");
    return;
  }

  const hora = new Intl.DateTimeFormat("es-CL", { dateStyle: "full", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date());
  const lineas: [string, string][] = [
    ["Comité", datos.comite],
    ["Comuna", datos.comuna],
    ["Se registró", datos.persona],
    ["Cargo", datos.cargo],
    ["Correo", datos.correo],
    ["WhatsApp", datos.telefono || "no dejó"],
    ["Llegó desde", datos.origen || "sin dato"],
    ["Hora", hora],
  ];

  try {
    const { error } = await resend.emails.send({
      from: REMITENTE,
      to: process.env.CORREO_AVISOS ?? process.env.CORREO_RESPUESTAS ?? "contacto@facilapr.cl",
      subject: `Nuevo comité en Facilapr: ${datos.comite} (${datos.comuna})`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #18181b; line-height: 1.55;">
          <p style="font-size: 1.05em;"><strong>Se registró un comité nuevo.</strong> Tiene la prueba gratuita de 10 días.</p>
          <table style="border-collapse: collapse; font-size: 0.95em;">
            ${lineas.map(([k, v]) => `<tr><td style="padding: 3px 14px 3px 0; color: #71717a;">${k}</td><td style="padding: 3px 0;">${escapar(v)}</td></tr>`).join("")}
          </table>
        </div>
      `,
      text: lineas.map(([k, v]) => `${k}: ${v}`).join("\n"),
    });
    if (error) console.error("No se pudo avisar del nuevo comité:", error.message);
  } catch (e) {
    console.error("No se pudo avisar del nuevo comité:", e);
  }
}
