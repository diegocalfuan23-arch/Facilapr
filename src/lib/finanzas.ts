import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, categoriasMovimiento, movimientos, pagos, socios } from "@/lib/db/schema";
import { user as usuarios } from "@/lib/db/auth-schema";
import { textoConcepto } from "@/lib/pagos";
import {
  TIPO_CIERRE,
  TIPO_DEPOSITO,
  TIPO_GIRO,
  TIPO_SALDO_BANCO,
  TIPO_SALDO_INICIAL,
  diaVecino,
  esMedioBanco,
  textoCategoria,
  type Bolsillos,
  type CategoriaMovimientoPropia,
  type LineaLibro,
  type TraspasoFila,
  type ResumenPeriodo,
  type ResumenMes,
  type PuntoTendencia,
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

/** HH:MM en Chile de un instante. */
function horaChile(d: Date) {
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

/** Lo que entró y salió de `desde` (incluido) a `hasta` (excluido), AAAA-MM-DD. */
async function lineasEntre(aprId: string, desde: string, hasta: string): Promise<LineaLibro[]> {

  // Si la tabla de movimientos todavía no existe en la base, el libro sigue mostrando los pagos de socios.
  const deMovimientos = await db
    .select({ m: movimientos, registradoPor: usuarios.name })
    .from(movimientos)
    .leftJoin(usuarios, eq(usuarios.id, movimientos.registradoPorId))
    .where(
      and(
        eq(movimientos.aprId, aprId),
        // El saldo inicial y los cierres de caja son marcas, no ingresos ni egresos.
        notInArray(movimientos.tipo, [TIPO_SALDO_INICIAL, TIPO_CIERRE, TIPO_GIRO, TIPO_DEPOSITO, TIPO_SALDO_BANCO]),
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
  const diaChile = sql<string>`to_char((${pagos.fecha} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')`;
  const deSocios = await db
    .select({
      id: pagos.id,
      dia: diaChile,
      hora: sql<string>`to_char((${pagos.fecha} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago', 'HH24:MI')`,
      registradoPor: usuarios.name,
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
    .leftJoin(usuarios, eq(usuarios.id, pagos.registradoPorId))
    .where(
      and(
        eq(socios.aprId, aprId),
        sql`${diaChile} >= ${desde}`,
        sql`${diaChile} < ${hasta}`
      )
    )
    .orderBy(asc(pagos.fecha));

  const lineas: LineaLibro[] = [
    ...deMovimientos.map(({ m, registradoPor }) => ({
      hora: horaChile(m.createdAt),
      registradoPor,
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
      hora: p.hora,
      registradoPor: p.registradoPor,
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


/** Las categorías de Caja que creó el comité. Si la tabla todavía no existe en la base, devuelve vacío. */
export async function listarCategoriasMovimiento(aprId: string): Promise<CategoriaMovimientoPropia[]> {
  const filas = await db
    .select({ id: categoriasMovimiento.id, tipo: categoriasMovimiento.tipo, nombre: categoriasMovimiento.nombre })
    .from(categoriasMovimiento)
    .where(eq(categoriasMovimiento.aprId, aprId))
    .orderBy(asc(categoriasMovimiento.nombre))
    .catch((e) => {
      console.error("Finanzas: no se pudieron leer las categorías:", e);
      return [];
    });
  return filas.map((f) => ({ ...f, tipo: f.tipo as TipoMovimiento }));
}

export function resumir(lineas: LineaLibro[], propias: CategoriaMovimientoPropia[] = []): ResumenMes {
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
        texto: textoCategoria(c.categoria, propias),
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
export async function netoEntre(aprId: string, desde: string, hasta: string) {
  const movs = await db
    .select({
      ingresos: sql<number>`coalesce(sum(case when ${movimientos.tipo} = 'INGRESO' then ${movimientos.monto} else 0 end), 0)::int`,
      egresos: sql<number>`coalesce(sum(case when ${movimientos.tipo} = 'EGRESO' then ${movimientos.monto} else 0 end), 0)::int`,
    })
    .from(movimientos)
    .where(and(eq(movimientos.aprId, aprId), sql`${movimientos.fecha} >= ${desde}`, sql`${movimientos.fecha} < ${hasta}`));

  const diaChile = sql<string>`to_char((${pagos.fecha} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')`;
  const [deSocios] = await db
    .select({ total: sql<number>`coalesce(sum(${pagos.monto}), 0)::int` })
    .from(pagos)
    .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
    .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
    .where(and(eq(socios.aprId, aprId), sql`${diaChile} >= ${desde}`, sql`${diaChile} < ${hasta}`));

  return { ingresos: (movs[0]?.ingresos ?? 0) + (deSocios?.total ?? 0), egresos: movs[0]?.egresos ?? 0 };
}

/** Cuánto del saldo inicial estaba en el banco. 0 si no se dijo (todo se cuenta como efectivo). */
export async function saldoBancoDe(aprId: string): Promise<number> {
  const [f] = await db
    .select({ monto: movimientos.monto })
    .from(movimientos)
    .where(and(eq(movimientos.aprId, aprId), eq(movimientos.tipo, TIPO_SALDO_BANCO)))
    .orderBy(desc(movimientos.createdAt))
    .limit(1)
    .catch(() => []);
  return f?.monto ?? 0;
}

/** Lo que cambió en efectivo y en banco de `desde` (incluido) a `hasta` (excluido): ingresos, egresos, giros y depósitos. */
async function netoBolsillos(aprId: string, desde: string, hasta: string): Promise<Bolsillos> {
  const neto: Bolsillos = { efectivo: 0, banco: 0 };
  const sumar = (medio: string, monto: number) => {
    if (esMedioBanco(medio)) neto.banco += monto;
    else neto.efectivo += monto;
  };

  const movs = await db
    .select({ tipo: movimientos.tipo, medio: movimientos.medio, total: sql<number>`coalesce(sum(${movimientos.monto}), 0)::int` })
    .from(movimientos)
    .where(
      and(
        eq(movimientos.aprId, aprId),
        inArray(movimientos.tipo, ["INGRESO", "EGRESO", TIPO_GIRO, TIPO_DEPOSITO]),
        sql`${movimientos.fecha} >= ${desde}`,
        sql`${movimientos.fecha} < ${hasta}`
      )
    )
    .groupBy(movimientos.tipo, movimientos.medio);
  for (const m of movs) {
    if (m.tipo === "INGRESO") sumar(m.medio, m.total);
    else if (m.tipo === "EGRESO") sumar(m.medio, -m.total);
    else if (m.tipo === TIPO_GIRO) {
      neto.banco -= m.total;
      neto.efectivo += m.total;
    } else if (m.tipo === TIPO_DEPOSITO) {
      neto.efectivo -= m.total;
      neto.banco += m.total;
    }
  }

  const diaChile = sql<string>`to_char((${pagos.fecha} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')`;
  const deSocios = await db
    .select({ medio: pagos.medio, total: sql<number>`coalesce(sum(${pagos.monto}), 0)::int` })
    .from(pagos)
    .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
    .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
    .where(and(eq(socios.aprId, aprId), sql`${diaChile} >= ${desde}`, sql`${diaChile} < ${hasta}`))
    .groupBy(pagos.medio);
  for (const p of deSocios) sumar(p.medio, p.total);

  return neto;
}

/**
 * Cuánta plata hay en efectivo y en el banco antes del día `dia` (AAAA-MM-DD, sin incluirlo). Null si no hay
 * saldo inicial o si éste es posterior: no se sabe con cuánta se partía.
 */
export async function bolsillosAl(aprId: string, dia: string): Promise<Bolsillos | null> {
  const base = await saldoInicialDe(aprId);
  if (!base || base.fecha > dia) return null;
  const banco0 = Math.min(await saldoBancoDe(aprId), base.monto);
  const neto = base.fecha < dia ? await netoBolsillos(aprId, base.fecha, dia) : { efectivo: 0, banco: 0 };
  return { efectivo: base.monto - banco0 + neto.efectivo, banco: banco0 + neto.banco };
}

/** Los giros y depósitos de un período, del más reciente al más antiguo. Si algo falla, devuelve vacío. */
export async function traspasosEntre(aprId: string, desde: string, hasta: string): Promise<TraspasoFila[]> {
  const filas = await db
    .select({ id: movimientos.id, tipo: movimientos.tipo, fecha: movimientos.fecha, monto: movimientos.monto, referencia: movimientos.referencia })
    .from(movimientos)
    .where(
      and(
        eq(movimientos.aprId, aprId),
        inArray(movimientos.tipo, [TIPO_GIRO, TIPO_DEPOSITO]),
        sql`${movimientos.fecha} >= ${desde}`,
        sql`${movimientos.fecha} < ${hasta}`
      )
    )
    .orderBy(desc(movimientos.fecha), desc(movimientos.createdAt))
    .catch((e) => {
      console.error("Finanzas: no se pudieron leer los traspasos:", e);
      return [];
    });
  return filas.map((f) => ({ ...f, tipo: f.tipo as "GIRO" | "DEPOSITO" }));
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

  // Cuánta plata hay en efectivo y en el banco al empezar y al terminar el período.
  const bolsillosAnterior = base ? await bolsillosAl(aprId, inicio).catch(() => null) : null;
  const bolsillos = base ? await bolsillosAl(aprId, hasta).catch(() => null) : null;

  const contables = base ? lineas.filter((l) => l.fecha >= inicio) : lineas;
  const ingresos = contables.filter((l) => l.tipo === "INGRESO").reduce((s, l) => s + l.monto, 0);
  const egresos = contables.filter((l) => l.tipo === "EGRESO").reduce((s, l) => s + l.monto, 0);

  // Un cierre de caja es de un solo día.
  const esUnDia = diaVecino(desde, 1) === hasta;
  const [cierre] = esUnDia
    ? await db
        .select({
          comentario: movimientos.concepto,
          disponible: movimientos.monto,
          cerradoPor: usuarios.name,
          efectivoContado: movimientos.efectivoContado,
          diferenciaArqueo: movimientos.diferenciaArqueo,
        })
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
    bolsillosAnterior,
    bolsillos,
    cierre: cierre
      ? {
          cerradoPor: cierre.cerradoPor,
          // Un cierre sin comentario guarda un texto fijo: solo se muestra lo que escribió la persona.
          comentario: cierre.comentario === "Cierre de caja" ? null : cierre.comentario,
          disponible: cierre.disponible,
          efectivoContado: cierre.efectivoContado,
          diferenciaArqueo: cierre.diferenciaArqueo,
        }
      : null,
  };
}

/**
 * El disponible al cierre de cada uno de los `dias` últimos días hasta `hasta` (incluido), para el gráfico.
 * Null si no hay saldo inicial. Los días anteriores al saldo inicial se omiten. Usa dos consultas
 * agrupadas por día, sin importar cuántos días se pidan.
 */
export async function tendenciaDisponible(aprId: string, hasta: string, dias = 7): Promise<PuntoTendencia[] | null> {
  const base = await saldoInicialDe(aprId);
  if (!base) return null;
  const lista: string[] = [];
  for (let i = dias - 1; i >= 0; i--) lista.push(diaVecino(hasta, -i));
  const validos = lista.filter((d) => d >= base.fecha);
  if (validos.length === 0) return null;
  const primero = validos[0];
  const fin = diaVecino(hasta, 1);

  const antes = primero > base.fecha ? await netoEntre(aprId, base.fecha, primero) : { ingresos: 0, egresos: 0 };

  const porDia = new Map<string, number>();
  const sumar = (dia: string, monto: number) => porDia.set(dia, (porDia.get(dia) ?? 0) + monto);

  const movs = await db
    .select({
      dia: movimientos.fecha,
      neto: sql<number>`coalesce(sum(case when ${movimientos.tipo} = 'INGRESO' then ${movimientos.monto} when ${movimientos.tipo} = 'EGRESO' then -${movimientos.monto} else 0 end), 0)::int`,
    })
    .from(movimientos)
    .where(and(eq(movimientos.aprId, aprId), sql`${movimientos.fecha} >= ${primero}`, sql`${movimientos.fecha} < ${fin}`))
    .groupBy(movimientos.fecha);
  for (const m of movs) sumar(m.dia, m.neto);

  const diaChile = sql<string>`to_char((${pagos.fecha} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')`;
  const deSocios = await db
    .select({ dia: diaChile, total: sql<number>`coalesce(sum(${pagos.monto}), 0)::int` })
    .from(pagos)
    .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
    .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
    .where(and(eq(socios.aprId, aprId), sql`${diaChile} >= ${primero}`, sql`${diaChile} < ${fin}`))
    .groupBy(diaChile);
  for (const p of deSocios) sumar(p.dia, p.total);

  let acumulado = base.monto + antes.ingresos - antes.egresos;
  return validos.map((dia) => {
    acumulado += porDia.get(dia) ?? 0;
    return { dia, disponible: acumulado };
  });
}

/**
 * Si la caja de ese día (AAAA-MM-DD) ya está cerrada. Un día cerrado no admite movimientos
 * manuales ni compras hasta que se reabra. Recibe `db` o una transacción, para poder usarse
 * dentro de una operación en curso. Si la tabla no se puede leer, el día cuenta como abierto.
 */
export async function diaCerrado(ejecutor: Pick<typeof db, "select">, aprId: string, dia: string): Promise<boolean> {
  const [c] = await ejecutor
    .select({ id: movimientos.id })
    .from(movimientos)
    .where(and(eq(movimientos.aprId, aprId), eq(movimientos.tipo, TIPO_CIERRE), eq(movimientos.fecha, dia)))
    .limit(1)
    .catch(() => []);
  return Boolean(c);
}

/** El mensaje que se da cuando algo intenta tocar un día cerrado. */
export const mensajeDiaCerrado = (dia: string) =>
  `La caja del ${dia.split("-").reverse().join("-")} ya está cerrada. Reábrela desde Caja para hacer este cambio.`;
