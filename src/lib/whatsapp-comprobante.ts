import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, boletas, mensajesWhatsapp, pagos, socios } from "@/lib/db/schema";
import { urlComprobante } from "@/lib/comprobante-enlace";
import { formatearPeriodo } from "@/lib/boletas";
import { primerNombre } from "@/lib/whatsapp";
import { enviarPlantilla, envioAutomaticoActivo } from "@/lib/whatsapp-api";

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

export async function enviarComprobanteAuto(pagoId: string) {
  try {
    if (!envioAutomaticoActivo()) return;

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
      })
      .from(pagos)
      .innerJoin(boletas, eq(pagos.boletaId, boletas.id))
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .innerJoin(aprs, eq(socios.aprId, aprs.id))
      .where(eq(pagos.id, pagoId))
      .limit(1);

    // Solo el pago de una boleta: la plantilla habla de "la boleta de {mes}".
    if (!f || f.concepto !== "BOLETA" || !f.automatico || !f.consentimiento || !f.telefono) return;

    // Se reserva el envío antes de mandarlo: el índice único deja pasar uno solo por pago,
    // aunque el aviso de pago llegue dos veces.
    const [reserva] = await db
      .insert(mensajesWhatsapp)
      .values({ aprId: f.aprId, socioId: f.socioId, tipo: "COMPROBANTE", referenciaId: pagoId, plantilla: PLANTILLA })
      .onConflictDoNothing()
      .returning({ id: mensajesWhatsapp.id });
    if (!reserva) return;

    const r = await enviarPlantilla(f.telefono, PLANTILLA, {
      parametros: [
        primerNombre(f.socioNombre),
        f.comite,
        clp.format(f.monto),
        formatearPeriodo(f.periodo),
        urlComprobante(pagoId),
      ],
    });

    await db
      .update(mensajesWhatsapp)
      .set(
        r.ok
          ? { metaId: r.id, updatedAt: new Date() }
          : { estado: "FALLIDO", error: r.error.slice(0, 300), updatedAt: new Date() }
      )
      .where(eq(mensajesWhatsapp.id, reserva.id));
    if (!r.ok) console.error("WhatsApp comprobante:", r.error);
  } catch (e) {
    console.error("WhatsApp comprobante:", e instanceof Error ? e.message : "error");
  }
}
