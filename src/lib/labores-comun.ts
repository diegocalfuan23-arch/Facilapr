/** Lo de Labores que también usa el navegador: tipos y textos, sin tocar la base de datos. */

export type EstadoLabor = "PROGRAMADA" | "EN_CURSO" | "HECHA";

export const TEXTO_ESTADO_LABOR: Record<EstadoLabor, string> = {
  PROGRAMADA: "Programada",
  EN_CURSO: "En curso",
  HECHA: "Hecha",
};

export const TIPOS_LABOR = [
  { valor: "MANTENCION", texto: "Mantención" },
  { valor: "REPARACION", texto: "Reparación" },
  { valor: "INSTALACION", texto: "Instalación" },
  { valor: "LIMPIEZA", texto: "Limpieza" },
  { valor: "CLORACION", texto: "Cloración" },
  { valor: "OTRO", texto: "Otra" },
] as const;

export const textoTipoLabor = (valor: string) => TIPOS_LABOR.find((t) => t.valor === valor)?.texto ?? "Otra";

/** Un material de una labor. `insumoId` es null si el material se borró del inventario después. */
export type MaterialLabor = {
  insumoId: string | null;
  nombre: string;
  unidad: string;
  cantidad: number;
  costoUnitario: number;
};

export type LaborFila = {
  id: string;
  numero: number;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  lugar: string | null;
  estado: EstadoLabor;
  fecha: string;
  fechaTermino: string | null;
  responsable: string | null;
  /** true si los materiales ya se descontaron del inventario. */
  descontada: boolean;
  materiales: MaterialLabor[];
};

/** Lo que valen en total los materiales de una labor. */
export const costoMateriales = (l: Pick<LaborFila, "materiales">) => Math.round(l.materiales.reduce((s, m) => s + m.cantidad * m.costoUnitario, 0));
