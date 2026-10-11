"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatearTelefono } from "@/lib/formato";
import {
  enlaceWhatsApp,
  mensajeInvitacionPortal,
  telefonoValidoParaWhatsApp,
} from "@/lib/whatsapp";

export type SocioInvitable = {
  id: string;
  nombre: string;
  telefono: string | null;
  conCuenta: boolean;
  /** Enlace personal de invitación; null si no se puede generar (sin enlace del comité). */
  invitacionUrl: string | null;
};

/**
 * La directiva invita a sus socios a la cuenta en línea: a cada uno con teléfono
 * se le abre WhatsApp con un enlace personal para que elija su clave. Los que no
 * tienen teléfono pueden pedir acceso con el enlace general del comité.
 */
export function InvitarPortalDialog({
  abierto,
  onAbiertoChange,
  socios,
  comite,
  urlSolicitud,
}: {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
  socios: SocioInvitable[];
  comite: { nombre: string; slug: string | null };
  /** Enlace general para pedir acceso (los que no tienen teléfono). */
  urlSolicitud: string | null;
}) {
  const [enviadas, setEnviadas] = useState<Set<string>>(new Set());

  const sinCuenta = socios.filter((s) => !s.conCuenta);
  const invitables = sinCuenta.filter(
    (s) => telefonoValidoParaWhatsApp(s.telefono) && s.invitacionUrl
  );
  const sinTelefono = sinCuenta.filter((s) => !telefonoValidoParaWhatsApp(s.telefono)).length;

  function enviar(s: SocioInvitable) {
    if (!s.telefono || !s.invitacionUrl) return;
    window.open(
      enlaceWhatsApp(s.telefono, mensajeInvitacionPortal(comite.nombre, s.nombre, s.invitacionUrl)),
      "_blank",
      "noopener"
    );
    setEnviadas((prev) => new Set(prev).add(s.id));
  }

  async function copiarGeneral() {
    if (!urlSolicitud) return;
    try {
      await navigator.clipboard.writeText(urlSolicitud);
      toast.success("Enlace copiado");
    } catch {
      // Sin permiso para el portapapeles: el enlace queda visible para copiarlo a mano.
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-12">
          <DialogTitle>Invitar al portal</DialogTitle>
          <DialogDescription>
            Cada socio recibe por WhatsApp un enlace personal para elegir su
            clave y ver su cuenta, sus boletas y sus recibos.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!comite.slug ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[0.9rem] text-muted-foreground">
              Primero define el enlace de tu comité en{" "}
              <Link
                href="/panel/configuracion"
                className="font-medium text-primary hover:underline"
              >
                Configuración
              </Link>
              : va dentro de cada invitación.
            </p>
          ) : invitables.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[0.9rem] text-muted-foreground">
              No hay socios por invitar: los que tienen teléfono ya crearon su
              cuenta.
            </p>
          ) : (
            <>
              <p className="mb-3 text-[0.85rem] text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground">
                  {invitables.length - invitables.filter((s) => enviadas.has(s.id)).length}
                </span>{" "}
                por invitar · el enlace vence en 14 días
              </p>
              <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
                {invitables.map((s) => {
                  const yaEnviada = enviadas.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{s.nombre}</div>
                        <div className="text-[0.78rem] tabular-nums text-muted-foreground">
                          {s.telefono && formatearTelefono(s.telefono)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={yaEnviada ? "outline" : "default"}
                        onClick={() => enviar(s)}
                      >
                        {yaEnviada ? <Check /> : <MessageCircle />}
                        {yaEnviada ? "Reenviar" : "Invitar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {comite.slug && sinTelefono > 0 && (
            <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3 text-[0.82rem] leading-relaxed text-muted-foreground">
              <strong className="font-medium text-foreground">
                {sinTelefono} {sinTelefono === 1 ? "socio no tiene" : "socios no tienen"} teléfono.
              </strong>{" "}
              Pueden pedir acceso con RUT desde este enlace, y tú los apruebas en
              Solicitudes:
              {urlSolicitud && (
                <button
                  type="button"
                  onClick={copiarGeneral}
                  className="mt-2 flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left font-mono text-[0.75rem] text-foreground hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 truncate">{urlSolicitud}</span>
                  <Copy className="size-3.5 shrink-0" />
                </button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-xl border-t border-border/60 px-5 py-3">
          <Button variant="outline" onClick={() => onAbiertoChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
