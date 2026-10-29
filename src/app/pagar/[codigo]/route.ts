import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aprs, boletas, socios } from "@/lib/db/schema";
import { boletaIdDeCodigo } from "@/lib/recibo-enlace";
import { BASE_SITIO } from "@/lib/mercadopago";
import { crearLinkPago, pagoEnLineaActivo } from "@/lib/mercadopago-pagos";

/**
 * Botón "Ver y pagar mi cuenta" del WhatsApp de la boleta. El enlace lleva el
 * mismo código firmado del recibo y no necesita sesión. Se crea el link de
 * Mercado Pago en este momento, con lo que falta pagar hoy, y se manda al socio
 * directo a pagar. Si el comité no tiene pago en línea, o algo falla, va a su
 * cuenta en línea: nunca se queda en una página en blanco.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;

  const boletaId = boletaIdDeCodigo(decodeURIComponent(codigo));
  if (!boletaId) return new Response("No encontrado.", { status: 404 });

  const [fila] = await db
    .select({
      aprId: aprs.id,
      slug: aprs.slug,
      mercadoPagoHabilitado: aprs.mercadoPagoHabilitado,
      estado: boletas.estado,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .innerJoin(aprs, eq(socios.aprId, aprs.id))
    .where(eq(boletas.id, boletaId))
    .limit(1);
  if (!fila || fila.estado === "ANULADA") return new Response("No encontrado.", { status: 404 });

  const cuenta = fila.slug ? `${BASE_SITIO()}/${fila.slug}/cuenta/entrar` : BASE_SITIO();
  const sinCache = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" };
  const ir = (url: string) => new Response(null, { status: 302, headers: { location: url, ...sinCache } });

  if (!fila.slug || !(await pagoEnLineaActivo({ id: fila.aprId, mercadoPagoHabilitado: fila.mercadoPagoHabilitado }))) {
    return ir(cuenta);
  }

  try {
    const link = await crearLinkPago(fila.aprId, boletaId, {
      volverA: `${BASE_SITIO()}/${fila.slug}/cuenta/boletas`,
    });
    return ir(link.ok ? link.url : cuenta);
  } catch (e) {
    console.error("Pago desde WhatsApp:", e instanceof Error ? e.message : "error");
    return ir(cuenta);
  }
}
