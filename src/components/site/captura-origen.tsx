"use client";

import { useEffect } from "react";
import { CLAVE_ORIGEN } from "@/lib/origen";

/**
 * Guarda, la primera vez que alguien llega al sitio, de dónde viene: el buscador o la página que lo trajo (o una
 * campaña, si el enlace la trae) y qué página abrió primero. Al registrarse se envía junto con los datos del comité,
 * para saber qué canal trae comités. No guarda nada personal y no se vuelve a escribir en las visitas siguientes.
 */
export function CapturaOrigen() {
  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE_ORIGEN)) return;
      const params = new URLSearchParams(location.search);
      const referente = document.referrer ? new URL(document.referrer).hostname : "";
      const fuente = params.get("utm_source") || (referente && referente !== location.hostname ? referente : "directo");
      const campana = params.get("utm_campaign");
      localStorage.setItem(CLAVE_ORIGEN, `${fuente}${campana ? ` (${campana})` : ""} · ${location.pathname}`.slice(0, 160));
    } catch {
      // Sin almacenamiento (modo privado, bloqueado): el registro funciona igual, sin origen.
    }
  }, []);

  return null;
}
