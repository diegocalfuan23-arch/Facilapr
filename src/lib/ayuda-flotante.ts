"use client";

import { useSyncExternalStore } from "react";

const CLAVE = "facilapr-ayuda-oculta";
const EVENTO = "facilapr-ayuda-oculta-cambio";

function leer() {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

function suscribir(alCambiar: () => void) {
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

/** Si la persona ocultó la ayuda flotante (los botones «?» y de primeros pasos). Se recuerda en este navegador. */
export function useAyudaOculta() {
  return useSyncExternalStore(suscribir, leer, () => false);
}

export function ocultarAyuda(oculta: boolean) {
  try {
    if (oculta) localStorage.setItem(CLAVE, "1");
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento no se puede recordar: la ayuda sigue visible.
  }
  window.dispatchEvent(new Event(EVENTO));
}
