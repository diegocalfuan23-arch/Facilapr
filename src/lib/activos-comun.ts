/** Lo de Activos fijos que también usa el navegador: tipos, textos y el cálculo de depreciación. */

export type EstadoActivo = "OPERATIVO" | "EN_REPARACION" | "BAJA";

export const TEXTO_ESTADO_ACTIVO: Record<EstadoActivo, string> = {
  OPERATIVO: "Operativo",
  EN_REPARACION: "En reparación",
  BAJA: "Dado de baja",
};

export const CATEGORIAS_ACTIVO = [
  { valor: "BOMBA", texto: "Bomba o motor", vida: 10 },
  { valor: "ESTANQUE", texto: "Estanque o acumulador", vida: 30 },
  { valor: "CAPTACION", texto: "Captación (pozo, vertiente)", vida: 20 },
  { valor: "RED", texto: "Red de distribución", vida: 30 },
  { valor: "TERRENO", texto: "Terreno", vida: 0 },
  { valor: "EDIFICIO", texto: "Edificio o caseta", vida: 40 },
  { valor: "VEHICULO", texto: "Vehículo", vida: 7 },
  { valor: "EQUIPO", texto: "Equipo o herramienta", vida: 5 },
  { valor: "MEDIDORES", texto: "Medidores", vida: 10 },
  { valor: "OTRO", texto: "Otro", vida: 5 },
] as const;

export const textoCategoriaActivo = (valor: string) => CATEGORIAS_ACTIVO.find((c) => c.valor === valor)?.texto ?? "Otro";

export type ActivoFila = {
  id: string;
  nombre: string;
  codigo: string | null;
  categoria: string;
  ubicacion: string | null;
  fechaAdquisicion: string;
  costo: number;
  vidaUtilAnios: number;
  estado: EstadoActivo;
  responsable: string | null;
  notas: string | null;
  /** true si el costo ya quedó como egreso en la Caja. */
  costoEnCaja: boolean;
  /** AAAA-MM-DD de la próxima mantención, si se definió. */
  proximaMantencion: string | null;
  /** Mientras está en reparación: desde cuándo y por qué (el motivo es opcional). */
  reparacionDesde: string | null;
  reparacionMotivo: string | null;
};

/** El concepto con que la compra de un bien queda en Caja: así se reconoce que viene de Activos fijos. */
export const PREFIJO_CONCEPTO_ACTIVO = "Activo fijo · ";

/**
 * Cuánto vale hoy un activo: depreciación lineal por meses completos desde la compra, hasta agotar
 * su vida útil. Con vida útil 0 (un terreno) no se deprecia. Es una referencia para el comité, no
 * una contabilidad tributaria.
 */
export function valorActual(a: Pick<ActivoFila, "costo" | "vidaUtilAnios" | "fechaAdquisicion">, hoy: string) {
  if (a.vidaUtilAnios <= 0) return { depreciado: 0, valorLibro: a.costo };
  const [ya, ma, da] = a.fechaAdquisicion.split("-").map(Number);
  const [yh, mh, dh] = hoy.split("-").map(Number);
  let meses = (yh - ya) * 12 + (mh - ma) - (dh < da ? 1 : 0);
  meses = Math.max(0, Math.min(meses, a.vidaUtilAnios * 12));
  const depreciado = Math.round((a.costo * meses) / (a.vidaUtilAnios * 12));
  return { depreciado, valorLibro: a.costo - depreciado };
}
