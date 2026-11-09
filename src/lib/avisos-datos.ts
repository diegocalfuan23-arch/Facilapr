/**
 * Avisos entre las pestañas abiertas del mismo navegador: cuando una pestaña registra un pago, una compra o un sueldo,
 * las demás pestañas (por ejemplo la Caja) se actualizan en el momento, sin esperar la consulta periódica. Solo
 * funciona entre pestañas de un mismo navegador; lo que hace otra persona se ve en la siguiente consulta periódica.
 */

/** Cada cuánto vuelven a pedir sus datos las pantallas que se mantienen al día (solo mientras la pestaña se ve). */
export const INTERVALO_RAPIDO = 10_000;

/** Qué grupo de datos cambió: la pantalla que lo muestra lo vuelve a pedir. */
export type ClaveDatos = "caja" | "pagos" | "lecturas" | "remuneraciones" | "asistencia" | "activos";

const NOMBRE_CANAL = "facilapr-datos";
/** El aviso también llega a la propia pestaña: una pantalla abierta aquí se actualiza al guardar en un modal. */
const EVENTO_LOCAL = "facilapr-datos-local";
let emisor: BroadcastChannel | null = null;

/** Avisa a las otras pestañas que cambiaron estos datos. Si el navegador no lo permite, no pasa nada. */
export function avisarCambio(...claves: ClaveDatos[]) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<ClaveDatos[]>(EVENTO_LOCAL, { detail: claves }));
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
  const local = (e: Event) => alRecibir((e as CustomEvent<ClaveDatos[]>).detail);
  window.addEventListener(EVENTO_LOCAL, local);
  const canal = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(NOMBRE_CANAL);
  if (canal) {
    canal.onmessage = (e: MessageEvent) => {
      if (Array.isArray(e.data)) alRecibir(e.data as ClaveDatos[]);
    };
  }
  return () => {
    window.removeEventListener(EVENTO_LOCAL, local);
    canal?.close();
  };
}
