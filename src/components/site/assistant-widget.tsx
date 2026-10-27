"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Droplet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Mensaje = { rol: "user" | "assistant"; texto: string };

const SUGERENCIAS = [
  "¿Cuánto cuesta?",
  "¿Cómo funciona el panel de socios?",
  "¿Sirve para mi comité?",
];

const SALUDO =
  "Hola 👋 Soy el asistente de Facilapr. Puedo contarte cómo funciona, qué incluye cada plan o qué necesita tu comité para partir. ¿Qué te gustaría saber?";

export function AssistantWidget() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { rol: "assistant", texto: SALUDO },
  ]);
  const [entrada, setEntrada] = useState("");
  const [respondiendo, setRespondiendo] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function enviar(texto: string) {
    const pregunta = texto.trim();
    if (!pregunta || respondiendo) return;

    const historial: Mensaje[] = [...mensajes, { rol: "user", texto: pregunta }];
    setMensajes([...historial, { rol: "assistant", texto: "" }]);
    setEntrada("");
    setRespondiendo(true);

    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El saludo inicial es del cliente, no parte de la conversación real.
        body: JSON.stringify({ mensajes: historial.slice(1) }),
      });

      if (!res.ok || !res.body) {
        throw new Error("respuesta inválida");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acumulado = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        acumulado += decoder.decode(value, { stream: true });
        setMensajes([...historial, { rol: "assistant", texto: acumulado }]);
      }
    } catch {
      setMensajes([
        ...historial,
        {
          rol: "assistant",
          texto:
            "Disculpa, no pude responder en este momento. Escríbenos por el formulario de contacto y te ayudamos.",
        },
      ]);
    } finally {
      setRespondiendo(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar asistente" : "Abrir asistente"}
        className="fixed right-5 bottom-5 z-50 size-13 rounded-full shadow-lg"
      >
        {abierto ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </Button>

      {abierto && (
        <div className="fixed right-5 bottom-22 z-50 flex h-[520px] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-secondary">
              <Droplet className="size-4 fill-white text-white" />
            </span>
            <div>
              <div className="text-sm font-semibold">Asistente Facilapr</div>
              <div className="text-[0.75rem] text-muted-foreground">
                Responde al instante
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
            {mensajes.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.88rem] leading-relaxed",
                  m.rol === "user"
                    ? "self-end rounded-br-md bg-primary text-primary-foreground"
                    : "self-start rounded-bl-md bg-muted text-foreground"
                )}
              >
                {m.texto || (
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0.3s]" />
                  </span>
                )}
              </div>
            ))}

            {mensajes.length === 1 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-[0.8rem] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={finRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(entrada);
            }}
            className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-3"
          >
            <Input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder="Escribe tu consulta…"
              maxLength={2000}
              aria-label="Tu consulta"
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={respondiendo || !entrada.trim()}
              aria-label="Enviar"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
