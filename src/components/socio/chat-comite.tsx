"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Droplets, Loader2, MessageCircle, SendHorizontal, Sparkles, X } from "lucide-react";
import {
  enviarMensajeSocio,
  marcarLeidoSocio,
} from "@/app/socio/[slug]/chat-actions";
import { escucharChat } from "@/lib/chat/cliente";
import type { MensajeChat } from "@/lib/chat-socio";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IndicadorEscribiendo } from "@/components/chat/burbuja";
import { useEscribiendo } from "@/components/chat/use-escribiendo";

/**
 * Chat directo con la directiva del comité — canal separado del asistente
 * de IA (AsistenteSocio): acá responde una persona, no un modelo, y puede
 * tardar. Reemplaza al bot de WhatsApp que se eliminó del producto.
 */
/** Hay algo nuevo que mostrar: mensajes nuevos o mensajes que pasaron a leídos. */
function cambio(a: MensajeChat[], b: MensajeChat[]) {
  const marcas = (l: MensajeChat[]) =>
    l.filter((m) => m.leido).length * 1000 + l.filter((m) => m.editado).length;
  return a.length !== b.length || marcas(a) !== marcas(b);
}

/** Agrega un mensaje solo si no está ya (el eco en vivo y la respuesta del envío pueden coincidir). */
function agregarSinRepetir(lista: MensajeChat[], m: MensajeChat) {
  return lista.some((x) => x.id === m.id) ? lista : [...lista, m];
}

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
  const {
    otroEscribe,
    alEscribirElOtro,
    conectar,
    alTeclear,
    alDejarDeEscribir,
  } = useEscribiendo();

  useEffect(() => {
    fetch("/api/socio/chat/mensajes")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) =>
        setMensajes(Array.isArray(data) ? (data as MensajeChat[]) : []),
      )
      .catch(() => setMensajes([]))
      .finally(() => setCargando(false));

    const detener = escucharChat<MensajeChat>(
      socioId,
      (mensaje) => {
        setMensajes((prev) => agregarSinRepetir(prev, mensaje));
        if (mensaje.remitente !== "SOCIO") {
          alEscribirElOtro(false);
          setSinLeer((n) => (abiertoRef.current ? 0 : n + 1));
          if (abiertoRef.current) marcarLeidoSocio(slug);
        }
      },
      { de: "SOCIO", alEscribir: alEscribirElOtro },
    );
    conectar(detener.avisarEscribiendo);

    // Respaldo: si la conexión en vivo no avisa, se revisa el historial cada
    // pocos segundos mientras la pestaña está a la vista.
    const revisar = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/socio/chat/mensajes")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: unknown) => {
          if (Array.isArray(data)) {
            setMensajes((prev) =>
              cambio(prev, data as MensajeChat[])
                ? (data as MensajeChat[])
                : prev,
            );
          }
        })
        .catch(() => undefined);
    }, 5_000);

    return () => {
      conectar(null);
      detener();
      window.clearInterval(revisar);
    };
  }, [socioId, slug, alEscribirElOtro, conectar]);

  useEffect(() => {
    abiertoRef.current = abierto;
  }, [abierto]);

  /** Abre o cierra el chat; al abrirlo, lo que había sin leer queda leído. */
  function alternar() {
    const abrir = !abierto;
    setAbierto(abrir);
    abiertoRef.current = abrir;
    if (abrir) {
      setSinLeer(0);
      marcarLeidoSocio(slug);
    }
  }

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, abierto, otroEscribe]);

  function enviar(atajo?: string) {
    const texto = (atajo ?? entrada).trim();
    if (!texto || enviando) return;
    setEntrada("");
    alDejarDeEscribir();
    iniciarEnvio(async () => {
      const r = await enviarMensajeSocio(slug, texto);
      // El mensaje propio se ve de inmediato; si luego llega el eco en vivo, no se repite.
      if (r.ok) setMensajes((prev) => agregarSinRepetir(prev, r.mensaje));
    });
  }

  // Con el chat vacío se ofrecen preguntas frecuentes: tocar una la envía tal cual.
  const ATAJOS = ["¿Cuánto debo?", "¿Cuál fue mi consumo?", "¿Hay cortes programados?", "Hablar con la directiva"];

  return (
    <>
      {abierto && (
        <div
          role="dialog"
          aria-label="Chat con tu comité"
          className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[min(600px,calc(100vh-8rem))] sm:w-[380px] sm:overflow-hidden sm:rounded-2xl sm:shadow-[0_24px_60px_rgba(21,19,43,0.22)]"
        >
          <div className="relative shrink-0 overflow-hidden bg-[#2A0FB0] px-5 pt-4 pb-4 text-white">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_80%_120%_at_100%_0%,#5B3CF0_0%,transparent_60%)]" />
            <div className="relative flex items-center gap-3">
              <span aria-hidden className="flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 ring-inset">
                <Droplets className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate leading-tight font-semibold">{nombreApr}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/75">
                  <span className="size-1.5 rounded-full bg-[#7CF0C4]" />
                  {otroEscribe ? "escribiendo…" : "En línea · te responde tu comité"}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Cerrar chat" onClick={alternar} className="size-9 rounded-lg text-white hover:bg-white/10 hover:text-white">
                <X />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#F7F6FB] px-4 py-4">
            {cargando ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : (
              <>
                {mensajes.length === 0 && (
                  <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-[14px] leading-relaxed shadow-[0_1px_2px_rgba(21,19,43,0.06)]">
                    Escríbele a tu comité: un dirigente te responderá apenas pueda. Si tienes dudas de tu saldo, tus boletas o tu consumo, puedes tocar una de las preguntas de abajo.
                  </div>
                )}
                <ul className="flex flex-col gap-2.5">
                  {mensajes.map((m) => {
                    const mio = m.remitente === "SOCIO";
                    return (
                      <li key={m.id} className={cn("flex", mio ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed", mio ? "rounded-br-md bg-[#3A0CE3] text-white" : "rounded-bl-md bg-white text-[#15132B] shadow-[0_1px_2px_rgba(21,19,43,0.06)]")}>
                          {!mio && (
                            <p className={cn("mb-0.5 flex items-center gap-1 text-[11px] font-semibold", m.remitente === "IA" ? "text-[#6B46F5]" : "text-[#0A7A52]")}>
                              {m.remitente === "IA" ? (
                                <>
                                  <Sparkles className="size-3" aria-hidden />
                                  Asistente
                                </>
                              ) : (
                                "Directiva"
                              )}
                            </p>
                          )}
                          <p className="break-words whitespace-pre-line">{m.contenido}</p>
                          <p className={cn("mt-0.5 text-right text-[10.5px]", mio ? "text-white/70" : "text-[#8A8799]")}>
                            {m.editado ? "editado · " : ""}
                            {new Date(m.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Santiago" })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {mensajes.length === 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {ATAJOS.map((a) => (
                      <button key={a} type="button" disabled={enviando} onClick={() => enviar(a)} className="rounded-full border border-[#DDD6FC] bg-white px-3 py-1.5 text-[13px] font-medium text-[#2A07A8] hover:bg-[#F4F1FF] disabled:opacity-60">
                        {a}
                      </button>
                    ))}
                  </div>
                )}
                {otroEscribe && (
                  <div className="mt-2.5">
                    <IndicadorEscribiendo />
                  </div>
                )}
              </>
            )}
            <div ref={finRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className="flex shrink-0 items-center gap-2 border-t border-[#F0EEF6] bg-white p-3"
          >
            <input
              aria-label="Tu mensaje"
              value={entrada}
              maxLength={1000}
              onChange={(e) => {
                setEntrada(e.target.value);
                if (e.target.value.trim()) alTeclear();
                else alDejarDeEscribir();
              }}
              placeholder="Escribe tu consulta…"
              className="h-11 min-w-0 flex-1 rounded-xl border border-[#E4E1F0] bg-[#FAFAFD] px-3.5 text-sm outline-none placeholder:text-[#9A98AB] focus:border-[#C4B7FA] focus:bg-white focus:ring-4 focus:ring-[#ECE8FD]"
            />
            <Button type="submit" size="icon" aria-label="Enviar" disabled={enviando || !entrada.trim()} className="size-11 shrink-0 rounded-xl">
              <SendHorizontal className="size-[18px]" />
            </Button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={alternar}
        aria-label={abierto ? "Cerrar chat" : "Abrir chat con tu comité"}
        className={cn(
          "fixed right-4 bottom-20 z-40 items-center gap-2 rounded-full bg-[#3A0CE3] p-4 font-semibold text-white shadow-[0_12px_28px_rgba(58,12,227,0.35)] transition-transform hover:-translate-y-0.5 sm:right-6 sm:bottom-6 sm:py-3 sm:pr-5 sm:pl-4",
          abierto ? "hidden sm:flex sm:pr-4" : "flex"
        )}
      >
        {abierto ? (
          <X className="size-5" />
        ) : (
          <>
            <span className="relative">
              <MessageCircle className="size-5" aria-hidden />
              {sinLeer > 0 && <span className="absolute -top-2.5 -right-2.5 flex size-4 items-center justify-center rounded-full bg-[#E5484D] text-[0.6rem] font-bold text-white ring-2 ring-[#3A0CE3]">{sinLeer}</span>}
            </span>
            <span className="hidden text-sm sm:inline">¿Dudas? Escríbenos</span>
          </>
        )}
      </button>
    </>
  );
}
