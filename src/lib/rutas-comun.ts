/** Lo de las rutas que también usa el navegador: tipos y el orden por cercanía, sin tocar la base de datos. */
import { distanciaM } from "@/lib/ubicacion";

/** Una ruta de terreno lista para la pantalla: sus socios ya vienen en el orden del recorrido. */
export type RutaVista = {
  id: string;
  nombre: string;
  aprobada: boolean;
  /** La creó quien mira la pantalla. */
  propia: boolean;
  socioIds: string[];
};

/** Una labor dentro de una ruta: en cuántas paradas de la ruta se hace y cuántas ya se hicieron. */
export type LaborEnRuta = { id: string; numero: number; titulo: string; tipo: string; fecha: string; estado: "PROGRAMADA" | "EN_CURSO" | "HECHA"; paradas: number; hechas: number };

/** Un arranque con los socios que abastece y, si el comité la marcó, su ubicación: sirve para armar y ordenar una ruta. */
export type ArranqueRuta = { id: string; nombre: string; lat: number | null; lng: number | null; socioIds: string[] };

/**
 * Ordena los socios por cercanía: parte del primero y va siempre al más cercano que falta. Usa la ubicación marcada de cada
 * socio y, si no tiene, la de su arranque. Es una aproximación en línea recta, no por caminos. Los que no tienen ninguna
 * ubicación quedan al final, en su orden.
 */
export function ordenarPorCercania(ids: string[], arranques: ArranqueRuta[], socios: { id: string; lat?: number | null; lng?: number | null }[] = []): string[] {
  const posDe = new Map<string, { lat: number; lng: number }>();
  for (const a of arranques) {
    if (a.lat === null || a.lng === null) continue;
    for (const s of a.socioIds) posDe.set(s, { lat: a.lat, lng: a.lng });
  }
  // La ubicación marcada del socio manda sobre la de su arranque.
  for (const s of socios) if (s.lat != null && s.lng != null) posDe.set(s.id, { lat: s.lat, lng: s.lng });

  const conPos = ids.filter((id) => posDe.has(id));
  const sinPos = ids.filter((id) => !posDe.has(id));
  if (conPos.length <= 1) return ids;

  // Un grado de longitud mide menos que uno de latitud (Chile, ~38°S): se corrige para no equivocar al vecino.
  const dist = (a: string, b: string) => {
    const pa = posDe.get(a)!;
    const pb = posDe.get(b)!;
    return (pa.lat - pb.lat) ** 2 + ((pa.lng - pb.lng) * 0.79) ** 2;
  };
  const faltan = new Set(conPos.slice(1));
  const orden = [conPos[0]];
  while (faltan.size > 0) {
    const ultimo = orden[orden.length - 1];
    let mejor = "";
    let dMin = Infinity;
    for (const id of faltan) {
      const d = dist(ultimo, id);
      if (d < dMin) {
        dMin = d;
        mejor = id;
      }
    }
    faltan.delete(mejor);
    orden.push(mejor);
  }
  return [...orden, ...sinPos];
}

const COLORES_RUTA = ["#3A0CE3", "#0E9F6E", "#E07B00", "#0B84C6", "#B4419A", "#C2410C", "#4F46E5"];

/** Un color estable para cada ruta, sacado de su id: así no hay que guardarlo. */
export function colorRuta(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES_RUTA[h % COLORES_RUTA.length];
}

/**
 * Lo que mide una ruta según las ubicaciones marcadas: kilómetros en línea recta entre un socio y el siguiente, un tiempo
 * aproximado (6 min por socio y 4 por km) y cuántos socios aún no tienen ubicación.
 */
export function medirRuta(ids: string[], porId: Map<string, { lat?: number | null; lng?: number | null }>) {
  let metros = 0;
  let previo: { lat: number; lng: number } | null = null;
  let conUbicacion = 0;
  for (const id of ids) {
    const s = porId.get(id);
    if (s?.lat == null || s.lng == null) continue;
    const p = { lat: s.lat, lng: s.lng };
    conUbicacion++;
    if (previo) metros += distanciaM(previo, p);
    previo = p;
  }
  const km = metros / 1000;
  return { km, minutos: Math.round(ids.length * 6 + km * 4), sinUbicacion: ids.length - conUbicacion };
}

export const textoKm = (km: number) => `${km.toFixed(1).replace(".", ",")} km`;
export const textoMinutos = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** «2026-11-19» como «19 nov». */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${MESES[m - 1]}` : iso;
}
