import { marcarUbicacion } from "@/app/panel/lecturas/ubicacion-actions";

/**
 * Cola local de ubicaciones marcadas sin señal. El GPS del teléfono funciona sin internet: la marca queda en el
 * teléfono y se envía sola cuando vuelve la conexión.
 */
export type UbicacionEnCola = { socioId: string; lat: number; lng: number; precision: number };

const CLAVE = "facilapr-ubicaciones-offline";

function leer(): UbicacionEnCola[] {
  try {
    const datos: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(datos) ? (datos as UbicacionEnCola[]) : [];
  } catch {
    return [];
  }
}

function escribir(cola: UbicacionEnCola[]) {
  try {
    if (cola.length) localStorage.setItem(CLAVE, JSON.stringify(cola));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: la marca se pierde si se cierra la app antes de tener señal */
  }
}

/** Guarda una marca en el teléfono. De un mismo socio solo cuenta la última. */
export function encolarUbicacion(u: UbicacionEnCola) {
  escribir([...leer().filter((x) => x.socioId !== u.socioId), u]);
}

let enviando = false;

/** Manda al servidor las ubicaciones guardadas en el teléfono. Si no hay conexión, quedan para la próxima. */
export async function enviarUbicacionesPendientes(): Promise<number> {
  if (enviando) return 0;
  enviando = true;
  let enviadas = 0;
  try {
    for (const u of leer()) {
      try {
        const r = await marcarUbicacion(u.socioId, u.lat, u.lng, u.precision);
        // Si el servidor la rechazó (por ejemplo, el socio ya no existe), no tiene sentido reintentarla.
        escribir(leer().filter((x) => x.socioId !== u.socioId));
        if (r.ok) enviadas++;
      } catch {
        break;
      }
    }
  } finally {
    enviando = false;
  }
  return enviadas;
}
