"use client";

import { io } from "socket.io-client";

const EVENTO = "mensaje-nuevo";

/**
 * Escucha los mensajes nuevos del chat de un socio y devuelve la función que
 * deja de escuchar. Se conecta al servidor Socket.IO propio (ver lib/chat/tiempo-real.ts).
 */
export type OpcionesEscribiendo = {
  /** Quién soy yo en esta conversación: lo que escribe el otro es lo que se muestra. */
  de: "SOCIO" | "DIRECTIVA";
  alEscribir: (activo: boolean) => void;
};

export function escucharChat<T>(
  socioId: string,
  alRecibir: (mensaje: T) => void,
  escribiendo?: OpcionesEscribiendo
) {
  const socket = io(process.env.NEXT_PUBLIC_CHAT_URL!, {
    transports: ["websocket", "polling"],
    // Se pide un token nuevo en cada (re)conexión: dura minutos y se renueva solo.
    auth: (entregar) => {
      fetch(`/api/chat/token?socioId=${encodeURIComponent(socioId)}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : { token: "" }))
        .then((d: { token: string }) => entregar({ token: d.token }))
        .catch(() => entregar({ token: "" }));
    },
  });
  socket.on(EVENTO, alRecibir);

  const alEscribirElOtro = (d: { de?: string; activo?: boolean }) => {
    if (escribiendo && d.de !== escribiendo.de) escribiendo.alEscribir(d.activo === true);
  };
  socket.on("escribiendo", alEscribirElOtro);

  const detener = () => {
    socket.off(EVENTO, alRecibir);
    socket.off("escribiendo", alEscribirElOtro);
    socket.disconnect();
  };
  return Object.assign(detener, {
    /** Avisa a la otra persona que empecé o dejé de escribir. */
    avisarEscribiendo: (activo: boolean) => {
      if (!escribiendo || !socket.connected) return;
      socket.emit("escribiendo", {
        sala: `chat-socio-${socioId}`,
        de: escribiendo.de,
        activo,
      });
    },
  });
}
