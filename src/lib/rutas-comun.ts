/** Lo de las rutas que también usa el navegador: tipos y el orden por cercanía, sin tocar la base de datos. */

/** Una ruta de terreno lista para la pantalla: sus socios ya vienen en el orden del recorrido. */
export type RutaVista = {
  id: string;
  nombre: string;
  aprobada: boolean;
  /** La creó quien mira la pantalla. */
  propia: boolean;
  socioIds: string[];
};

/** Un arranque con los socios que abastece y, si el comité la marcó, su ubicación: sirve para armar y ordenar una ruta. */
export type ArranqueRuta = { id: string; nombre: string; lat: number | null; lng: number | null; socioIds: string[] };

/**
 * Ordena los socios por cercanía: parte del primero y va siempre al arranque más cercano que falta. Es una aproximación
 * (en línea recta, no por caminos). Los socios cuyo arranque no tiene ubicación quedan al final, en su orden.
 */
export function ordenarPorCercania(ids: string[], arranques: ArranqueRuta[]): string[] {
  const posDe = new Map<string, { lat: number; lng: number; arranque: string }>();
  for (const a of arranques) {
    if (a.lat === null || a.lng === null) continue;
    for (const s of a.socioIds) posDe.set(s, { lat: a.lat, lng: a.lng, arranque: a.id });
  }
  const conPos = ids.filter((id) => posDe.has(id));
  const sinPos = ids.filter((id) => !posDe.has(id));
  if (conPos.length <= 1) return ids;
  // Se avanza arranque por arranque, para que los socios de un mismo arranque queden juntos.
  const grupos = new Map<string, string[]>();
  for (const id of conPos) {
    const g = posDe.get(id)!.arranque;
    grupos.set(g, [...(grupos.get(g) ?? []), id]);
  }
  const lugar = (g: string) => posDe.get(grupos.get(g)![0])!;
  const faltan = new Set(grupos.keys());
  let actual = posDe.get(conPos[0])!.arranque;
  const orden: string[] = [];
  while (faltan.size > 0) {
    faltan.delete(actual);
    orden.push(...(grupos.get(actual) ?? []));
    if (faltan.size === 0) break;
    const a = lugar(actual);
    let mejor = "";
    let dMin = Infinity;
    for (const g of faltan) {
      const b = lugar(g);
      // Un grado de longitud mide menos que uno de latitud a esta latitud (Chile, ~38°S): se corrige para no equivocar al vecino.
      const d = (a.lat - b.lat) ** 2 + ((a.lng - b.lng) * 0.79) ** 2;
      if (d < dMin) {
        dMin = d;
        mejor = g;
      }
    }
    actual = mejor;
  }
  return [...orden, ...sinPos];
}
