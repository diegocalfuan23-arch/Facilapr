import { formatearPeriodo, saldo } from "@/lib/boletas";

/**
 * Envío de boletas por WhatsApp SIN la API de Meta: armamos un link wa.me con
 * el mensaje ya escrito y la directiva solo toca "enviar" en WhatsApp. Es a
 * propósito: la API oficial exige verificación del negocio y plantillas
 * aprobadas, y el producto ya descartó ese trámite (ver facilapr-sin-whatsapp).
 * Si algún día los toques pesan, el reemplazo es enviar desde un worker; la
 * plantilla y `mensajeBoleta` se reutilizan tal cual.
 *
 * El texto es una plantilla editable con variables entre llaves.
 */

const DOMINIO_RAIZ = process.env.NEXT_PUBLIC_DOMINIO_RAIZ ?? "facilapr.cl";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const diaMes = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
});

/** Variables que la directiva puede usar al editar el mensaje. */
export const VARIABLES_PLANTILLA = [
  { nombre: "nombre", ayuda: "Primer nombre del socio" },
  { nombre: "comite", ayuda: "Nombre del comité" },
  { nombre: "periodo", ayuda: "Mes de la boleta" },
  { nombre: "consumo", ayuda: "Consumo en m³" },
  { nombre: "monto", ayuda: "Total de la boleta" },
  { nombre: "saldo", ayuda: "Lo que queda por pagar (solo si hubo abono)" },
  { nombre: "vence", ayuda: "Fecha de vencimiento" },
  { nombre: "como_pagar", ayuda: "Dónde y cómo pagar (de Configuración)" },
  { nombre: "recibo", ayuda: "Enlace al recibo en PDF" },
  { nombre: "link", ayuda: "Enlace al panel del socio" },
] as const;

/**
 * Una línea que usa una variable sin valor (p. ej. {consumo} cuando la boleta
 * no tiene lecturas) se omite entera, para no mandar "• Consumo: " vacío.
 */
export const PLANTILLA_POR_DEFECTO = `Hola {nombre}, te escribe {comite}.

Tu recibo de agua de {periodo} está listo:
• Consumo: {consumo}
• Monto: {monto}
• Te quedan por pagar: {saldo}
• Vence el {vence}

Descárgalo en PDF: {recibo}

Cómo pagar: {como_pagar}

Cuando pagues, envíanos el comprobante por este mismo WhatsApp y lo registramos.

Tu cuenta en línea: {link}`;

/** El teléfono se guarda en E.164 (+56912345678). Cualquier otra cosa no sirve para wa.me. */
export function telefonoValidoParaWhatsApp(telefono: string | null | undefined) {
  return Boolean(telefono && /^\+\d{8,15}$/.test(telefono));
}

export function enlaceWhatsApp(telefono: string, texto: string) {
  return `https://wa.me/${telefono.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

export type DatosComiteWhatsApp = {
  nombre: string;
  slug: string | null;
  infoPago: string | null;
};

export type DatosBoletaWhatsApp = {
  socioNombre: string;
  periodo: string;
  montoTotal: number;
  montoPagado: number;
  fechaVencimiento: Date;
  consumoM3: number | null;
  /** Enlace firmado al recibo en PDF (ver lib/recibo-enlace.ts). */
  reciboUrl?: string;
};

function valoresDe(comite: DatosComiteWhatsApp, boleta: DatosBoletaWhatsApp) {
  const porPagar = saldo(boleta.montoTotal, boleta.montoPagado);
  const abonada = boleta.montoPagado > 0 && porPagar > 0;

  return {
    nombre: boleta.socioNombre.trim().split(/\s+/)[0] ?? "",
    comite: comite.nombre,
    periodo: formatearPeriodo(boleta.periodo),
    consumo: boleta.consumoM3 !== null ? `${boleta.consumoM3} m³` : "",
    monto: clp.format(boleta.montoTotal),
    saldo: abonada ? clp.format(porPagar) : "",
    vence: diaMes.format(boleta.fechaVencimiento),
    como_pagar: comite.infoPago?.trim() ?? "",
    recibo: boleta.reciboUrl ?? "",
    link: comite.slug ? `https://${DOMINIO_RAIZ}/${comite.slug}/cuenta/entrar` : "",
  } as Record<string, string>;
}

