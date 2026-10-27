"use client";

import { useMemo, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { desconectarMercadoPago } from "@/app/panel/configuracion/mercadopago-actions";
import { generarLinkPago } from "@/app/panel/pagos/link-pago-actions";
import { formatearPeriodo, saldo } from "@/lib/boletas";
import { cn } from "@/lib/utils";
import { enlaceWhatsApp, telefonoValidoParaWhatsApp, type DatosComiteWhatsApp } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SocioBuscador, type OpcionSocio } from "@/components/panel/socio-buscador";
import type { BoletaPendiente } from "@/components/panel/nuevo-pago-dialog";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/**
 * Link de pago de Mercado Pago para una boleta: se busca al socio, se elige la
 * boleta y se copia el link o se manda por WhatsApp. Cuando el socio paga,
 * Mercado Pago avisa y el pago queda registrado solo.
 */
export function LinkPagoDialog({
  socios,
  boletas,
  comite,
  modo,
  onCerrar,
}: {
  socios: OpcionSocio[];
  boletas: BoletaPendiente[];
  comite: DatosComiteWhatsApp;
  modo: "prueba" | "produccion";
  onCerrar: () => void;
}) {
  const [socio, setSocio] = useState<OpcionSocio | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; monto: number; periodo: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const delSocio = useMemo(
    () => boletas.filter((b) => b.socioId === socio?.id).sort((a, b) => a.periodo.localeCompare(b.periodo)),
    [boletas, socio]
  );

  async function crear(b: BoletaPendiente) {
    setError(null);
    setCargando(b.id);
    const r = await generarLinkPago(b.id);
    setCargando(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setLink({ url: r.url, monto: r.monto, periodo: b.periodo });
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona el link y cópialo a mano.");
    }
  }

  const texto = link
    ? `Hola ${socio?.nombre ?? ""}, te escribe ${comite.nombre}. Puedes pagar tu boleta de ${formatearPeriodo(link.periodo)} (${clp.format(link.monto)}) aquí: ${link.url}`
    : "";

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Link de pago
            <span
              className={
                modo === "produccion"
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[0.62rem] font-semibold tracking-wide text-emerald-800 uppercase"
                  : "rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[0.62rem] font-semibold tracking-wide text-amber-800 uppercase"
              }
            >
              {modo === "produccion" ? "Producción" : "Modo prueba"}
            </span>
          </DialogTitle>
          <DialogDescription>
            {link
              ? "Mándaselo al socio. Cuando pague, el pago queda registrado solo."
              : "Busca al socio y elige la boleta que quieres cobrar con Mercado Pago."}
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-muted/60 px-3.5 py-3 text-[0.88rem] break-all">{link.url}</div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => copiar(link.url)}>
                {copiado ? <Check /> : <Copy />}
                {copiado ? "Copiado" : "Copiar link"}
              </Button>
              {telefonoValidoParaWhatsApp(socio?.telefono) ? (
                <Button render={<a href={enlaceWhatsApp(socio!.telefono!, texto)} target="_blank" rel="noreferrer" />}>
                  <MessageCircle />
                  Enviar por WhatsApp
                </Button>
              ) : (
                <Button render={<a href={enlaceWhatsApp("", texto)} target="_blank" rel="noreferrer" />}>
                  <MessageCircle />
                  Elegir contacto en WhatsApp
                </Button>
              )}
            </div>
            <p className="text-[0.8rem] text-muted-foreground">
              Cobra {clp.format(link.monto)}, lo que falta de la boleta. El dinero llega a la cuenta de Mercado Pago de tu comité.
            </p>
          </div>
        ) : socios.length === 0 ? (
          <p className="rounded-lg bg-muted/60 px-3.5 py-3 text-[0.9rem] text-muted-foreground">
            No hay boletas con saldo por pagar.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <SocioBuscador socios={socios} onElegir={(s) => { setSocio(s); setError(null); }} />
            {socio && (
              <div className="flex flex-col gap-2">
                <div className="text-[0.82rem] font-medium">Boletas por pagar</div>
                {delSocio.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={cargando !== null}
                    onClick={() => crear(b)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3 text-left",
                      "transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-60"
                    )}
                  >
                    <span className="font-medium">{formatearPeriodo(b.periodo)}</span>
                    <span className="text-right text-[0.82rem] text-muted-foreground">
                      <span className="font-semibold tabular-nums text-foreground">
                        {clp.format(saldo(b.montoTotal, b.montoPagado))}
                      </span>{" "}
                      {cargando === b.id ? "creando link…" : "por pagar"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-[0.88rem] text-red-800">
            {error}
          </p>
        )}

        <DialogFooter className="sm:items-center sm:justify-between">
          <form action={desconectarMercadoPago}>
            <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
              Desconectar Mercado Pago
            </Button>
          </form>
          <Button variant="outline" onClick={onCerrar}>
            {link ? "Cerrar" : "Cancelar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
