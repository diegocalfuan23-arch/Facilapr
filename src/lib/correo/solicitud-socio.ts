import { Resend } from "resend";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, socios } from "@/lib/db/schema";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const REMITENTE = "Facilapr <contacto@facilapr.cl>";

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Avisa por correo a la directiva que un socio pidió algo: acceso a su cuenta o una clave nueva. Va al correo del comité
 * (el de Configuración → Datos del comité); si no tiene uno, no se envía nada y la solicitud se ve igual en el panel.
 * No lleva datos sensibles del socio (solo su nombre) y nunca debe impedir la solicitud: cualquier falla se anota y se sigue.
 */
export async function avisarSolicitudDeSocio({ aprId, socioId, tipo }: { aprId: string; socioId: string; tipo: "ACCESO" | "CLAVE" }): Promise<void> {
  if (!resend) {
    console.error("RESEND_API_KEY no configurada: no se pudo avisar de la solicitud del socio.");
    return;
  }

  try {
    const [apr] = await db.select({ nombre: aprs.nombre, email: aprs.email }).from(aprs).where(eq(aprs.id, aprId)).limit(1);
    if (!apr?.email) {
      console.warn(`Solicitud de socio (${tipo}): el comité ${aprId} no tiene correo en Configuración; no se envió el aviso.`);
      return;
    }
    const [socio] = await db.select({ nombre: socios.nombre }).from(socios).where(eq(socios.id, socioId)).limit(1);
    if (!socio) return;

    const dominio = process.env.NEXT_PUBLIC_DOMINIO_RAIZ ?? "facilapr.cl";
    const enlace = `https://${dominio}/panel/socios/solicitudes`;
    const clave = tipo === "CLAVE";
    const titulo = clave ? "Un socio pide una clave nueva" : "Un socio pide acceso a su cuenta";
    const detalle = clave
      ? `${socio.nombre} no puede entrar a su cuenta y pidió una clave nueva. Ábrela en Solicitudes y mándale el enlace por WhatsApp, al teléfono que tienes registrado de él.`
      : `${socio.nombre} pidió acceso a su cuenta en línea. Revísala en Solicitudes y apruébala o recházala.`;

    const { error } = await resend.emails.send({
      from: REMITENTE,
      to: apr.email,
      subject: `${titulo} · ${apr.nombre}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #18181b; line-height: 1.55;">
          <p style="font-size: 1.05em;"><strong>${titulo}.</strong></p>
          <p>${escapar(detalle)}</p>
          <p><a href="${enlace}" style="display: inline-block; background: #3a0ce3; color: #fff; padding: 10px 18px; border-radius: 10px; text-decoration: none; font-weight: 600;">Abrir Solicitudes</a></p>
          <p style="color: #71717a; font-size: 0.85em;">Recibes este aviso porque este es el correo de ${escapar(apr.nombre)} en Facilapr. Puedes cambiarlo en Configuración.</p>
        </div>
      `,
      text: `${titulo}.\n\n${detalle}\n\nAbrir Solicitudes: ${enlace}`,
    });
    if (error) console.error("No se pudo avisar de la solicitud del socio:", error.message);
    else console.log(`Solicitud de socio (${tipo}): aviso enviado al correo del comité ${aprId}.`);
  } catch (e) {
    console.error("No se pudo avisar de la solicitud del socio:", e);
  }
}
