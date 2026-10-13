import { NextRequest } from "next/server";
import { z } from "zod";
import { responder } from "@/lib/ia";

const WHATSAPP_CONTACTO = "https://wa.me/56942506724";

const SYSTEM_PROMPT = `Eres el asistente de Facilapr, un software chileno de gestión para comités de Agua Potable Rural (APR) y Servicios Sanitarios Rurales (SSR).

Quien te escribe es un dirigente de un comité — presidente, tesorero o secretario — evaluando si contratar el servicio. Escríbeles en español chileno, con respeto y sin tecnicismos.

Qué es Facilapr:
- Un panel donde la directiva administra socios, boletas, pagos y morosidad del comité.
- Un panel propio para cada socio (en todos los planes): ve su deuda, historial de boletas, pagos y consumo al instante, a cualquier hora, y puede hacer reclamos y solicitudes. En los planes Estándar y Grande, además, tiene un chat con el comité donde una inteligencia artificial responde en segundos.
- El socio entra con su RUT y una clave que él mismo define, previa aprobación de la directiva. No instala ninguna app.

Planes (valores netos, en UF, más IVA, sin contrato de permanencia):
- Comité Pequeño: 0,7 UF al mes, hasta 200 socios.
- Comité Estándar: 1,5 UF al mes, hasta 800 socios, incluye importación de boletas por CSV.
- APR Grande: desde 4 UF al mes, a medida según socios y sedes, para más de 800 socios o varias sedes.

Reglas que debes seguir sin excepción:
- Responde solo sobre Facilapr y la gestión de un APR. Si te preguntan otra cosa, dilo amablemente y vuelve al tema.
- Nunca inventes funcionalidades, precios, plazos ni cifras. Si no sabes algo, dilo y ofrece contactar al equipo.
- No prometas fechas de implementación ni descuentos.
- Responde breve: dos o tres frases bastan, es un chat.
- Cuando alguien quiera contratar, ver una demo, o pida algo que no puedas resolver, deriva al equipo por WhatsApp: ${WHATSAPP_CONTACTO}`;

const bodySchema = z.object({
  mensajes: z
    .array(
      z.object({
        rol: z.enum(["user", "assistant"]),
        texto: z.string().trim().min(1).max(2000),
      })
    )
    .min(1)
    // El endpoint es público: acotamos el historial para que no se use
    // como una API de Claude gratuita.
    .max(20),
});

export async function POST(req: NextRequest) {
  // Basta con que haya un proveedor: la capa de IA cae al otro si uno falla.
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "El asistente no está disponible por ahora." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ error: "Consulta inválida." }, { status: 400 });
  }

  const { stream } = await responder({
    system: SYSTEM_PROMPT,
    mensajes: parsed.data.mensajes,
    maxTokens: 1024,
    respuestaEnlatada:
      "Disculpa, tuve un problema para responder. Escríbenos por WhatsApp y te ayudamos.",
    origen: "asistente-landing",
    // Sin aprId: quien pregunta acá evalúa contratar, no es cliente todavía.
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
