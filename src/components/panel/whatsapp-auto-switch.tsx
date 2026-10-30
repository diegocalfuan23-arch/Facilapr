"use client";

import { useState } from "react";
import { cambiarComprobanteAuto } from "@/app/panel/configuracion/whatsapp-auto-actions";
import { Switch } from "@/components/ui/switch";

/** Interruptor: que el comprobante llegue solo por WhatsApp apenas se registra un pago de boleta. */
export function WhatsappAutoSwitch({ comprobante }: { comprobante: boolean }) {
  const [activo, setActivo] = useState(comprobante);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(v: boolean) {
    setError(null);
    setActivo(v);
    const r = await cambiarComprobanteAuto(v);
    if (!r.ok) {
      setActivo(!v);
      setError(r.error);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-border p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[1.05rem] font-semibold">WhatsApp automático</h2>
          <p className="mt-1 text-[0.9rem] text-muted-foreground">
            Si lo activas, cada vez que registres el pago de una boleta, el socio recibe su comprobante por WhatsApp sin que
            tengas que enviarlo. Solo le llega a los socios que marcaste como que aceptan WhatsApp (en Socios) y que tienen
            teléfono.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-[0.85rem] text-destructive">
              {error}
            </p>
          )}
        </div>
        <Switch checked={activo} onCheckedChange={cambiar} aria-label="Enviar el comprobante por WhatsApp automáticamente" />
      </div>
    </section>
  );
}
