/**
 * Los feriados nacionales de Chile, para que los días hábiles de vacaciones y permisos no cuenten un feriado.
 *
 * Solo están los de 2026 y 2027, y solo los nacionales (los regionales y comunales no). Hay que agregar cada
 * año. Los dos años se contrastaron con lo publicado: 16 feriados nacionales en 2026 (10 en día de semana) y 17
 * en 2027. Conviene revisarlos contra el calendario oficial antes de apoyarse en ellos para un pago.
 */
export const FERIADOS_NACIONALES: Record<string, string> = {
  "2026-01-01": "Año Nuevo",
  "2026-04-03": "Viernes Santo",
  "2026-04-04": "Sábado Santo",
  "2026-05-01": "Día del Trabajo",
  "2026-05-21": "Glorias Navales",
  "2026-06-21": "Día de los Pueblos Indígenas",
  "2026-06-29": "San Pedro y San Pablo",
  "2026-07-16": "Virgen del Carmen",
  "2026-08-15": "Asunción de la Virgen",
  "2026-09-18": "Independencia",
  "2026-09-19": "Glorias del Ejército",
  "2026-10-12": "Encuentro de Dos Mundos",
  "2026-10-31": "Iglesias Evangélicas",
  "2026-11-01": "Todos los Santos",
  "2026-12-08": "Inmaculada Concepción",
  "2026-12-25": "Navidad",
  "2027-01-01": "Año Nuevo",
  "2027-03-26": "Viernes Santo",
  "2027-03-27": "Sábado Santo",
  "2027-05-01": "Día del Trabajo",
  "2027-05-21": "Glorias Navales",
  "2027-06-21": "Día de los Pueblos Indígenas",
  "2027-06-28": "San Pedro y San Pablo (pasa al lunes)",
  "2027-07-16": "Virgen del Carmen",
  "2027-08-15": "Asunción de la Virgen",
  "2027-09-17": "feriado especial: el 18 cae sábado",
  "2027-09-18": "Independencia",
  "2027-09-19": "Glorias del Ejército",
  "2027-10-11": "Encuentro de Dos Mundos (pasa al lunes)",
  "2027-10-31": "Iglesias Evangélicas",
  "2027-11-01": "Todos los Santos",
  "2027-12-08": "Inmaculada Concepción",
  "2027-12-25": "Navidad",
};


/** true si ese día (AAAA-MM-DD) es feriado nacional. */
export const esFeriado = (iso: string) => Object.prototype.hasOwnProperty.call(FERIADOS_NACIONALES, iso);
