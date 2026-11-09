/**
 * Cola local de lecturas para cuando el operador no tiene señal en terreno.
 *
 * Las lecturas se guardan en el localStorage del teléfono y se envían con la
 * misma acción de siempre (registrarLectura) cuando vuelve la conexión. Así
 * una lectura sin red no se pierde, y el servidor sigue aplicando las mismas
 * validaciones: nada de esto se salta la revisión del administrador.
 *
 * Es un store externo (suscripción + snapshot) para poder leerlo con
 * useSyncExternalStore sin desajustes de hidratación.
 */

export type LecturaEnCola = {
  idLocal: string;
  socioId: string;
  socioNombre: string;
  periodo: string;
  valor: string;
  observacion: string;
  /** Cambio de medidor: «1» si lo hubo y lo que marcaba el viejo (las lecturas guardadas antes de esto no traen estos campos). */
  medidorCambiado?: string;
  lecturaFinalAnterior?: string;
  guardadaEn: number;
};

const CLAVE = "facilapr-lecturas-offline";
const EVENTO = "facilapr-cola-lecturas";

/** Lo que ve el servidor al renderizar: cola vacía. */
export const COLA_VACIA = "[]";

function leerCrudo(): string {
  try {
    return localStorage.getItem(CLAVE) ?? COLA_VACIA;
  } catch {
    return COLA_VACIA;
  }
}

export function parsearCola(crudo: string): LecturaEnCola[] {
  try {
    const datos: unknown = JSON.parse(crudo);
    return Array.isArray(datos) ? (datos as LecturaEnCola[]) : [];
  } catch {
    return [];
  }
}

export function snapshotCola(): string {
  return leerCrudo();
}

export function suscribirCola(aviso: () => void) {
  window.addEventListener("storage", aviso);
  window.addEventListener(EVENTO, aviso);
  return () => {
    window.removeEventListener("storage", aviso);
    window.removeEventListener(EVENTO, aviso);
  };
}

function escribir(cola: LecturaEnCola[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(cola));
  } catch {
    // Sin almacenamiento no hay dónde guardar: quien llama lo informa.
    return false;
  }
  window.dispatchEvent(new Event(EVENTO));
  return true;
}

/** Devuelve false si el teléfono no dejó guardar (almacenamiento lleno o bloqueado). */
export function encolarLectura(
  lectura: Omit<LecturaEnCola, "idLocal" | "guardadaEn">
) {
  const cola = parsearCola(leerCrudo());
  cola.push({
    ...lectura,
    idLocal: crypto.randomUUID(),
    guardadaEn: Date.now(),
  });
  return escribir(cola);
}

export function quitarDeCola(idLocal: string) {
  escribir(parsearCola(leerCrudo()).filter((l) => l.idLocal !== idLocal));
}

/** Estado de conexión del navegador como store para useSyncExternalStore. */
export function suscribirConexion(aviso: () => void) {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
}

export const hayConexion = () => navigator.onLine;
