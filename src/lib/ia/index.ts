import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { registrarUsoIa } from "@/lib/ia/uso";

/**
 * Capa de IA con respaldo entre proveedores.
 *
 * Existe porque Anthropic se ha caído y el bot no puede quedar mudo: si un
 * socio pregunta cuánto debe y nadie responde, el comité pierde justamente
 * lo que está pagando.
 *
 * El orden es: modelo según la complejidad de la pregunta → reintento →
 * OpenAI → respuesta enlatada. Nunca silencio.
 */

export type Mensaje = { rol: "user" | "assistant"; texto: string };

/**
 * Modelos por complejidad. "Cuánto debo" es siempre la misma consulta y no
 * necesita el modelo caro: Haiku cuesta la quinta parte de Opus.
 */
const MODELO_SIMPLE = "claude-haiku-4-5";
const MODELO_COMPLEJO = "claude-opus-5";

/** Respaldo en OpenAI cuando Anthropic no responde. */
const MODELO_RESPALDO = "gpt-4o-mini";

/**
 * Preguntas que Haiku resuelve igual de bien que Opus: consultas directas
 * sobre datos que ya están en el prompt.
 */
const PATRONES_SIMPLES = [
  /cu[aá]nto\s+(debo|deb[eo]|es|sale|cuesta|vale)/i,
  /cu[aá]ndo\s+(vence|pago|es|abre|atienden)/i,
  /d[oó]nde\s+(pago|queda|est[aá]n|atienden)/i,
  /hay\s+(corte|agua)/i,
  /horario/i,
  /^(hola|buenas|buenos d[ií]as|buenas tardes|gracias|ok|ya|listo)[\s!.]*$/i,
];

export function esConsultaSimple(texto: string): boolean {
  const limpio = texto.trim();
  // Una pregunta larga rara vez es una consulta de dato suelto.
  if (limpio.length > 160) return false;
  return PATRONES_SIMPLES.some((p) => p.test(limpio));
}

/** Errores que vale la pena reintentar: son transitorios. */
function esTransitorio(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  // 429 rate limit, 500 interno, 529 sobrecargado.
  return status === 429 || status === 500 || status === 529;
}

/** Espera con backoff exponencial: 1s, 2s, 4s… */
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ResultadoIA = {
  /** Stream de texto listo para devolver al navegador. */
  stream: ReadableStream<Uint8Array>;
  /** Qué proveedor terminó respondiendo, para registrar y medir. */
  proveedor: "anthropic" | "openai" | "enlatada";
};

/**
 * Responde con streaming, cambiando de modelo o de proveedor si hace falta.
 *
 * `respuestaEnlatada` es lo que se envía si todo falla: nunca dejamos al
 * socio sin respuesta.
 *
 * `aprId`/`origen` son solo para métricas (tabla UsoIA): identifican de
 * dónde vino la llamada y a qué comité cobrarle el costo, cuando aplica.
 * `aprId` es null para el asistente de la landing, que no pertenece a
 * ningún comité todavía.
 */
