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
  /** HH:MM de inicio, o null. */
  hora: string | null;
  /** Cuándo termina (programado o real) y a qué hora. */
  fechaTermino: string | null;
  horaFin: string | null;
  responsable: string | null;
  /** true si los materiales ya se descontaron del inventario. */
  descontada: boolean;
  /** Su término programado ya pasó y sigue sin estar Hecha (por ejemplo, porque faltó stock). */
  vencida: boolean;
  materiales: MaterialLabor[];
};

/** Lo que valen en total los materiales de una labor. */
export const costoMateriales = (l: Pick<LaborFila, "materiales">) => Math.round(l.materiales.reduce((s, m) => s + m.cantidad * m.costoUnitario, 0));

/** Hoy y la hora actual en Chile, para comparar con las horas programadas de las labores. */
export function ahoraEnChile() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
  return { fecha: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}

/** Un instante como texto «AAAA-MM-DD HH:MM», que se compara bien con < y >. */
const clave = (fecha: string, hora: string | null, porDefecto: string) => `${fecha} ${hora ?? porDefecto}`;
export const claveAhora = () => {
  const a = ahoraEnChile();
  return `${a.fecha} ${a.hora}`;
};
/** Cuándo parte una labor: su fecha y hora; sin hora, al empezar el día. */
export const claveInicio = (l: Pick<LaborFila, "fecha" | "hora">) => clave(l.fecha, l.hora, "00:00");
/** Cuándo termina una labor, si se programó su término; sin hora, al terminar el día. */
export const claveFin = (l: Pick<LaborFila, "fechaTermino" | "horaFin">) => (l.fechaTermino ? clave(l.fechaTermino, l.horaFin, "23:59") : null);
