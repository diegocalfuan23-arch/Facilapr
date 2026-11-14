"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Evento de Chrome/Android que no está en los tipos del DOM. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CLAVE_OCULTO = "facilapr-instalar-oculto";

/** true solo en el navegador, sin desajuste de hidratación (el servidor ve false). */
function useMontado() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function yaInstalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS no soporta display-mode: usa esta propiedad propia.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function fueDescartada() {
  try {
    return localStorage.getItem(CLAVE_OCULTO) === "1";
  } catch {
    // Sin almacenamiento (modo privado): no recordamos el cierre.
    return false;
  }
}

/**
 * Invita al socio a poner el panel en la pantalla de inicio. Android abre el
 * diálogo nativo; iOS no tiene API de instalación, así que ahí solo se
 * explica el gesto (Compartir → Añadir a pantalla de inicio). Si ya está
 * instalada o el socio la descartó, no aparece.
 */
export function InstalarApp({
  titulo = "Ten tu cuenta a mano",
  descripcion = "Instálala en tu celular como una app.",
  compacto = false,
}: {
  titulo?: string;
  descripcion?: string;
  /** Una sola fila discreta (ícono, texto, botón), para ponerla bajo el contenido sin robar protagonismo. */
  compacto?: boolean;
}) {
  const montado = useMontado();
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    const alPreguntar = (e: Event) => {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", alPreguntar);
    return () => window.removeEventListener("beforeinstallprompt", alPreguntar);
  }, []);

  if (!montado || cerrado || yaInstalada() || fueDescartada()) return null;

  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  // Solo se muestra donde hay algo útil que ofrecer.
  if (!evento && !esIOS) return null;

  function descartar() {
    setCerrado(true);
    try {
      localStorage.setItem(CLAVE_OCULTO, "1");
    } catch {
      // ver fueDescartada
    }
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    if (outcome === "accepted") setCerrado(true);
  }

  if (compacto) {
    return (
      <div className="flex items-center gap-4 rounded-2xl bg-card p-3 shadow-[0_6px_18px_rgba(58,12,227,0.1)]">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Smartphone className="size-5" />
        </span>
        <p className="min-w-0 flex-1 text-[0.8rem] leading-snug font-medium text-muted-foreground">
          {evento ? (
            descripcion
          ) : (
            <>
              Toca <Share className="inline size-4 align-text-bottom" /> <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.
            </>
          )}
        </p>
        {evento && (
          <Button size="sm" className="h-9 shrink-0 rounded-full px-4 font-semibold" onClick={instalar}>
            Instalar app
          </Button>
        )}
        <button type="button" onClick={descartar} aria-label="Ocultar aviso" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#E4DEFC] bg-white/80 px-3.5 py-2.5">
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#ECE8FD] text-[#3A0CE3]">
        <Smartphone className="size-4" />
      </span>
      <p className="min-w-0 flex-1 text-[13px]">
        <b className="font-semibold">{titulo}.</b>{" "}
        <span className="hidden text-[#5B5970] sm:inline">
          {evento ? (
            descripcion
          ) : (
            <>
              Toca <Share className="inline size-3.5 align-text-bottom" /> <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.
            </>
          )}
        </span>
      </p>
      {evento && (
        <Button size="sm" className="h-8 rounded-lg px-3 text-xs font-semibold" onClick={instalar}>
          Instalar
        </Button>
      )}
      <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={descartar} className="size-8 rounded-lg text-[#8A8799]">
        <X className="size-4" />
      </Button>
    </div>
  );
}
