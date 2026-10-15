"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { generarEnlaceRestablecerClave } from "@/app/panel/socios/actions";
import { formatearRut } from "@/lib/formato";
import {
  enlaceWhatsApp,
  mensajeRestablecerClave,
  telefonoValidoParaWhatsApp,
} from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Socio = { id: string; nombre: string; rut: string | null; telefono: string | null };

/**
 * La clave del portal de socios no se recupera por correo (el socio entra con
 * RUT y no tiene un correo real). Si la olvida, la directiva le manda un enlace
 * y el socio elige la suya: la directiva nunca la ve ni la escribe, así no hay
 * una clave viajando por mensajes.
 */
export function RestablecerClaveDialog({
  socio,
  comite,
  onCerrar,
  onEnviado,
}: {
  socio: Socio;
  comite: { nombre: string };
  onCerrar: () => void;
  /** Se llama cuando la directiva mandó el enlace por WhatsApp o lo copió. */
  onEnviado?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    generarEnlaceRestablecerClave(socio.id)
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setUrl(r.url);
        else setError(r.error);
      })
      .catch(() => vivo && setError("No pudimos generar el enlace. Inténtalo de nuevo."));
    return () => {
      vivo = false;
    };
  }, [socio.id]);

  const puedeWhatsApp = telefonoValidoParaWhatsApp(socio.telefono);

  function enviar() {
    if (!url || !socio.telefono) return;
    window.open(
      enlaceWhatsApp(socio.telefono, mensajeRestablecerClave(comite.nombre, socio.nombre, url)),
      "_blank",
      "noopener"
    );
    onEnviado?.();
  }

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopiado(false), 2000);
      onEnviado?.();
    } catch {
      // Sin permiso para el portapapeles: el enlace queda visible para copiarlo a mano.
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="min-w-0 sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Nueva clave para {socio.nombre}</DialogTitle>
          <DialogDescription>
            {socio.rut ? `${formatearRut(socio.rut)} · ` : ""}
            El socio elige su clave con un enlace que le mandas. Tú nunca la ves.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[0.88rem] text-destructive">
            {error}
          </p>
        ) : !url ? (
          <div className="flex items-center gap-2 py-4 text-[0.9rem] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Preparando el enlace…
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            {puedeWhatsApp ? (
              <Button onClick={enviar} className="h-10">
                <MessageCircle />
                Enviar por WhatsApp
              </Button>
            ) : (
              <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-[0.84rem] text-muted-foreground">
                Este socio no tiene un teléfono válido. Copia el enlace y hazlo
                llegar a su teléfono.
              </p>
            )}

            <button
              type="button"
              onClick={copiar}
              className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left font-mono text-[0.72rem] hover:bg-muted"
            >
              <span className="min-w-0 flex-1 truncate">{url}</span>
              {copiado ? (
                <Check className="size-4 shrink-0 text-forest" />
              ) : (
                <Copy className="size-4 shrink-0" />
              )}
            </button>

            <p className="flex items-start gap-2 text-[0.8rem] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-forest" />
              El enlace es personal, sirve una sola vez y vence en 2 días. Al
              usarlo se cierran las sesiones que el socio tuviera abiertas.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
