"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cambiarApareceEnBuscador } from "@/app/panel/configuracion/buscador-actions";
import { cambiarComprobanteAuto } from "@/app/panel/configuracion/whatsapp-auto-actions";
import { Switch } from "@/components/ui/switch";
import { CupoWhatsappInfo } from "@/components/panel/cupo-whatsapp";
import type { CupoWhatsapp } from "@/lib/whatsapp-cupo-comun";
import { ConectarWhatsapp, type ConexionWhatsapp } from "@/components/panel/conectar-whatsapp";

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

/** Aparecer en el buscador público: vive en el bloque del portal de socios. */
export function AjusteBuscador({ apareceEnBuscador, tieneSlug }: { apareceEnBuscador: boolean; tieneSlug: boolean }) {
  return (
    <div className="rounded-xl p-3.5 ring-1 ring-[#ECEAF4]">
      <Interruptor
        titulo="Aparecer en el buscador de comités"
        ayuda="Tus socios te encuentran por nombre o comuna en facilapr.cl/socios. Solo se muestran el nombre y la comuna."
        nota={!tieneSlug && !apareceEnBuscador ? "Para activarlo, primero define el enlace de tu portal." : undefined}
        inicial={apareceEnBuscador}
        deshabilitado={!tieneSlug && !apareceEnBuscador}
        guardar={cambiarApareceEnBuscador}
      />
    </div>
  );
}

/** Conexión de WhatsApp, cupo de mensajes y comprobante automático. */
export function AjustesWhatsapp({
  whatsappDisponible,
  cupo,
  comprobanteAuto,
  conexionDisponible,
  conexion,
}: {
  /** El envío por la API de WhatsApp está activo en el servidor. */
  whatsappDisponible: boolean;
  cupo: CupoWhatsapp | null;
  comprobanteAuto: boolean;
  /** Se puede conectar el WhatsApp propio del comité (la app de Meta está lista para eso). */
  conexionDisponible: boolean;
  conexion: ConexionWhatsapp | null;
}) {
  return (
    <>
      {conexionDisponible && <ConectarWhatsapp conexion={conexion} />}
      {whatsappDisponible && cupo && <CupoWhatsappInfo cupo={cupo} />}
      {whatsappDisponible && (
        <div className="rounded-xl p-3.5 ring-1 ring-[#ECEAF4]">
          <Interruptor
            titulo="Comprobante automático"
            ayuda="Al registrar un pago, el socio recibe su comprobante. Solo a quienes aceptan WhatsApp (en Socios) y tienen teléfono."
            inicial={comprobanteAuto}
            guardar={cambiarComprobanteAuto}
          />
        </div>
      )}
      {!conexionDisponible && !whatsappDisponible && (
        <p className="text-[13px] text-[#5B5970]">WhatsApp todavía no está disponible.</p>
      )}
    </>
  );
}