/** Rellena la plantilla para una boleta. Variables desconocidas quedan tal cual. */
export function mensajeBoleta(
  comite: DatosComiteWhatsApp,
  boleta: DatosBoletaWhatsApp,
  plantilla: string = PLANTILLA_POR_DEFECTO
) {
  const valores = valoresDe(comite, boleta);

  const lineas = plantilla
    .split("\n")
    .flatMap((linea) => {
      let sinValor = false;
      const resuelta = linea.replace(/\{(\w+)\}/g, (completo, clave: string) => {
        if (!(clave in valores)) return completo;
        if (valores[clave] === "") sinValor = true;
        return valores[clave];
      });
      return sinValor ? [] : [resuelta];
    });

  // Si se omitieron líneas entre párrafos pueden quedar varios saltos seguidos.
  return lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Días que dura el enlace de invitación al portal (ver lib/invitacion-socio.ts). */
export const DIAS_VIGENCIA_INVITACION = 14;

/** El mensaje con el que la directiva invita a un socio a su cuenta en línea. */
export function mensajeInvitacionPortal(
  comite: string,
  nombreSocio: string,
  url: string
) {
  const nombre = nombreSocio.trim().split(/\s+/)[0] ?? "";
  return [
    `Hola ${nombre}, te escribe ${comite}.`,
    "",
    "Ya puedes ver tu cuenta, tus boletas y tus recibos en línea. Crea tu clave aquí:",
    url,
    "",
    `El enlace es personal y vence en ${DIAS_VIGENCIA_INVITACION} días.`,
  ].join("\n");
}

/** Horas que dura el enlace para crear una clave nueva (ver lib/invitacion-socio.ts). */
export const HORAS_VIGENCIA_RESTABLECER = 48;

/** El mensaje con el que la directiva le manda al socio el enlace para elegir una clave nueva. */
export function mensajeRestablecerClave(
  comite: string,
  nombreSocio: string,
  url: string
) {
  const nombre = nombreSocio.trim().split(/\s+/)[0] ?? "";
  return [
    `Hola ${nombre}, te escribe ${comite}.`,
    "",
    "Para cambiar tu clave de la cuenta en línea, elige una nueva aquí:",
    url,
    "",
    `El enlace es personal, sirve una sola vez y vence en ${HORAS_VIGENCIA_RESTABLECER / 24} días. Si tú no lo pediste, ignora este mensaje.`,
  ].join("\n");
}

/** El mensaje con el que la directiva le manda al socio el comprobante de un pago que acaba de registrar. */
export function mensajeComprobantePago(
  comite: string,
  datos: {
    socioNombre: string;
    periodo: string;
    monto: number;
    montoTotal: number;
    montoPagado: number;
    comprobanteUrl: string;
  }
) {
  const nombre = datos.socioNombre.trim().split(/\s+/)[0] ?? "";
  const porPagar = saldo(datos.montoTotal, datos.montoPagado);
  return [
    `Hola ${nombre}, te escribe ${comite}.`,
    "",
    `Registramos tu pago de ${clp.format(datos.monto)} de la boleta de ${formatearPeriodo(datos.periodo)}.`,
    porPagar > 0
      ? `Te quedan ${clp.format(porPagar)} por pagar.`
      : "Con esto la boleta queda pagada completa. ¡Gracias!",
    "",
    `Descarga tu comprobante: ${datos.comprobanteUrl}`,
  ].join("\n");
}

/** Primer nombre del socio, para saludar. */
const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? "";

const enlaceCuenta = (comite: DatosComiteWhatsApp) =>
  comite.slug ? `https://${DOMINIO_RAIZ}/${comite.slug}/cuenta/entrar` : "";

/** Aviso antes de cortar: lo que debe, hace cuánto, y cuánto tiempo tiene para regularizar. */
export function mensajeAvisoCorte(
  comite: DatosComiteWhatsApp,
  d: { socioNombre: string; deuda: number; diasVencida: number; diasAviso: number }
) {
  const lineas = [
    `Hola ${primerNombre(d.socioNombre)}, te escribe ${comite.nombre}.`,
    "",
    `Tu cuenta de agua tiene ${clp.format(d.deuda)} vencidos hace ${d.diasVencida} días. Para evitar el corte del servicio, regulariza tu deuda dentro de los próximos ${d.diasAviso} días.`,
  ];
  if (comite.infoPago?.trim()) lineas.push("", `Cómo pagar: ${comite.infoPago.trim()}`);
  lineas.push("", "Si ya pagaste, envíanos el comprobante por este mismo WhatsApp y lo registramos.");
  return lineas.join("\n");
}

/** El corte ya se hizo: por qué, y cómo pedir la reposición. */
export function mensajeCorteRealizado(
  comite: DatosComiteWhatsApp,
  d: { socioNombre: string; deuda: number | null; costoReconexion: number | null }
) {
  const link = enlaceCuenta(comite);
  return [
    `Hola ${primerNombre(d.socioNombre)}, te escribe ${comite.nombre}.`,
    "",
    `Te informamos que el servicio de agua de tu arranque fue cortado por morosidad${d.deuda ? ` (deuda de ${clp.format(d.deuda)})` : ""}.`,
    "",
    `Cuando regularices tu situación, pide la reposición ${link ? `desde tu cuenta en línea (${link}) o ` : ""}respondiendo este mensaje.${d.costoReconexion ? ` La reconexión tiene un costo de ${clp.format(d.costoReconexion)}.` : ""}`,
  ].join("\n");
}

export function mensajeReposicion(comite: DatosComiteWhatsApp, d: { socioNombre: string }) {
  return [
    `Hola ${primerNombre(d.socioNombre)}, te escribe ${comite.nombre}.`,
    "",
    "Tu servicio de agua fue repuesto. ¡Gracias por regularizar tu cuenta!",
  ].join("\n");
}

/** La respuesta a algo que el socio pidió (reclamo, reparación, baja…). */
export function mensajeRespuestaSolicitud(
  comite: DatosComiteWhatsApp,
  d: { socioNombre: string; tipo: string; aprobada: boolean; respuesta: string | null }
) {
  const link = enlaceCuenta(comite);
  const lineas = [
    `Hola ${primerNombre(d.socioNombre)}, te escribe ${comite.nombre}.`,
    "",
    `Revisamos tu solicitud de ${d.tipo.toLowerCase()}: ${d.aprobada ? "quedó aprobada" : "no pudimos aprobarla"}.`,
  ];
  if (d.respuesta) lineas.push("", d.respuesta);
  if (link) lineas.push("", `Puedes ver el detalle en tu cuenta: ${link}`);
  return lineas.join("\n");
}
