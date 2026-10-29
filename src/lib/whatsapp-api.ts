/**
 * Envío de mensajes por la API oficial de WhatsApp (Meta). Un solo número de
 * Facilapr envía en nombre de los comités; los mensajes salen con plantillas
 * aprobadas por Meta.
 *
 * Variables de entorno (en Vercel; nunca en el código):
 *  - WHATSAPP_TOKEN: token de acceso (de prueba mientras no exista el permanente).
 *  - WHATSAPP_PHONE_NUMBER_ID: ID del número que envía.
 *  - WHATSAPP_WABA_ID: ID de la cuenta de WhatsApp Business.
 *  - WHATSAPP_API_VERSION: versión de la API de Graph (por defecto "v21.0").
 *  - WHATSAPP_ENVIO_AUTOMATICO: "1" para que el panel envíe por la API en vez de abrir wa.me.
 *    Se prende solo cuando las plantillas ya están aprobadas.
 *  - WHATSAPP_IDIOMA: código de idioma de las plantillas (por defecto "es_CL", el "Spanish (CHL)" de Meta).
 *    Tiene que coincidir exacto con el de la plantilla o Meta responde "plantilla no encontrada".
 *  - WHATSAPP_PLANTILLA_BOLETA: "boleta_disponible_v2" para usar la versión con consumo y cómo pagar;
 *    si falta, se usa "boleta_disponible".
 */

export const whatsappConfigurado = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/** ¿El panel debe enviar por la API? Credenciales listas y el interruptor prendido. */
export const envioAutomaticoActivo = () =>
  whatsappConfigurado() && process.env.WHATSAPP_ENVIO_AUTOMATICO === "1";

/** Deja un celular chileno como Meta lo pide: solo dígitos y con el 56 delante. */
export function telefonoParaWhatsapp(telefono: string) {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length === 9 && digitos.startsWith("9")) return `56${digitos}`;
  if (digitos.length === 11 && digitos.startsWith("569")) return digitos;
  return null;
}

type Resultado = { ok: true; id: string } | { ok: false; error: string };

/**
 * Envía una plantilla aprobada. `parametros` son los valores de {{1}}, {{2}}… del cuerpo;
 * `sufijoBoton` es lo que va al final de la dirección del botón dinámico (si la plantilla lo tiene).
 */
export async function enviarPlantilla(
  telefono: string,
  plantilla: string,
  {
    idioma = process.env.WHATSAPP_IDIOMA ?? "es_CL",
    parametros = [],
    sufijoBoton,
  }: { idioma?: string; parametros?: string[]; sufijoBoton?: string } = {},
): Promise<Resultado> {
  if (!whatsappConfigurado()) return { ok: false, error: "WhatsApp no está configurado." };
  const para = telefonoParaWhatsapp(telefono);
  if (!para) return { ok: false, error: "El teléfono no es un celular chileno válido." };

  const version = process.env.WHATSAPP_API_VERSION ?? "v21.0";
  const respuesta = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "template",
      template: {
        name: plantilla,
        language: { code: idioma },
        ...(parametros.length || sufijoBoton
          ? {
              components: [
                ...(parametros.length
                  ? [{ type: "body", parameters: parametros.map((text) => ({ type: "text", text })) }]
                  : []),
                ...(sufijoBoton
                  ? [{ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: sufijoBoton }] }]
                  : []),
              ],
            }
          : {}),
      },
    }),
  });

  const datos = (await respuesta.json().catch(() => null)) as {
    messages?: { id: string }[];
    error?: { message?: string };
  } | null;
  if (!respuesta.ok || !datos?.messages?.[0]) {
    return { ok: false, error: datos?.error?.message ?? `WhatsApp respondió ${respuesta.status}.` };
  }
  return { ok: true, id: datos.messages[0].id };
}
