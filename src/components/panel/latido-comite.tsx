"use client";

import { useEffect } from "react";
import { latidoPanel } from "@/app/panel/conversaciones/actions";

/**
 * Avisa cada 25 segundos que la directiva tiene el panel abierto y a la vista.
 * Sirve para que la IA del chat, en el modo «cuando no esté disponible», sepa si
 * hay alguien conectado y espere antes de contestar. No pinta nada.
 */
export function LatidoComite() {
  useEffect(() => {
    const latir = () => {
      if (document.visibilityState === "visible") void latidoPanel();
    };
    latir();
    const cada = window.setInterval(latir, 25_000);
    document.addEventListener("visibilitychange", latir);
    return () => {
      window.clearInterval(cada);
      document.removeEventListener("visibilitychange", latir);
    };
  }, []);

  return null;
}
