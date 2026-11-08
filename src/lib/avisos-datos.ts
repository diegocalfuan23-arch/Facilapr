/**
 * Avisos entre las pestañas abiertas del mismo navegador: cuando una pestaña registra un pago, una compra o un sueldo,
 * las demás pestañas (por ejemplo la Caja) se actualizan en el momento, sin esperar la consulta periódica. Solo
 * funciona entre pestañas de un mismo navegador; lo que hace otra persona se ve en la siguiente consulta periódica.
 */

/** Cada cuánto vuelven a pedir sus datos las pantallas que se mantienen al día (solo mientras la pestaña se ve). */
export const INTERVALO_RAPIDO = 10_000;

/** Qué grupo de datos cambió: la pantalla que lo muestra lo vuelve a pedir. */
export type ClaveDatos = "caja" | "remuneraciones" | "asistencia" | "activos";

const NOMBRE_CANAL = "facilapr-datos";
let emisor: BroadcastChannel | null = null;

/** Avisa a las otras pestañas que cambiaron estos datos. Si el navegador no lo permite, no pasa nada. */
export function avisarCambio(...claves: ClaveDatos[]) {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    emisor ??= new BroadcastChannel(NOMBRE_CANAL);
    emisor.postMessage(claves);
  } catch {
    // Sin el aviso, la otra pestaña se pone al día en su próxima consulta periódica.
  }
}

/** Escucha los avisos de las otras pestañas. Devuelve la función que deja de escuchar. */
export function escucharCambios(alRecibir: (claves: ClaveDatos[]) => void) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const canal = new BroadcastChannel(NOMBRE_CANAL);
  canal.onmessage = (e: MessageEvent) => {
    if (Array.isArray(e.data)) alRecibir(e.data as ClaveDatos[]);
  };
  return () => canal.close();
}
