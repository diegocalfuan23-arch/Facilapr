"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  conectarWhatsapp,
  desconectarWhatsapp,
} from "@/app/panel/configuracion/whatsapp-conexion-actions";
import { Button } from "@/components/ui/button";
import { META_APP_ID, META_CONFIG_ID } from "@/lib/meta-ids";

/**
 * Conectar el WhatsApp del comité con el registro insertado (Embedded Signup) de
 * Meta: se abre una ventana de Meta, el comité elige o crea su cuenta y verifica
 * su número, y vuelven el código de acceso (por el SDK) y los ids de su cuenta y
 * número (por un mensaje de la ventana). Con los dos el servidor termina la conexión.
 */

/** Versión del SDK de JavaScript de Meta. */
const VERSION_SDK = "v26.0";

/** Valores que Meta documenta para conectar un número que ya está en la app WhatsApp Business (coexistencia). */
const EXTRAS_COEXISTENCIA = {
  setup: {},
  featureType: "whatsapp_business_app_onboarding",
  sessionInfoVersion: "3",
};

type RespuestaLogin = { authResponse?: { code?: string } | null };

declare global {
  interface Window {
    FB?: {
      init: (opciones: Record<string, unknown>) => void;
      login: (alTerminar: (r: RespuestaLogin) => void, opciones: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function cargarSdk(): Promise<void> {
  return new Promise((resolver, rechazar) => {
    if (window.FB) return resolver();
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: true, version: VERSION_SDK });
      resolver();
    };
    if (document.getElementById("facebook-jssdk")) return;
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onerror = () => rechazar(new Error("No pudimos cargar la ventana de Meta. Revisa tu conexión."));
    document.body.appendChild(script);
  });
}

export type ConexionWhatsapp = {
  numeroMostrado: string | null;
  nombreVerificado: string | null;
  estado: "CONECTADA" | "ERROR";
  ultimoError: string | null;
};

/** Lo que llega de Meta, en dos tiempos: el código (SDK) y los ids (mensaje de la ventana). */
type Sesion = {
  code: string | null;
  /** En coexistencia Meta puede devolver solo la cuenta; el servidor busca el número. */
  ids: { wabaId: string; phoneNumberId?: string } | null;
  coexistencia: boolean;
  enviada: boolean;
};

export function ConectarWhatsapp({ conexion }: { conexion: ConexionWhatsapp | null }) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const sesion = useRef<Sesion>({ code: null, ids: null, coexistencia: false, enviada: false });
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function finalizar() {
    const s = sesion.current;
    if (s.enviada || !s.code || !s.ids) return;
    s.enviada = true;
    if (espera.current) clearTimeout(espera.current);

    const r = await conectarWhatsapp({
      code: s.code,
      wabaId: s.ids.wabaId,
      phoneNumberId: s.ids.phoneNumberId,
      coexistencia: s.coexistencia,
    });
    setTrabajando(false);
    if (r.ok) {
      toast.success(r.numero ? `WhatsApp conectado: ${r.numero}` : "WhatsApp conectado");
      if (r.avisos.length > 0) toast.message("Algunas plantillas no se pudieron crear. Reintenta en unos minutos.");
    } else {
      toast.error(r.error);
    }
    router.refresh();
  }

  // La ventana de Meta avisa por mensaje a qué cuenta y número quedó conectado el comité.
  useEffect(() => {
    function alMensaje(e: MessageEvent) {
      if (!e.origin.endsWith("facebook.com")) return;
      let d: { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string; error_message?: string } };
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (d?.type !== "WA_EMBEDDED_SIGNUP") return;

      if (typeof d.event === "string" && d.event.startsWith("FINISH")) {
        const { waba_id, phone_number_id } = d.data ?? {};
        // Con coexistencia basta la cuenta; con el flujo normal hacen falta la cuenta y el número.
        if (waba_id && (phone_number_id || sesion.current.coexistencia)) {
          sesion.current.ids = {
            wabaId: String(waba_id),
            phoneNumberId: phone_number_id ? String(phone_number_id) : undefined,
          };
          void finalizar();
        }
      } else if (d.event === "CANCEL") {
        setTrabajando(false);
      } else if (d.event === "ERROR") {
        setTrabajando(false);
        toast.error(d.data?.error_message ?? "Meta no pudo completar la conexión.");
      }
    }
    window.addEventListener("message", alMensaje);
    return () => window.removeEventListener("message", alMensaje);
    // finalizar usa solo referencias y el router: no hace falta volver a escuchar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function conectar(coexistencia = false) {
    setTrabajando(true);
    try {
      await cargarSdk();
    } catch (e) {
      setTrabajando(false);
      toast.error(e instanceof Error ? e.message : "No pudimos abrir la ventana de Meta.");
      return;
    }

    sesion.current = { code: null, ids: null, coexistencia, enviada: false };
    window.FB?.login(
      (r) => {
        const code = r.authResponse?.code;
        if (!code) {
          setTrabajando(false);
          return;
        }
        sesion.current.code = code;
        void finalizar();
        // Si el código llegó pero Meta no avisó la cuenta, no se queda esperando para siempre.
        espera.current = setTimeout(() => {
          if (!sesion.current.enviada) {
            setTrabajando(false);
            toast.error("Meta no terminó de confirmar tu cuenta. Vuelve a intentarlo.");
          }
        }, 15000);
      },
      {
        config_id: META_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: coexistencia ? EXTRAS_COEXISTENCIA : { setup: {} },
      }
    );
  }

  async function desconectar() {
    setTrabajando(true);
    await desconectarWhatsapp();
    setTrabajando(false);
    toast.success("WhatsApp desconectado");
    router.refresh();
  }

  const conectada = conexion?.estado === "CONECTADA";

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[0.9rem] font-medium">Tu número de WhatsApp</p>
        <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
          {conectada
            ? `Tus mensajes salen desde ${conexion?.numeroMostrado ?? "tu número"}${conexion?.nombreVerificado ? ` (${conexion.nombreVerificado})` : ""}. Meta cobra los mensajes directo a tu cuenta.`
            : "Conecta el WhatsApp de tu comité para que los mensajes salgan desde tu propio número. Si ya usas la app WhatsApp Business en tu celular, puedes conectar ese mismo número y seguir usándola. Meta cobra los mensajes directo a tu cuenta, sin pasar por Facilapr."}
        </p>
        {conexion?.estado === "ERROR" && (
          <p className="mt-0.5 text-[0.8rem] text-destructive">
            La conexión no se pudo terminar{conexion.ultimoError ? `: ${conexion.ultimoError}` : "."} Vuelve a conectarla.
          </p>
        )}
      </div>
      {conectada ? (
        <Button type="button" variant="outline" size="sm" onClick={desconectar} disabled={trabajando}>
          {trabajando && <Loader2 className="animate-spin" />}
          Desconectar
        </Button>
      ) : (
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Button type="button" size="sm" onClick={() => conectar(false)} disabled={trabajando}>
            {trabajando && <Loader2 className="animate-spin" />}
            {conexion ? "Reintentar" : "Conectar mi WhatsApp"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => conectar(true)} disabled={trabajando}>
            Ya uso WhatsApp Business
          </Button>
        </div>
      )}
    </div>
  );
}
