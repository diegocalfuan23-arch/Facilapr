import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, boletas, mensajesWhatsapp, pagos, socios } from "@/lib/db/schema";
import { urlComprobante } from "@/lib/comprobante-enlace";
import { formatearPeriodo } from "@/lib/boletas";
import { primerNombre } from "@/lib/whatsapp";
import { enviarPlantilla, envioAutomaticoActivo } from "@/lib/whatsapp-api";
import { credencialesDelComite } from "@/lib/whatsapp-conexion";
import { cupoWhatsapp, MENSAJE_SIN_CUPO } from "@/lib/whatsapp-cupo";
import type { Plan } from "@/lib/planes";

/**
 * Comprobante de pago automático: al registrarse el pago de una boleta, el socio
 * recibe por WhatsApp la plantilla `comprobante_pago` con el enlace al comprobante.
 *
 * Solo sale si el comité lo prendió, el socio aceptó recibir WhatsApp y tiene
 * teléfono. Nunca hace fallar a quien registra el pago: si algo sale mal, el pago
 * ya está guardado y el motivo queda en el registro del servidor y del mensaje.
 */

const PLANTILLA = "comprobante_pago";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export type ResultadoComprobante = { ok: true } | { ok: false; error: string; sinCupo?: boolean };

/** Deja anotado por qué no se envió: un comprobante que no sale en silencio es imposible de diagnosticar. */
function omitido(motivo: string, mensaje = motivo, sinCupo = false): ResultadoComprobante {
  console.info(`WhatsApp comprobante omitido: ${motivo}.`);
  return { ok: false, error: mensaje, sinCupo };
}

/** Al registrarse un pago: sale solo si el comité lo prendió. Nunca falla hacia quien registra. */
export async function enviarComprobanteAuto(pagoId: string) {
  await enviarComprobante(pagoId);
}

/**
 * Manda el comprobante de un pago de boleta por la API. `manual` es cuando la directiva aprieta «Enviar»:
 * no pide que el comité tenga prendido el comprobante automático, pero sí consentimiento, teléfono y cupo.
 * `aprId` (solo en el manual) asegura que el pago sea del comité que lo pide.
 */
export async function enviarComprobante(pagoId: string, opciones: { manual?: boolean; aprId?: string } = {}): Promise<ResultadoComprobante> {
  try {
    if (!envioAutomaticoActivo()) return omitido("el envío automático está apagado en el servidor", "El envío automático no está activado.");

    const [f] = await db
      .select({
        monto: pagos.monto,
        concepto: pagos.concepto,
        periodo: boletas.periodo,
        socioId: socios.id,
        socioNombre: socios.nombre,
        telefono: socios.telefono,
        consentimiento: socios.whatsappConsentimiento,
        aprId: aprs.id,
        comite: aprs.nombre,
        automatico: aprs.whatsappComprobanteAuto,
        plan: aprs.plan,
      })
      .from(pagos)
      .innerJoin(boletas, eq(pagos.boletaId, boletas.id))
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .innerJoin(aprs, eq(socios.aprId, aprs.id))
      .where(eq(pagos.id, pagoId))
      .limit(1);

    // Solo el pago de una boleta: la plantilla habla de "la boleta de {mes}".
    if (!f) return omitido("el pago no tiene boleta o socio", "No encontramos ese pago.");
    if (opciones.aprId && f.aprId !== opciones.aprId) return omitido("el pago es de otro comité", "No encontramos ese pago.");
    if (f.concepto !== "BOLETA") return omitido("no es el pago de una boleta", "Este comprobante no se puede enviar por la API.");
    if (!opciones.manual && !f.automatico) return omitido("el comité no prendió el comprobante automático");
    if (!f.consentimiento) return omitido("el socio no está marcado como que acepta WhatsApp", "Este socio todavía no aceptó recibir WhatsApp automáticos. Márcalo en Socios.");
    if (!f.telefono) return omitido("el socio no tiene teléfono", "El socio no tiene teléfono.");

    // Sin cupo en el mes: no sale por la API (a mano se puede seguir enviando por wa.me).
    const cupo = await cupoWhatsapp(f.aprId, f.plan as Plan);
    if (!cupo.disponible) return omitido("se acabaron los mensajes automáticos del mes", MENSAJE_SIN_CUPO, true);

    // Se reserva el envío antes de mandarlo: el índice único deja pasar uno solo por pago,
    // aunque el aviso de pago llegue dos veces.
    const [reserva] = await db
      .insert(mensajesWhatsapp)
      .values({ aprId: f.aprId, socioId: f.socioId, tipo: "COMPROBANTE", referenciaId: pagoId, plantilla: PLANTILLA })
      .onConflictDoNothing()
      .returning({ id: mensajesWhatsapp.id });
    if (!reserva) return omitido("ya se había enviado el comprobante de este pago", "Ya se envió el comprobante de este pago por WhatsApp.");

    const r = await enviarPlantilla(f.telefono, PLANTILLA, {
      parametros: [
        primerNombre(f.socioNombre),
        f.comite,
        clp.format(f.monto),
        formatearPeriodo(f.periodo),
        urlComprobante(pagoId),
      ],
      credenciales: await credencialesDelComite(f.aprId),
    });

    await db
      .update(mensajesWhatsapp)
      .set(
        r.ok
          ? { metaId: r.id, updatedAt: new Date() }
          : { estado: "FALLIDO", error: r.error.slice(0, 300), updatedAt: new Date() }
      )
      .where(eq(mensajesWhatsapp.id, reserva.id));
    if (!r.ok) {
      console.error("WhatsApp comprobante:", r.error);
      return { ok: false, error: "WhatsApp no pudo enviar el mensaje. Prueba de nuevo o usa el envío manual." };
    }
    return { ok: true };
  } catch (e) {
    console.error("WhatsApp comprobante:", e instanceof Error ? e.message : "error");
    return { ok: false, error: "No pudimos enviar el mensaje. Vuelve a intentarlo." };
  }
}
