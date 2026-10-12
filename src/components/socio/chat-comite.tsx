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
import {
  BurbujaChat,
  CLASE_BARRA_ESCRIBIR,
  CLASE_BOTON_ENVIAR,
  CLASE_CAJA_ESCRIBIR,
  FONDO_CHAT,
} from "@/components/chat/burbuja";


/**
 * Chat directo con la directiva del comité — canal separado del asistente
 * de IA (AsistenteSocio): acá responde una persona, no un modelo, y puede
 * tardar. Reemplaza al bot de WhatsApp que se eliminó del producto.
 */
/** Hay algo nuevo que mostrar: mensajes nuevos o mensajes que pasaron a leídos. */
function cambio(a: MensajeChat[], b: MensajeChat[]) {
  const marcas = (l: MensajeChat[]) => l.filter((m) => m.leido).length * 1000 + l.filter((m) => m.editado).length;
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

  useEffect(() => {
    fetch("/api/socio/chat/mensajes")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => setMensajes(Array.isArray(data) ? (data as MensajeChat[]) : []))
      .catch(() => setMensajes([]))
      .finally(() => setCargando(false));

    const detener = escucharChat<MensajeChat>(socioId, (mensaje) => {
      setMensajes((prev) => agregarSinRepetir(prev, mensaje));
      if (mensaje.remitente !== "SOCIO") {
        setSinLeer((n) => (abiertoRef.current ? 0 : n + 1));
        if (abiertoRef.current) marcarLeidoSocio(slug);
      }
    });

    // Respaldo: si la conexión en vivo no avisa, se revisa el historial cada
    // pocos segundos mientras la pestaña está a la vista.
    const revisar = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/socio/chat/mensajes")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: unknown) => {
          if (Array.isArray(data)) {
            setMensajes((prev) => (cambio(prev, data as MensajeChat[]) ? (data as MensajeChat[]) : prev));
          }
        })
        .catch(() => undefined);
    }, 5_000);

    return () => {
      detener();
      window.clearInterval(revisar);
    };
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
      const r = await enviarMensajeSocio(slug, texto);
      // El mensaje propio se ve de inmediato; si luego llega el eco en vivo, no se repite.
      if (r.ok) setMensajes((prev) => agregarSinRepetir(prev, r.mensaje));
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
          <div className="flex shrink-0 items-center gap-2.5 bg-[#008069] px-4 py-3 text-white">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <MessageSquareText className="size-4.5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {nombreApr}
              </div>
              <div className="text-[0.74rem] text-white/80">
                Te responde alguien de la directiva
              </div>
            </div>
          </div>

          <div className={cn("flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-3", FONDO_CHAT)}>
            {cargando ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : mensajes.length === 0 ? (
              <p className="my-auto rounded-lg bg-white/70 px-3 py-2 text-center text-[0.85rem] text-neutral-600">
                Escríbele a tu comité — un dirigente te responderá apenas
                pueda.
              </p>
            ) : (
              mensajes.map((m) => (
                <BurbujaChat
                  key={m.id}
                  // En el portal «propio» es lo que escribe el socio.
                  tono={m.remitente === "SOCIO" ? "propio" : m.remitente === "IA" ? "ia" : "ajeno"}
                  lado={m.remitente === "SOCIO" ? "derecha" : "izquierda"}
                  fecha={m.createdAt}
                  leido={m.leido}
                  editado={m.editado}
                  etiqueta={m.remitente === "IA" ? "Asistente del comité · IA" : undefined}
                  ancho="max-w-[85%]"
                >
                  {m.contenido}
                </BurbujaChat>
              ))
            )}
            <div ref={finRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className={cn("shrink-0", CLASE_BARRA_ESCRIBIR)}
          >
            <Input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder="Escribe un mensaje"
              maxLength={1000}
              aria-label="Tu mensaje"
              className={CLASE_CAJA_ESCRIBIR}
            />
            <Button
              type="submit"
              disabled={enviando || !entrada.trim()}
              aria-label="Enviar"
              className={CLASE_BOTON_ENVIAR}
            >
              <Send className="size-[18px]" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
