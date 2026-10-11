"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import {
  enviarMensajeDirectiva,
  marcarLeidoDirectiva,
} from "@/app/panel/conversaciones/actions";
import { escucharChat } from "@/lib/chat/cliente";
import type { MensajeChat } from "@/lib/chat-socio";
import { iniciales } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const horaCorta = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
});

export type ConversacionResumen = {
  socioId: string;
  nombre: string;
  ultimoMensaje: string;
  ultimaFecha: Date | null;
  sinLeer: number;
  /** La IA le pasó la conversación a una persona y nadie ha respondido. */
  necesitaHumano: boolean;
};

export function ConversacionesPanel({
  conversaciones,
}: {
  conversaciones: ConversacionResumen[];
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(
    conversaciones[0]?.socioId ?? null
  );
  // Se descuenta localmente al abrir un chat, sin esperar a recargar toda la lista.
  const [sinLeerLocal, setSinLeerLocal] = useState<Record<string, number>>(
    () => Object.fromEntries(conversaciones.map((c) => [c.socioId, c.sinLeer]))
  );

  if (conversaciones.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-[1.35rem] font-semibold tracking-tight">
          Conversaciones
        </h1>
        <p className="mt-8 rounded-xl border border-dashed border-border px-4 py-14 text-center text-[0.9rem] text-muted-foreground">
          Todavía no hay mensajes de ningún socio.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <h1 className="mb-4 text-[1.35rem] font-semibold tracking-tight">
        Conversaciones
      </h1>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr] overflow-hidden rounded-xl border border-border/60">
        <div className="flex flex-col overflow-y-auto border-r border-border/60 bg-card">
          {conversaciones.map((c) => (
            <button
              key={c.socioId}
              onClick={() => {
                setSeleccionado(c.socioId);
                setSinLeerLocal((prev) => ({ ...prev, [c.socioId]: 0 }));
              }}
              className={cn(
                "flex items-center gap-2.5 border-b border-border/50 p-3.5 text-left transition-colors hover:bg-muted/50",
                seleccionado === c.socioId && "bg-muted"
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[0.72rem] font-semibold text-muted-foreground">
                {iniciales(c.nombre)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.9rem] font-medium">
                  {c.nombre}
                </div>
                <div className="truncate text-[0.8rem] text-muted-foreground">
                  {c.ultimoMensaje}
                </div>
                {c.necesitaHumano && (
                  <span className="mt-1 inline-flex rounded-full bg-tertiary/20 px-2 py-0.5 text-[0.68rem] font-semibold text-tertiary-foreground">
                    Necesita respuesta humana
                  </span>
                )}
              </div>
              {sinLeerLocal[c.socioId] > 0 && (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.68rem] font-semibold text-primary-foreground">
                  {sinLeerLocal[c.socioId]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-col bg-background">
          {seleccionado ? (
            <ChatConSocio
              key={seleccionado}
              socioId={seleccionado}
              nombre={
                conversaciones.find((c) => c.socioId === seleccionado)
                  ?.nombre ?? ""
              }
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[0.9rem] text-muted-foreground">
              Elige una conversación
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatConSocio({
  socioId,
  nombre,
}: {
  socioId: string;
  nombre: string;
}) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [cargando, setCargando] = useState(true);
  const [entrada, setEntrada] = useState("");
  const [enviando, iniciarEnvio] = useTransition();
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCargando(true);
    fetch(`/api/panel/conversaciones/${socioId}/mensajes`)
      .then((r) => r.json())
      .then((data: MensajeChat[]) => setMensajes(data))
      .finally(() => setCargando(false));

    marcarLeidoDirectiva(socioId);

    return escucharChat<MensajeChat>(socioId, (mensaje) => {
      setMensajes((prev) => [...prev, mensaje]);
      if (mensaje.remitente === "SOCIO") marcarLeidoDirectiva(socioId);
    });
  }, [socioId]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  function enviar() {
    const texto = entrada.trim();
    if (!texto || enviando) return;
    setEntrada("");
    iniciarEnvio(async () => {
      await enviarMensajeDirectiva(socioId, texto);
    });
  }

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[0.72rem] font-semibold text-muted-foreground">
          {iniciales(nombre)}
        </span>
        <span className="font-medium">{nombre}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
        {cargando ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : mensajes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageCircle className="size-6" />
            <span className="text-[0.85rem]">Sin mensajes todavía</span>
          </div>
        ) : (
          mensajes.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex flex-col gap-0.5",
                m.remitente === "SOCIO" ? "items-start" : "items-end"
              )}
            >
              {m.remitente === "IA" && (
                <span className="flex items-center gap-1 px-1 text-[0.7rem] font-medium text-primary">
                  <Sparkles className="size-3" />
                  Asistente IA{m.requiereHumano ? " · necesita una persona" : ""}
                </span>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[0.88rem] leading-relaxed whitespace-pre-line",
                  m.remitente === "DIRECTIVA"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : m.remitente === "IA"
                      ? "rounded-br-md border border-primary/20 bg-primary/5 text-foreground"
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
        className="flex items-center gap-2 border-t border-border/60 p-3"
      >
        <Input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Escribe una respuesta…"
          maxLength={1000}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={enviando || !entrada.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </>
  );
}
