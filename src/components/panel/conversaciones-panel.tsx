"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import {
  enviarMensajeDirectiva,
  marcarLeidoDirectiva,
} from "@/app/panel/conversaciones/actions";
import { escucharChat } from "@/lib/chat/cliente";
import type { MensajeChat } from "@/lib/chat-socio";
import {
  formatearRut,
  formatearTelefono,
  iniciales,
  tiempoRelativo,
} from "@/lib/formato";
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
  rut: string | null;
  numeroCliente: string | null;
  tipo: "SOCIO" | "USUARIO";
  telefono: string | null;
  /** Lo que debe en total (CLP); 0 si está al día. */
  deuda: number;
};

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/** RUT · N.º de cliente · tipo, solo con lo que haya. */
function datosDelSocio(c: ConversacionResumen) {
  return [
    c.rut ? formatearRut(c.rut) : null,
    c.numeroCliente ? `N.º ${c.numeroCliente}` : null,
    c.tipo === "USUARIO" ? "Usuario" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Agrega un mensaje solo si no está ya (el eco en vivo y la respuesta del envío pueden coincidir). */
function agregarSinRepetir(lista: MensajeChat[], m: MensajeChat) {
  return lista.some((x) => x.id === m.id) ? lista : [...lista, m];
}

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

      <div className="grid min-h-0 flex-1 grid-cols-[380px_1fr] overflow-hidden rounded-xl border border-border/60">
        <div className="flex flex-col overflow-y-auto border-r border-border/60 bg-card">
          {conversaciones.map((c) => (
            <button
              key={c.socioId}
              onClick={() => {
                setSeleccionado(c.socioId);
                setSinLeerLocal((prev) => ({ ...prev, [c.socioId]: 0 }));
              }}
              className={cn(
                "flex items-center gap-4 border-b border-border/50 px-5 py-4 text-left transition-colors hover:bg-muted/50",
                seleccionado === c.socioId && "bg-muted"
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-[0.8rem] font-semibold text-muted-foreground">
                {iniciales(c.nombre)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.9rem] font-medium">
                    {c.nombre}
                  </span>
                  {c.ultimaFecha && (
                    <span className="shrink-0 text-[0.68rem] text-muted-foreground">
                      {tiempoRelativo(c.ultimaFecha)}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between gap-4">
                  <span className="truncate text-[0.76rem] tabular-nums text-muted-foreground">
                    {datosDelSocio(c)}
                  </span>
                  {c.deuda > 0 ? (
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-destructive">
                      Debe {clp.format(c.deuda)}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-forest/10 px-2.5 py-0.5 text-[0.7rem] font-semibold text-forest">
                      Al día
                    </span>
                  )}
                </div>
                <div className="mt-2 truncate text-[0.84rem] text-foreground/75">
                  {c.ultimoMensaje}
                </div>
                {c.necesitaHumano && (
                  <span className="mt-2 inline-flex rounded-full bg-tertiary/20 px-2.5 py-0.5 text-[0.7rem] font-semibold text-tertiary-foreground">
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
              socio={conversaciones.find((c) => c.socioId === seleccionado)}
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
  socio,
}: {
  socioId: string;
  socio: ConversacionResumen | undefined;
}) {
  const nombre = socio?.nombre ?? "";
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [cargando, setCargando] = useState(true);
  const [entrada, setEntrada] = useState("");
  const [enviando, iniciarEnvio] = useTransition();
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCargando(true);
    fetch(`/api/panel/conversaciones/${socioId}/mensajes`)
      .then((r) => (r.ok ? r.json() : []))
      // Si el servidor responde un error (p. ej. el plan ya no incluye el chat),
      // se muestra vacío en vez de romper la pantalla.
      .then((data: unknown) => setMensajes(Array.isArray(data) ? (data as MensajeChat[]) : []))
      .catch(() => setMensajes([]))
      .finally(() => setCargando(false));

    marcarLeidoDirectiva(socioId);

    const detener = escucharChat<MensajeChat>(socioId, (mensaje) => {
      setMensajes((prev) => agregarSinRepetir(prev, mensaje));
      if (mensaje.remitente === "SOCIO") marcarLeidoDirectiva(socioId);
    });

    // Respaldo: si por algo la conexión en vivo no avisa, el historial se
    // revisa cada pocos segundos mientras la pestaña está a la vista.
    const revisar = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/panel/conversaciones/${socioId}/mensajes`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: unknown) => {
          if (Array.isArray(data)) {
            setMensajes((prev) => (data.length !== prev.length ? (data as MensajeChat[]) : prev));
          }
        })
        .catch(() => undefined);
    }, 12_000);

    return () => {
      detener();
      window.clearInterval(revisar);
    };
  }, [socioId]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  function enviar() {
    const texto = entrada.trim();
    if (!texto || enviando) return;
    setEntrada("");
    iniciarEnvio(async () => {
      const r = await enviarMensajeDirectiva(socioId, texto);
      // El mensaje propio se ve de inmediato; si luego llega el eco en vivo, no se repite.
      if (r.ok) setMensajes((prev) => agregarSinRepetir(prev, r.mensaje));
    });
  }

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[0.72rem] font-semibold text-muted-foreground">
          {iniciales(nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{nombre}</div>
          {socio && (
            <div className="truncate text-[0.76rem] tabular-nums text-muted-foreground">
              {[
                datosDelSocio(socio),
                socio.telefono ? formatearTelefono(socio.telefono) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
        {socio && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[0.74rem] font-semibold",
              socio.deuda > 0
                ? "bg-destructive/10 text-destructive"
                : "bg-forest/10 text-forest"
            )}
          >
            {socio.deuda > 0 ? `Debe ${clp.format(socio.deuda)}` : "Al día"}
          </span>
        )}
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
