"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, MessageSquareText, Send, X } from "lucide-react";
import {
  enviarMensajeSocio,
  marcarLeidoSocio,
} from "@/app/socio/[slug]/chat-actions";
import { escucharChat } from "@/lib/chat/cliente";
import type { MensajeChat } from "@/lib/chat-socio";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const horaCorta = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Chat directo con la directiva del comité — canal separado del asistente
 * de IA (AsistenteSocio): acá responde una persona, no un modelo, y puede
 * tardar. Reemplaza al bot de WhatsApp que se eliminó del producto.
 */
export function ChatComite({
  socioId,
  slug,
  nombreApr,
}: {
  socioId: string;
  slug: string;
  nombreApr: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [cargando, setCargando] = useState(true);
  const [entrada, setEntrada] = useState("");
  const [enviando, iniciarEnvio] = useTransition();
  const [sinLeer, setSinLeer] = useState(0);
  const finRef = useRef<HTMLDivElement>(null);
  const abiertoRef = useRef(abierto);

  useEffect(() => {
    fetch("/api/socio/chat/mensajes")
      .then((r) => r.json())
      .then((data: MensajeChat[]) => setMensajes(data))
      .finally(() => setCargando(false));

    return escucharChat<MensajeChat>(socioId, (mensaje) => {
      setMensajes((prev) => [...prev, mensaje]);
      if (mensaje.remitente === "DIRECTIVA") {
        setSinLeer((n) => (abiertoRef.current ? 0 : n + 1));
        if (abiertoRef.current) marcarLeidoSocio(slug);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socioId, slug]);

  useEffect(() => {
    abiertoRef.current = abierto;
    if (abierto) {
      setSinLeer(0);
      marcarLeidoSocio(slug);
    }
  }, [abierto, slug]);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, abierto]);

  function enviar() {
    const texto = entrada.trim();
    if (!texto || enviando) return;
    setEntrada("");
    iniciarEnvio(async () => {
      await enviarMensajeSocio(slug, texto);
    });
  }

  return (
    <>
      <Button
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar chat" : "Abrir chat con tu comité"}
        title="Chat con tu comité"
        variant="outline"
        className="fixed right-5 bottom-22 z-50 size-13 rounded-full border-border bg-card shadow-lg"
      >
        {abierto ? (
          <X className="size-5" />
        ) : (
          <span className="relative">
            <MessageSquareText className="size-5" />
            {sinLeer > 0 && (
              <span className="absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-semibold text-primary-foreground">
                {sinLeer}
              </span>
            )}
          </span>
        )}
      </Button>

      {abierto && (
        <div className="fixed right-5 bottom-38 z-50 flex h-[480px] w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-secondary">
              <MessageSquareText className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                Chat con {nombreApr}
              </div>
              <div className="text-[0.75rem] text-muted-foreground">
                Te responde alguien de la directiva
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
            {cargando ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : mensajes.length === 0 ? (
              <p className="my-auto text-center text-[0.85rem] text-muted-foreground">
                Escríbele a tu comité — un dirigente te responderá apenas
                pueda.
              </p>
            ) : (
              mensajes.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col gap-0.5",
                    m.remitente === "SOCIO" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.88rem] leading-relaxed whitespace-pre-line",
                      m.remitente === "SOCIO"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-muted text-foreground"
                    )}
                  >
                    {m.contenido}
                  </div>
                  <span className="px-1 text-[0.7rem] text-muted-foreground">
                    {horaCorta.format(new Date(m.createdAt))}
                  </span>
                </div>
              ))
            )}
            <div ref={finRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-3"
          >
            <Input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder="Escribe tu mensaje…"
              maxLength={1000}
              aria-label="Tu mensaje"
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={enviando || !entrada.trim()}
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
