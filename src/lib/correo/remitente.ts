/**
 * Quién aparece como remitente en los correos de Facilapr. La dirección tiene que ser de un dominio verificado en Resend
 * (si no, Resend rechaza el envío). Se puede cambiar sin tocar el código con la variable `CORREO_REMITENTE` (solo la
 * dirección, por ejemplo avisos@facilapr.cl); si no existe, se usa notificaciones@facilapr.cl (los correos automáticos salen de ahí; contacto@ queda para que los socios y comités escriban).
 */
export const DIRECCION_REMITENTE = process.env.CORREO_REMITENTE?.trim() || "notificaciones@facilapr.cl";

/** «Nombre <dirección>» con el nombre que se vea en la bandeja de entrada. */
export const remitente = (nombre: string) => `${nombre} <${DIRECCION_REMITENTE}>`;