export async function responder({
  system,
  mensajes,
  maxTokens = 700,
  forzarComplejo = false,
  forzarSimple = false,
  respuestaEnlatada,
  aprId = null,
  origen,
}: {
  system: string;
  mensajes: Mensaje[];
  maxTokens?: number;
  /** Salta la clasificación y usa el modelo caro. */
  forzarComplejo?: boolean;
  /** Salta la clasificación y usa el modelo rápido (p. ej. el chat, donde importa responder en segundos). */
  forzarSimple?: boolean;
  respuestaEnlatada: string;
  aprId?: string | null;
  origen: string;
}): Promise<ResultadoIA> {
  const ultimo = mensajes.at(-1)?.texto ?? "";
  const simple = forzarSimple || (!forzarComplejo && esConsultaSimple(ultimo));
  const modelo = simple ? MODELO_SIMPLE : MODELO_COMPLEJO;

  const encoder = new TextEncoder();

  // 1. Anthropic, con dos reintentos ante errores transitorios.
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = new Anthropic();

    for (let intento = 0; intento < 3; intento++) {
      try {
        const stream = anthropic.messages.stream({
          model: modelo,
          max_tokens: maxTokens,
          system,
          messages: mensajes.map((m) => ({ role: m.rol, content: m.texto })),
        });

        // Esperamos el primer fragmento antes de dar el stream por bueno: si
        // el error llega ahí, todavía estamos a tiempo de cambiar de proveedor.
        const iterador = stream[Symbol.asyncIterator]();
        const primero = await iterador.next();

        return {
          proveedor: "anthropic",
          stream: new ReadableStream({
            async start(controller) {
              try {
                const emitir = (evento: Anthropic.MessageStreamEvent) => {
                  if (
                    evento.type === "content_block_delta" &&
                    evento.delta.type === "text_delta"
                  ) {
                    controller.enqueue(encoder.encode(evento.delta.text));
                  }
                };

                if (!primero.done) emitir(primero.value);

                while (true) {
                  const { done, value } = await iterador.next();
                  if (done) break;
                  emitir(value);
                }
              } catch {
                // Se cortó a mitad: cerramos con una nota en vez de dejar
                // la frase truncada.
                controller.enqueue(
                  encoder.encode(`\n\n${respuestaEnlatada}`)
                );
              } finally {
                controller.close();
                // finalMessage() no vuelve a pegarle a la red: junta lo que
                // ya se recibió durante el streaming. Se pide después de
                // cerrar para no demorar la respuesta al usuario.
                stream
                  .finalMessage()
                  .then((msg) => {
                    registrarUsoIa({
                      aprId,
                      origen,
                      proveedor: "anthropic",
                      modelo,
                      tokensEntrada: msg.usage.input_tokens,
                      tokensSalida: msg.usage.output_tokens,
                    });
                  })
                  .catch(() => {
                    // El stream se cortó a mitad: no hay usage confiable.
                  });
              }
            },
          }),
        };
      } catch (e) {
        if (esTransitorio(e) && intento < 2) {
          await esperar(1000 * 2 ** intento);
          continue;
        }
        break; // No es transitorio o se acabaron los reintentos: al respaldo.
      }
    }
  }

  // 2. OpenAI como respaldo.
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI();

      const stream = await openai.chat.completions.create({
        model: MODELO_RESPALDO,
        max_tokens: maxTokens,
        stream: true,
        // Sin esto el uso de tokens no viaja en el stream: llegaría siempre
        // en null y no habría forma de medir el costo del respaldo.
        stream_options: { include_usage: true },
        messages: [
          { role: "system", content: system },
          ...mensajes.map((m) => ({
            role: m.rol === "user" ? ("user" as const) : ("assistant" as const),
            content: m.texto,
          })),
        ],
      });

      return {
        proveedor: "openai",
        stream: new ReadableStream({
          async start(controller) {
            let entrada = 0;
            let salida = 0;
            try {
              for await (const parte of stream) {
                const texto = parte.choices[0]?.delta?.content;
                if (texto) controller.enqueue(encoder.encode(texto));
                // El chunk final trae usage y un choices vacío: no compite
                // con los chunks de texto de arriba.
                if (parte.usage) {
                  entrada = parte.usage.prompt_tokens;
                  salida = parte.usage.completion_tokens;
                }
              }
            } catch {
              controller.enqueue(encoder.encode(`\n\n${respuestaEnlatada}`));
            } finally {
              controller.close();
              if (entrada || salida) {
                registrarUsoIa({
                  aprId,
                  origen,
                  proveedor: "openai",
                  modelo: MODELO_RESPALDO,
                  tokensEntrada: entrada,
                  tokensSalida: salida,
                });
              }
            }
          },
        }),
      };
    } catch {
      // Cayeron los dos: seguimos a la respuesta enlatada.
    }
  }

  // 3. Sin proveedores. El socio recibe algo útil igual.
  registrarUsoIa({
    aprId,
    origen,
    proveedor: "enlatada",
    modelo: "ninguno",
    tokensEntrada: 0,
    tokensSalida: 0,
  });

  return {
    proveedor: "enlatada",
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(respuestaEnlatada));
        controller.close();
      },
    }),
  };
}

