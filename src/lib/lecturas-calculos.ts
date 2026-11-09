/**
 * Cálculos de la pantalla de Lecturas que no tocan la base de datos: consumo de una lectura, promedio de un
 * socio y orden de la ruta. Los usa el navegador, así que no importan nada del servidor.
 */

export type LecturaCalculo = {
  id: string;
  socioId: string;
  periodo: string;
  valor: number;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  inicial: boolean;
  /** La última lectura aprobada del socio (la base de la que está pendiente). */
  anterior: number | null;
  /** Cambio de medidor: `valor` es lo que lleva el medidor nuevo (parte en 0) y `finalAnterior` lo que marcaba el viejo. */
  medidorCambiado?: boolean;
  finalAnterior?: number | null;
};

/** Consumo de una lectura contra su base; si hubo cambio de medidor, suma el tramo del viejo y el del nuevo. */
export function consumoContra(l: Pick<LecturaCalculo, "valor" | "medidorCambiado" | "finalAnterior">, base: number): number {
  return l.medidorCambiado ? (l.finalAnterior != null ? l.finalAnterior - base : 0) + l.valor : l.valor - base;
}

/** Las lecturas aprobadas de cada socio, de la más antigua a la más reciente. */
export function aprobadasPorSocio<T extends LecturaCalculo>(lecturas: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const l of lecturas) {
    if (l.estado !== "APROBADA") continue;
    const lista = m.get(l.socioId) ?? [];
    lista.push(l);
    m.set(l.socioId, lista);
  }
  for (const lista of m.values()) lista.sort((a, b) => (a.periodo < b.periodo ? -1 : a.periodo > b.periodo ? 1 : 0));
  return m;
}

/**
 * La lectura contra la que se mide el consumo: para una pendiente o rechazada, la última aprobada del socio;
 * para una aprobada, la aprobada que la precede. Null si es la primera (o la anterior quedó fuera de lo cargado).
 */
export function anteriorDe(l: LecturaCalculo, aprobadas: Map<string, LecturaCalculo[]>): number | null {
  if (l.estado !== "APROBADA") return l.anterior;
  if (l.inicial) return null;
  const previas = (aprobadas.get(l.socioId) ?? []).filter((x) => x.periodo < l.periodo);
  return previas.length ? previas[previas.length - 1].valor : null;
}

/** El consumo de una lectura (m³): null si no hay una anterior con la que compararla. */
export function consumoDe(l: LecturaCalculo, aprobadas: Map<string, LecturaCalculo[]>): number | null {
  const ant = anteriorDe(l, aprobadas);
  return ant === null ? null : consumoContra(l, ant);
}

/** El consumo mensual típico de un socio: el promedio de sus últimos meses aprobados (hasta 6). Null si no hay base. */
export function promedioDe(socioId: string, aprobadas: Map<string, LecturaCalculo[]>): number | null {
  const lista = aprobadas.get(socioId) ?? [];
  const consumos: number[] = [];
  for (let i = 1; i < lista.length; i++) {
    const c = consumoContra(lista[i], lista[i - 1].valor);
    // Las lecturas que retroceden sin cambio de medidor registrado no sirven para promediar.
    if (c >= 0) consumos.push(c);
  }
  const ultimos = consumos.slice(-6);
  if (ultimos.length === 0) return null;
  return Math.round(ultimos.reduce((t, c) => t + c, 0) / ultimos.length);
}

/** Un socio que falta leer en el mes. */
export type SocioDeRuta = {
  id: string;
  nombre: string;
  numeroCliente: string | null;
  rut: string | null;
  arranque: string | null;
};

const numeroDe = (n: string | null) => {
  const v = Number.parseInt(n ?? "", 10);
  return Number.isNaN(v) ? Number.POSITIVE_INFINITY : v;
};

/** El orden en que conviene recorrerlos: por arranque (los sin arranque al final) y luego por número de cliente. */
export function ordenarRuta<T extends SocioDeRuta>(socios: T[]): T[] {
  return [...socios].sort((a, b) => {
    if (a.arranque !== b.arranque) {
      if (a.arranque === null) return 1;
      if (b.arranque === null) return -1;
      const c = a.arranque.localeCompare(b.arranque, "es", { numeric: true });
      if (c !== 0) return c;
    }
    const na = numeroDe(a.numeroCliente);
    const nb = numeroDe(b.numeroCliente);
    if (na !== nb) return na < nb ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}
