/**
 * Identificadores públicos de la app Facilapr en Meta. No son secretos: van en el
 * navegador, que los necesita para abrir la ventana del registro insertado.
 * Se pueden cambiar con NEXT_PUBLIC_META_APP_ID y NEXT_PUBLIC_META_CONFIG_ID.
 */
export const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "1582757406987921";

/**
 * Meta aún no habilita en Facilapr conectar números que ya están en la app WhatsApp Business (coexistencia): responde
 * «this partner can't connect Business app numbers yet». Cuando lo habilite, se enciende con NEXT_PUBLIC_WHATSAPP_COEXISTENCIA=1.
 */
export const COEXISTENCIA_HABILITADA = process.env.NEXT_PUBLIC_WHATSAPP_COEXISTENCIA === "1";

/** La configuración de inicio de sesión «registro insertado de WhatsApp» creada en el panel de la app. */
export const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID ?? "1130216332822758";
