"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cambiarApareceEnBuscador } from "@/app/panel/configuracion/buscador-actions";
import { cambiarComprobanteAuto } from "@/app/panel/configuracion/whatsapp-auto-actions";
import { Switch } from "@/components/ui/switch";

type Resultado = { ok: true } | { ok: false; error: string };

/** Un interruptor con su texto de apoyo. Guarda al cambiarlo, sin pasar por el botón Guardar del bloque. */
function Interruptor({
  titulo,
  ayuda,
  nota,
  inicial,
  deshabilitado,
  guardar,
}: {
  titulo: string;
  ayuda: string;
  /** Aviso extra bajo la ayuda (por ejemplo, qué falta para poder activarlo). */
  nota?: string;
  inicial: boolean;
  deshabilitado?: boolean;
  guardar: (valor: boolean) => Promise<Resultado>;
}) {
  const [activo, setActivo] = useState(inicial);

  async function cambiar(v: boolean) {
    setActivo(v);
    const r = await guardar(v);
    if (r.ok) {
      toast.success("Guardado");
    } else {
      setActivo(!v);
      toast.error(r.error);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[0.9rem] font-medium">{titulo}</p>
        <p className="mt-0.5 text-[0.8rem] text-muted-foreground">{ayuda}</p>
        {nota && <p className="mt-0.5 text-[0.8rem] text-muted-foreground">{nota}</p>}
      </div>
      <Switch checked={activo} onCheckedChange={cambiar} disabled={deshabilitado} aria-label={titulo} />
    </div>
  );
}

/** Las preferencias del comité que se prenden y apagan: van juntas, bajo los datos del comité. */
export function AjustesComite({
  apareceEnBuscador,
  tieneSlug,
  whatsappDisponible,
  comprobanteAuto,
}: {
  apareceEnBuscador: boolean;
  tieneSlug: boolean;
  /** El envío por la API de WhatsApp está activo en el servidor. */
  whatsappDisponible: boolean;
  comprobanteAuto: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Interruptor
        titulo="Aparecer en el buscador de socios"
        ayuda="Tus socios te encuentran por nombre o comuna en facilapr.cl/socios y entran a su cuenta desde ahí. Solo se muestra el nombre y la comuna."
        nota={!tieneSlug && !apareceEnBuscador ? "Para activarlo, tu comité necesita su dirección propia (Mi sitio)." : undefined}
        inicial={apareceEnBuscador}
        deshabilitado={!tieneSlug && !apareceEnBuscador}
        guardar={cambiarApareceEnBuscador}
      />
      {whatsappDisponible && (
        <Interruptor
          titulo="Comprobante automático por WhatsApp"
          ayuda="Al registrar el pago de una boleta, el socio recibe su comprobante sin que tengas que enviarlo. Solo le llega a quienes marcaste que aceptan WhatsApp (en Socios) y tienen teléfono."
          inicial={comprobanteAuto}
          guardar={cambiarComprobanteAuto}
        />
      )}
    </div>
  );
}
