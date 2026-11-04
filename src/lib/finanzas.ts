import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, movimientos, pagos, socios } from "@/lib/db/schema";
import { textoConcepto, textoMedioPago } from "@/lib/pagos";

/**
 * Finanzas del comité: todo lo que entra y sale de plata, mes a mes. Los ingresos
 * por boletas y cobros salen de la tabla Pago (ya existe, no se duplica); lo demás
 * —egresos y otros ingresos— se anota en Movimiento. El libro junta las dos.
 */

export const CATEGORIAS_INGRESO = [
  { valor: "SUBSIDIO", texto: "Subsidio o aporte del Estado" },
  { valor: "APORTE", texto: "Aporte de socios o de un tercero" },
  { valor: "CUOTA", texto: "Cuota de incorporación" },
  { valor: "OTRO_INGRESO", texto: "Otro ingreso" },
] as const;

export const CATEGORIAS_EGRESO = [
  { valor: "ELECTRICIDAD", texto: "Electricidad" },
  { valor: "REPARACIONES", texto: "Reparaciones y mantención" },
  { valor: "INSUMOS", texto: "Insumos (cloro, repuestos, medidores)" },
  { valor: "REMUNERACIONES", texto: "Sueldos y honorarios" },
  { valor: "ANALISIS", texto: "Análisis de agua" },
  { valor: "ADMINISTRATIVO", texto: "Gastos administrativos" },
  { valor: "IMPUESTOS", texto: "Impuestos y cotizaciones" },
  { valor: "OTRO_EGRESO", texto: "Otro egreso" },
] as const;

export const MEDIOS_MOVIMIENTO = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CHEQUE", texto: "Cheque" },
  { valor: "OTRO", texto: "Otro" },
] as const;

const TEXTO_CATEGORIA: Record<string, string> = Object.fromEntries(
  [...CATEGORIAS_INGRESO, ...CATEGORIAS_EGRESO].map((c) => [c.valor, c.texto])
);

export const textoCategoria = (categoria: string) => TEXTO_CATEGORIA[categoria] ?? "Otro";

export type TipoMovimiento = "INGRESO" | "EGRESO";

/** Una línea del libro, venga de un pago de socio o de un movimiento anotado a mano. */
export type LineaLibro = {
  /** "pago:<id>" o "mov:<id>": solo los movimientos se pueden borrar. */
  id: string;
  tipo: TipoMovimiento;
  /** AAAA-MM-DD */
  fecha: string;
  monto: number;
  categoria: string;
  concepto: string;
  medio: string;
  referencia: string | null;
  contraparte: string | null;
  /** true: viene de los pagos de socios y no se edita aquí. */
  automatico: boolean;
};

/** AAAA-MM del mes pedido, o el actual en Chile si no es válido. */
export function mesValido(texto: string | undefined): string {
  if (texto && /^\d{4}-(0[1-9]|1[0-2])$/.test(texto)) return texto;
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

/** El mes de al lado (delta = -1 o +1), en AAAA-MM. */
export function mesVecino(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function nombreMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return `${NOMBRE_MES[m - 1]} ${a}`;
}

/** Todo lo del mes, ordenado del día más reciente al más antiguo. */
export async function libroDelMes(aprId: string, mes: string): Promise<LineaLibro[]> {
  const desde = `${mes}-01`;
  const hasta = `${mesVecino(mes, 1)}-01`;

  // Si la tabla de movimientos todavía no existe en la base, el libro sigue mostrando los pagos de socios.
  const deMovimientos = await db
    .select()
    .from(movimientos)
    .where(and(eq(movimientos.aprId, aprId), sql`${movimientos.fecha} >= ${desde}`, sql`${movimientos.fecha} < ${hasta}`))
    .orderBy(desc(movimientos.fecha), desc(movimientos.createdAt))
    .catch((e) => {
      console.error("Finanzas: no se pudieron leer los movimientos:", e);
      return [];
    });

  // La fecha del pago lleva hora: se pasa al día de Chile para que un pago de las 23:30 no caiga en otro mes.
  const diaChile = sql<string>`to_char(${pagos.fecha} AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')`;
  const deSocios = await db
    .select({
      id: pagos.id,
      dia: diaChile,
      monto: pagos.monto,
      medio: pagos.medio,
      referencia: pagos.referencia,
      concepto: pagos.concepto,
      descripcion: pagos.descripcion,
      periodo: boletas.periodo,
      socio: socios.nombre,
    })
    .from(pagos)
    .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
    .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
    .where(
      and(
        eq(socios.aprId, aprId),
        sql`${diaChile} >= ${desde}`,
        sql`${diaChile} < ${hasta}`
      )
    )
    .orderBy(asc(pagos.fecha));

  const lineas: LineaLibro[] = [
    ...deMovimientos.map((m) => ({
      id: `mov:${m.id}`,
      tipo: m.tipo as TipoMovimiento,
      fecha: m.fecha,
      monto: m.monto,
      categoria: m.categoria,
      concepto: m.concepto,
      medio: m.medio,
      referencia: m.referencia,
      contraparte: m.contraparte,
      automatico: false,
    })),
    ...deSocios.map((p) => ({
      id: `pago:${p.id}`,
      tipo: "INGRESO" as const,
      fecha: p.dia,
      monto: p.monto,
      categoria: p.concepto === "BOLETA" ? "BOLETAS" : "COBROS",
      concepto:
        p.concepto === "BOLETA"
          ? `Boleta ${p.periodo ?? ""}`.trim()
          : p.descripcion?.trim() || textoConcepto(p.concepto),
      medio: p.medio,
      referencia: p.referencia,
      contraparte: p.socio,
      automatico: true,
    })),
  ];

  return lineas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

export type ResumenMes = {
  ingresos: number;
  egresos: number;
  resultado: number;
  /** Cuánto fue a cada categoría, de mayor a menor, por tipo. */
  porCategoria: { tipo: TipoMovimiento; categoria: string; texto: string; total: number }[];
};

export function resumir(lineas: LineaLibro[]): ResumenMes {
  let ingresos = 0;
  let egresos = 0;
  const acumulado = new Map<string, { tipo: TipoMovimiento; categoria: string; total: number }>();
  for (const l of lineas) {
    if (l.tipo === "INGRESO") ingresos += l.monto;
    else egresos += l.monto;
    const clave = `${l.tipo}:${l.categoria}`;
    const previo = acumulado.get(clave);
    if (previo) previo.total += l.monto;
    else acumulado.set(clave, { tipo: l.tipo, categoria: l.categoria, total: l.monto });
  }
  return {
    ingresos,
    egresos,
    resultado: ingresos - egresos,
    porCategoria: [...acumulado.values()]
      .map((c) => ({
        ...c,
        texto: c.categoria === "BOLETAS" ? "Boletas de agua" : c.categoria === "COBROS" ? "Otros cobros a socios" : textoCategoria(c.categoria),
      }))
      .sort((a, b) => b.total - a.total),
  };
}

export const textoMedioLinea = (medio: string) => textoMedioPago(medio);