export type SitioGenerado = {
  sitioDescripcion: string;
  horarioAtencion: string;
  infoPago: string;
};

const CAMPOS_SITIO = {
  type: "object" as const,
  properties: {
    sitioDescripcion: {
      type: "string",
      description:
        "Párrafo de presentación del comité para su sitio público, 2-4 frases, en español chileno, tono cercano y directo. En primera persona plural (\"somos\", \"atendemos\").",
    },
    horarioAtencion: {
      type: "string",
      description:
        "Horario de atención de la oficina del comité, tal como debe mostrarse en el sitio. Si el texto de entrada no lo menciona, indica un horario de oficina típico de un comité rural chileno de forma genérica.",
    },
    infoPago: {
      type: "string",
      description:
        "Instrucciones de cómo y dónde pagar (efectivo en oficina, transferencia, etc.), redactadas para socios. Si el texto de entrada no da detalles de pago, deja solo lo que se pueda inferir con seguridad y evita inventar datos como números de cuenta.",
    },
  },
  required: ["sitioDescripcion", "horarioAtencion", "infoPago"],
};

const SYSTEM_GENERAR_SITIO = `Ayudas a un dirigente de un comité de Agua Potable Rural (APR) chileno a redactar el texto de la página web pública de su comité, a partir de un par de frases sueltas que él escribe.

Reglas:
- Nunca inventes montos, números de cuenta ni datos de contacto que no estén en lo que escribió el dirigente.
- Si falta un dato, redacta un texto genérico razonable para un comité rural chileno en vez de inventar cifras o datos específicos.
- Español chileno, natural, sin tecnicismos ni lenguaje de marketing.
- Responde solo llamando a la herramienta indicada, sin texto adicional.`;

/**
 * Convierte un par de frases sueltas del dirigente en los campos del sitio
 * público (descripción, horario, forma de pago). Sin streaming: es una
 * respuesta corta y estructurada, no una conversación.
 *
 * Mismo orden de respaldo que `responder()`, pero sin respuesta enlatada:
 * si los dos proveedores fallan, quien llama debe avisar que no se pudo
 * generar y dejar el formulario tal como estaba.
 */
export async function generarSitio(
  texto: string,
  aprId: string
): Promise<SitioGenerado | null> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic();
      const msg = await anthropic.messages.create({
        model: MODELO_COMPLEJO,
        max_tokens: 600,
        system: SYSTEM_GENERAR_SITIO,
        messages: [{ role: "user", content: texto }],
        tools: [
          {
            name: "completar_sitio",
            description: "Entrega los campos del sitio público del comité.",
            input_schema: CAMPOS_SITIO,
          },
        ],
        tool_choice: { type: "tool", name: "completar_sitio" },
      });

      registrarUsoIa({
        aprId,
        origen: "generar-sitio",
        proveedor: "anthropic",
        modelo: MODELO_COMPLEJO,
        tokensEntrada: msg.usage.input_tokens,
        tokensSalida: msg.usage.output_tokens,
      });

      const bloque = msg.content.find((b) => b.type === "tool_use");
      if (bloque && bloque.type === "tool_use") {
        return bloque.input as SitioGenerado;
      }
    } catch {
      // Sigue al respaldo.
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI();
      const res = await openai.chat.completions.create({
        model: MODELO_RESPALDO,
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${SYSTEM_GENERAR_SITIO}\n\nResponde solo un JSON con las claves "sitioDescripcion", "horarioAtencion" e "infoPago".`,
          },
          { role: "user", content: texto },
        ],
      });

      if (res.usage) {
        registrarUsoIa({
          aprId,
          origen: "generar-sitio",
          proveedor: "openai",
          modelo: MODELO_RESPALDO,
          tokensEntrada: res.usage.prompt_tokens,
          tokensSalida: res.usage.completion_tokens,
        });
      }

      const contenido = res.choices[0]?.message?.content;
      if (contenido) return JSON.parse(contenido) as SitioGenerado;
    } catch {
      // Sigue a null.
    }
  }

  return null;
}
