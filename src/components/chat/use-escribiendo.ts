"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Estado «escribiendo…» de un chat. `otroEscribe` dice si la otra persona está
 * escribiendo ahora; `alTeclear` y `alDejarDeEscribir` avisan lo mío.
 *
 * Se apaga solo: si el aviso de «dejó de escribir» se pierde (se cortó la
 * señal), a los pocos segundos sin novedades deja de mostrarse.
 */
export function useEscribiendo() {
  const [otroEscribe, setOtroEscribe] = useState(false);
  const avisarRef = useRef<((activo: boolean) => void) | null>(null);
  const apagarOtro = useRef<number | undefined>(undefined);
  const apagarMio = useRef<number | undefined>(undefined);
  const ultimoAviso = useRef(0);

  useEffect(
    () => () => {
      window.clearTimeout(apagarOtro.current);
      window.clearTimeout(apagarMio.current);
    },
    []
  );

  /** Lo que dice el servidor: la otra persona empezó o dejó de escribir. */
  const alEscribirElOtro = useCallback((activo: boolean) => {
    window.clearTimeout(apagarOtro.current);
    setOtroEscribe(activo);
    if (activo) apagarOtro.current = window.setTimeout(() => setOtroEscribe(false), 5000);
  }, []);

  /** Conecta con la conexión en vivo (o la suelta con null). */
  const conectar = useCallback((avisar: ((activo: boolean) => void) | null) => {
    avisarRef.current = avisar;
  }, []);

  const alDejarDeEscribir = useCallback(() => {
    window.clearTimeout(apagarMio.current);
    if (ultimoAviso.current !== 0) avisarRef.current?.(false);
    ultimoAviso.current = 0;
  }, []);

  /** Se llama en cada tecla: avisa cada par de segundos y apaga tras una pausa. */
  const alTeclear = useCallback(() => {
    const ahora = Date.now();
    if (ahora - ultimoAviso.current > 2500) {
      avisarRef.current?.(true);
      ultimoAviso.current = ahora;
    }
    window.clearTimeout(apagarMio.current);
    apagarMio.current = window.setTimeout(alDejarDeEscribir, 3000);
  }, [alDejarDeEscribir]);

  return { otroEscribe, alEscribirElOtro, conectar, alTeclear, alDejarDeEscribir };
}
