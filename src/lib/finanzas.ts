import { and, asc, desc, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, movimientos, pagos, socios } from "@/lib/db/schema";
import { user as usuarios } from "@/lib/db/auth-schema";
import { textoConcepto } from "@/lib/pagos";
import {
  TIPO_CIERRE,
  TIPO_SALDO_INICIAL,
  diaVecino,
  textoCategoria,
  type LineaLibro,
  type ResumenPeriodo,
  type ResumenMes,
  type TipoMovimiento,
} from "@/lib/finanzas-comun";

export * from "@/lib/finanzas-comun";

/**
 * Finanzas del comité: todo lo que entra y sale de plata, mes a mes. Los ingresos
 * por boletas y cobros salen de la tabla Pago (ya existe, no se duplica); lo demás
 * —egresos y otros ingresos— se anota en Movimiento. El libro junta las dos.
 */

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
export function libroDelMes(aprId: string, mes: string): Promise<LineaLibro[]> {
  return lineasEntre(aprId, `${mes}-01`, `${mesVecino(mes, 1)}-01`);
}

/** Todo lo de un día (AAAA-MM-DD). */
export function libroDelDia(aprId: string, dia: string): Promise<LineaLibro[]> {
  return lineasEntre(aprId, dia, diaVecino(dia, 1));
}

/** Lo que entró y salió de `desde` (incluido) a `hasta` (excluido), AAAA-MM-DD. */
async function lineasEntre(aprId: string, desde: string, hasta: string): Promise<LineaLibro[]> {

  // Si la tabla de movimientos todavía no existe en la base, el libro sigue mostrando los pagos de socios.
  const deMovimientos = await db
    .select()
    .from(movimientos)
    .where(
      and(
        eq(movimientos.aprId, aprId),
        // El saldo inicial y los cierres de caja son marcas, no ingresos ni egresos.
        notInArray(movimientos.tipo, [TIPO_SALDO_INICIAL, TIPO_CIERRE]),
        sql`${movimientos.fecha} >= ${desde}`,
        sql`${movimientos.fecha} < ${hasta}`
      )
    )
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



/** El saldo inicial definido por el comité, o null si todavía no lo ha puesto (o la tabla no existe). */
export async function saldoInicialDe(aprId: string) {
  const [s] = await db
    .select({ monto: movimientos.monto, fecha: movimientos.fecha })
    .from(movimientos)
    .where(and(eq(movimientos.aprId, aprId), eq(movimientos.tipo, TIPO_SALDO_INICIAL)))
    .orderBy(desc(movimientos.createdAt))
    .limit(1)
    .catch(() => []);
  return s ?? null;
}

/**
 * Cuánto entró y cuánto salió de `desde` (incluido) a `hasta` (excluido), AAAA-MM-DD:
 * los movimientos anotados más los pagos de socios. No cuenta el saldo inicial ni los cierres.
 */
async function netoEntre(aprId: string, desde: string, hasta: string) {
  const movs = await db
    .select({
      ingresos: sql<number>`coalesce(sum(case when ${movimientos.tipo} = 'INGRESO' then ${movimientos.monto} else 0 end), 0)::int`,
      egresos: sql<number>`coalesce(sum(case when ${movimientos.tipo} = 'EGRESO' then ${movimientos.monto} else 0 end), 0)::int`,
    })
    .from(movimientos)
    .where(and(eq(movimientos.aprId, aprId), sql`${movimientos.fecha} >= ${desde}`, sql`${movimientos.fecha} < ${hasta}`));

  const diaChile = sql<string>`to_char(${pagos.fecha} AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')`;
  const [deSocios] = await db
    .select({ total: sql<number>`coalesce(sum(${pagos.monto}), 0)::int` })
    .from(pagos)
    .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
    .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
    .where(and(eq(socios.aprId, aprId), sql`${diaChile} >= ${desde}`, sql`${diaChile} < ${hasta}`));

  return { ingresos: (movs[0]?.ingresos ?? 0) + (deSocios?.total ?? 0), egresos: movs[0]?.egresos ?? 0 };
}

/**
 * La Caja de un período: con cuánta plata se empezó (el saldo inicial más todo lo anterior),
 * lo que entró y salió, y con cuánta se termina. Si el saldo inicial cae dentro del período,
 * se parte de él ese día y solo cuenta lo que pasó desde entonces.
 */
export async function resumenPeriodo(
  aprId: string,
  desde: string,
  hasta: string,
  lineas: LineaLibro[]
): Promise<ResumenPeriodo> {
  const base = await saldoInicialDe(aprId);

  // Desde cuándo se cuenta: normalmente el inicio del período; o el día del saldo inicial, si cae adentro.
  const inicio = base && base.fecha > desde && base.fecha < hasta ? base.fecha : desde;

  let disponibleAnterior: number | null = null;
  if (base && base.fecha <= inicio) {
    const previo = base.fecha < inicio ? await netoEntre(aprId, base.fecha, inicio) : { ingresos: 0, egresos: 0 };
    disponibleAnterior = base.monto + previo.ingresos - previo.egresos;
  }

  const contables = base ? lineas.filter((l) => l.fecha >= inicio) : lineas;
  const ingresos = contables.filter((l) => l.tipo === "INGRESO").reduce((s, l) => s + l.monto, 0);
  const egresos = contables.filter((l) => l.tipo === "EGRESO").reduce((s, l) => s + l.monto, 0);

  // Un cierre de caja es de un solo día.
  const esUnDia = diaVecino(desde, 1) === hasta;
  const [cierre] = esUnDia
    ? await db
        .select({ comentario: movimientos.concepto, disponible: movimientos.monto, cerradoPor: usuarios.name })
        .from(movimientos)
        .leftJoin(usuarios, eq(usuarios.id, movimientos.registradoPorId))
        .where(and(eq(movimientos.aprId, aprId), eq(movimientos.tipo, TIPO_CIERRE), eq(movimientos.fecha, desde)))
        .limit(1)
        .catch(() => [])
    : [];

  return {
    desde,
    hasta,
    disponibleAnterior,
    ingresos,
    egresos,
    disponible: disponibleAnterior === null ? null : disponibleAnterior + ingresos - egresos,
    cierre: cierre
      ? {
          cerradoPor: cierre.cerradoPor,
          // Un cierre sin comentario guarda un texto fijo: solo se muestra lo que escribió la persona.
          comentario: cierre.comentario === "Cierre de caja" ? null : cierre.comentario,
          disponible: cierre.disponible,
        }
      : null,
  };
}
