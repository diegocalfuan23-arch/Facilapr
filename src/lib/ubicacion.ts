/** Cálculos de ubicación que usa el navegador: distancia, rumbo y precisión. Sin red ni base de datos. */

export type Punto = { lat: number; lng: number };

/** Hasta cuántos metros de error se da una marca por buena. Más que eso queda «por confirmar». */
export const PRECISION_BUENA_M = 20;

const RADIO_TIERRA_M = 6_371_000;
const aRad = (g: number) => (g * Math.PI) / 180;

/** Metros en línea recta entre dos puntos. */
export function distanciaM(a: Punto, b: Punto): number {
  const dLat = aRad(b.lat - a.lat);
  const dLng = aRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aRad(a.lat)) * Math.cos(aRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h));
}

/** El rumbo de `a` hacia `b`, en grados desde el norte (0 a 360). */
export function rumboGrados(a: Punto, b: Punto): number {
  const y = Math.sin(aRad(b.lng - a.lng)) * Math.cos(aRad(b.lat));
  const x = Math.cos(aRad(a.lat)) * Math.sin(aRad(b.lat)) - Math.sin(aRad(a.lat)) * Math.cos(aRad(b.lat)) * Math.cos(aRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const PUNTOS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"];

/** El rumbo en palabras: «al noroeste». */
export function textoRumbo(grados: number): string {
  const nombre = PUNTOS[Math.round(grados / 45) % 8];
  return nombre === "norte" || nombre === "sur" || nombre === "este" || nombre === "oeste" ? `hacia el ${nombre}` : `al ${nombre}`;
}

/** «350 m» o «1,2 km». */
export function textoDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros / 10) * 10 || Math.round(metros)} m`;
  return `${(metros / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} km`;
}
