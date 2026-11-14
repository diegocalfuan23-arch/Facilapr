import { and, count, countDistinct, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, insumos, lecturas, pagos, socios, solicitudesAcceso } from "@/lib/db/schema";
import { hoyEnChile, libroDelMes, mesVecino, resumenPeriodo, tendenciaDisponible } from "@/lib/finanzas";
import { textoMedioPago } from "@/lib/pagos";
import type { DatosResumen, EstadoBoletaResumen } from "@/lib/resumen-comun";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const mesDe = (periodo: string) => MESES[Number(periodo.slice(5, 7)) - 1] ?? periodo;
const corto = (periodo: string) => mayus(mesDe(periodo)).slice(0, 3);
const largo = (periodo: string) => `${corto(periodo)} ${periodo.slice(0, 4)}`;

/** "Buenos días", "Buenas tardes" o "Buenas noches", según la hora en Chile. */
function saludoDe(nombre: string) {
  const hora = Number(new Intl.DateTimeFormat("es-CL", { hour: "numeric", hourCycle: "h23", timeZone: "America/Santiago" }).format(new Date()));
  const base = hora < 6 ? "Buenas noches" : hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";
  const primero = nombre.trim().split(/\s+/)[0];
  return primero ? `${base}, ${primero}` : base;
}

/** Una fecha AAAA-MM-DD, como "viernes 13 de noviembre". */
function fechaLarga(dia: string) {
  const [a, m, d] = dia.split("-").map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return mayus(`${DIAS[dow]} ${d} de ${MESES[m - 1]}`);
}

/**
 * Junta las cifras del Resumen para el período elegido: un mes (los últimos ocho) o todo el año en curso. Lo que pide acción
 * (lecturas por aprobar, solicitudes, stock bajo) es de hoy y no cambia con el período.
 */
export async function datosResumen(opts: {
  aprId: string;
  usuarioNombre: string;
  periodoPedido: string | undefined;
  conCaja: boolean;
  conInventario: boolean;
}): Promise<DatosResumen> {
  const { aprId } = opts;
  const hoy = hoyEnChile();
  const mesActual = hoy.slice(0, 7);
  const anioActual = mesActual.slice(0, 4);
  const periodos = Array.from({ length: 8 }, (_, i) => mesVecino(mesActual, i - 7));

  // El período: uno de los ocho meses, o todo el año en curso. Cualquier otra cosa vuelve al mes actual.
  const esAnio = opts.periodoPedido === anioActual;
  const mes = !esAnio && opts.periodoPedido && periodos.includes(opts.periodoPedido) ? opts.periodoPedido : mesActual;
  const periodoValor = esAnio ? anioActual : mes;
  // El mes que se toma de referencia cuando se mira todo el año (lecturas, caja): el actual.
  const mesRef = esAnio ? mesActual : mes;

  const noAnulada = sql`${boletas.estado} <> 'ANULADA'`;
  const delPeriodo = esAnio ? sql`${boletas.periodo} like ${`${anioActual}-%`}` : eq(boletas.periodo, mes);
  const impaga = sql`${boletas.montoPagado} < ${boletas.montoTotal}`;

  const anteriorDelMes = mesVecino(mes, -1);
  const desdeSocios = esAnio ? `${anioActual}-01-01` : `${mes}-01`;
  const hastaSocios = esAnio ? `${Number(anioActual) + 1}-01-01` : `${mesVecino(mes, 1)}-01`;

  const [
    [facturacion],
    [padron],
    [morosos],
    porPeriodo,
    consumoLecturas,
    usoBoletas,
    [conLectura],
    [porAprobar],
    [solicitudes],
    stockBajo,
    pagosRecientes,
    boletasRecientes,
    cajaDatos,
  ] = await Promise.all([
    db
      .select({
        facturado: sql<number>`coalesce(sum(${boletas.montoTotal}), 0)::int`,
        recaudado: sql<number>`coalesce(sum(${boletas.montoPagado}), 0)::int`,
        pagadas: sql<number>`count(*) filter (where ${boletas.montoPagado} >= ${boletas.montoTotal})::int`,
        pendientes: sql<number>`count(*) filter (where ${boletas.montoPagado} < ${boletas.montoTotal} and ${boletas.fechaVencimiento} >= now())::int`,
        vencidas: sql<number>`count(*) filter (where ${boletas.montoPagado} < ${boletas.montoTotal} and ${boletas.fechaVencimiento} < now())::int`,
        venceEn: sql<number | null>`ceil(extract(epoch from (min(${boletas.fechaVencimiento}) filter (where ${boletas.montoPagado} < ${boletas.montoTotal} and ${boletas.fechaVencimiento} >= now()) - now())) / 86400)::int`,
      })
      .from(boletas)
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .where(and(eq(socios.aprId, aprId), noAnulada, delPeriodo)),

    db
      .select({
        total: sql<number>`count(*)::int`,
        activos: sql<number>`count(*) filter (where ${socios.activo})::int`,
        nuevos: sql<number>`count(*) filter (where ${socios.createdAt} >= ${desdeSocios} and ${socios.createdAt} < ${hastaSocios})::int`,
      })
      .from(socios)
      .where(eq(socios.aprId, aprId)),

    // Un moroso es un SOCIO con boletas impagas ya vencidas, no una boleta: quien debe tres meses es uno, no tres.
    db
      .select({ socios: countDistinct(boletas.socioId) })
      .from(boletas)
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .where(and(eq(socios.aprId, aprId), noAnulada, impaga, sql`${boletas.fechaVencimiento} < now()`)),

    // Por período: lo recaudado y el consumo de las boletas. Los ocho meses, el anterior al primero y, si se mira el año, todo el año.
    db
      .select({
        periodo: boletas.periodo,
        recaudado: sql<number>`coalesce(sum(${boletas.montoPagado}), 0)::int`,
        consumo: sql<number>`coalesce(sum(${boletas.consumoM3}), 0)::int`,
        residencial: sql<number>`coalesce(sum(${boletas.consumoM3}) filter (where ${socios.uso} <> 'COMERCIAL'), 0)::int`,
        comercial: sql<number>`coalesce(sum(${boletas.consumoM3}) filter (where ${socios.uso} = 'COMERCIAL'), 0)::int`,
      })
      .from(boletas)
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .where(
        and(
          eq(socios.aprId, aprId),
          noAnulada,
          or(inArray(boletas.periodo, [mesVecino(periodos[0], -1), ...periodos]), esAnio ? sql`${boletas.periodo} like ${`${anioActual}-%`}` : undefined)
        )
      )
      .groupBy(boletas.periodo),

    // Consumo real: lo que subió cada medidor entre dos lecturas aprobadas, en el período de la lectura nueva. Así el gráfico
    // se llena apenas se aprueban las lecturas, sin esperar a las boletas.
    db.execute(sql`
      select periodo,
             coalesce(sum(m3), 0)::int as total,
             coalesce(sum(m3) filter (where comercial), 0)::int as comercial
      from (
        select l."periodo" as periodo,
               l."valor" - lag(l."valor") over (partition by l."socioId" order by l."createdAt") as m3,
               (s."uso" = 'COMERCIAL') as comercial
        from "Lectura" l
        join "Socio" s on s."id" = l."socioId"
        where s."aprId" = ${aprId} and l."estado" = 'APROBADA'
      ) t
      where m3 > 0
      group by periodo
    `),

    db
      .select({
        periodo: boletas.periodo,
        residencial: sql<number>`coalesce(sum(${boletas.consumoM3}) filter (where ${socios.uso} <> 'COMERCIAL'), 0)::int`,
        comercial: sql<number>`coalesce(sum(${boletas.consumoM3}) filter (where ${socios.uso} = 'COMERCIAL'), 0)::int`,
      })
      .from(boletas)
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .where(and(eq(socios.aprId, aprId), noAnulada, inArray(boletas.periodo, periodos)))
      .groupBy(boletas.periodo),

    // Cuántos socios ya tienen su lectura del mes de referencia (una rechazada no cuenta).
    db
      .select({ n: countDistinct(lecturas.socioId) })
      .from(lecturas)
      .innerJoin(socios, eq(lecturas.socioId, socios.id))
      .where(and(eq(socios.aprId, aprId), eq(lecturas.periodo, mesRef), sql`${lecturas.estado} <> 'RECHAZADA'`, eq(socios.activo, true))),

    db
      .select({ n: count() })
      .from(lecturas)
      .innerJoin(socios, eq(lecturas.socioId, socios.id))
      .where(and(eq(socios.aprId, aprId), eq(lecturas.estado, "PENDIENTE"))),

    db
      .select({ n: count() })
      .from(solicitudesAcceso)
      .innerJoin(socios, eq(solicitudesAcceso.socioId, socios.id))
      .where(and(eq(socios.aprId, aprId), eq(solicitudesAcceso.estado, "PENDIENTE"))),

    opts.conInventario
      ? db
          .select({ n: count() })
          .from(insumos)
          .where(and(eq(insumos.aprId, aprId), or(lt(insumos.stock, 0.0000001), and(sql`${insumos.stockMinimo} > 0`, sql`${insumos.stock} <= ${insumos.stockMinimo}`))))
          .catch(() => [{ n: 0 }])
      : Promise.resolve([{ n: 0 }]),

    db
      .select({ id: pagos.id, socio: socios.nombre, fecha: pagos.fecha, medio: pagos.medio, monto: pagos.monto })
      .from(pagos)
      .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
      .innerJoin(socios, eq(socios.id, sql`coalesce(${pagos.socioId}, ${boletas.socioId})`))
      .where(eq(socios.aprId, aprId))
      .orderBy(desc(pagos.fecha))
      .limit(4),

    db
      .select({
        id: boletas.id,
        socio: socios.nombre,
        periodo: boletas.periodo,
        m3: boletas.consumoM3,
        monto: boletas.montoTotal,
        pagado: boletas.montoPagado,
        vence: boletas.fechaVencimiento,
      })
      .from(boletas)
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .where(and(eq(socios.aprId, aprId), noAnulada, delPeriodo))
      .orderBy(desc(boletas.createdAt))
      .limit(5),

    opts.conCaja
      ? (async () => {
          const r = await resumenPeriodo(aprId, `${mesRef}-01`, `${mesVecino(mesRef, 1)}-01`, await libroDelMes(aprId, mesRef)).catch(() => null);
          const t = await tendenciaDisponible(aprId, hoy, 14).catch(() => null);
          return { r, t };
        })()
      : Promise.resolve(null),
  ]);

  const porP = new Map(porPeriodo.map((p) => [p.periodo, p]));
  const deLecturas = new Map((consumoLecturas.rows as { periodo: string; total: number; comercial: number }[]).map((r) => [r.periodo, r]));
  const deBoletas = new Map(usoBoletas.map((u) => [u.periodo, u]));

  /** El consumo de un mes: manda la lectura; si ese mes solo hay boletas (cargadas a mano), se usan ellas. */
  const consumoDe = (p: string) => {
    const l = deLecturas.get(p)?.total ?? 0;
    return l > 0 ? l : (porP.get(p)?.consumo ?? 0);
  };

  // ---- Tarjeta principal.
  const facturado = facturacion?.facturado ?? 0;
  const recaudado = facturacion?.recaudado ?? 0;
  const previo = porP.get(anteriorDelMes)?.recaudado ?? 0;
  const variacion = !esAnio && previo > 0 ? { pct: Math.round(((recaudado - previo) / previo) * 100), contra: mesDe(anteriorDelMes) } : null;

  // ---- Recaudación y consumo, mes a mes.
  const meses = periodos.map((p) => ({ corto: corto(p), largo: largo(p) }));
  const actual = esAnio ? periodos.length - 1 : periodos.indexOf(mes);
  const valoresConsumo = periodos.map((p) => {
    const v = consumoDe(p);
    return v > 0 ? v : null;
  });

  // Un mes muy sobre lo normal (más del triple del promedio de los demás) casi siempre es una lectura mal ingresada.
  let raro: number | null = null;
  let avisoRaro: string | null = null;
  const conDatos = valoresConsumo.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v !== null);
  if (conDatos.length >= 3) {
    const mayor = conDatos.reduce((a, b) => (b.v > a.v ? b : a));
    const otros = conDatos.filter((x) => x.i !== mayor.i);
    const promedio = otros.reduce((s, x) => s + x.v, 0) / otros.length;
    if (promedio > 0 && mayor.v > promedio * 3) {
      raro = mayor.i;
      avisoRaro = `${mayus(mesDe(periodos[mayor.i]))} (${mayor.v.toLocaleString("es-CL")} m³) está muy sobre lo normal. Revisa si hubo una lectura mal ingresada.`;
    }
  }

  // Quién consume: la misma ventana de ocho meses, separada por uso del arranque.
  let residencial = 0;
  let comercial = 0;
  for (const p of periodos) {
    const l = deLecturas.get(p);
    if (l && l.total > 0) {
      comercial += l.comercial;
      residencial += l.total - l.comercial;
    } else {
      residencial += deBoletas.get(p)?.residencial ?? 0;
      comercial += deBoletas.get(p)?.comercial ?? 0;
    }
  }

  // Consumo del período elegido: el mes, o la suma del año hasta hoy.
  const m3Periodo = esAnio
    ? Array.from({ length: Number(mesActual.slice(5, 7)) }, (_, i) => `${anioActual}-${String(i + 1).padStart(2, "0")}`).reduce((s, p) => s + consumoDe(p), 0)
    : consumoDe(mes);
  const totalSocios = padron?.total ?? 0;

  // ---- Lo que pide acción.
  const activos = padron?.activos ?? 0;
  const sinLectura = Math.max(0, activos - (conLectura?.n ?? 0));
  const atencion: DatosResumen["atencion"] = [
    { clave: "lecturas", titulo: "Lecturas por aprobar", detalle: "Revisa antes de emitir boletas", n: porAprobar?.n ?? 0, tono: "info", href: "/panel/lecturas" },
    { clave: "sin-lectura", titulo: "Socios sin lectura", detalle: "Se les cobrará solo cargo fijo", n: sinLectura, tono: "alerta", href: "/panel/lecturas" },
    { clave: "solicitudes", titulo: "Solicitudes de acceso", detalle: "Socios pidiendo entrar a su panel", n: solicitudes?.n ?? 0, tono: "info", href: "/panel/socios/solicitudes" },
  ];
  if (opts.conInventario) atencion.push({ clave: "stock", titulo: "Materiales con stock bajo", detalle: "Inventario", n: stockBajo[0]?.n ?? 0, tono: "alerta", href: "/panel/inventario" });

  // ---- Últimos pagos y boletas recientes.
  const dia = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" });
  const horaFmt = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Santiago" });
  const cuando = (f: Date) => {
    const d = dia.format(f);
    return d === hoy ? `Hoy, ${horaFmt.format(f)}` : `${d.slice(8, 10)}-${d.slice(5, 7)}`;
  };

  const ahora = Date.now();
  const venceMax = boletasRecientes.length ? boletasRecientes.reduce((a, b) => (b.vence > a ? b.vence : a), boletasRecientes[0].vence) : null;
  const subtituloBoletas = esAnio
    ? `Año ${anioActual}`
    : `${mayus(mesDe(mes))} ${mes.slice(0, 4)}${venceMax ? ` · vencen el ${dia.format(venceMax).slice(8, 10)}-${dia.format(venceMax).slice(5, 7)}` : ""}`;

  return {
    saludo: saludoDe(opts.usuarioNombre),
    fecha: fechaLarga(hoy),
    demo: false,
    periodo: {
      valor: periodoValor,
      opciones: [...[...periodos].reverse().map((p) => ({ valor: p, texto: `${mayus(mesDe(p))} ${p.slice(0, 4)}` })), { valor: anioActual, texto: `Todo ${anioActual}` }],
    },
    hero: {
      titulo: esAnio ? `Recaudado en ${anioActual}` : `Recaudado en ${mesDe(mes)}`,
      recaudado,
      facturado,
      pct: facturado > 0 ? Math.round((recaudado / facturado) * 100) : 0,
      vencenEn: facturacion?.venceEn != null && facturacion.venceEn > 0 ? facturacion.venceEn : null,
      variacion,
      pagadas: facturacion?.pagadas ?? 0,
      pendientes: facturacion?.pendientes ?? 0,
      vencidas: facturacion?.vencidas ?? 0,
    },
    caja:
      cajaDatos?.r
        ? {
            disponible: cajaDatos.r.disponible,
            ingresos: cajaDatos.r.ingresos,
            egresos: cajaDatos.r.egresos,
            etiquetaNeto: mesRef === mesActual ? "este mes" : `en ${mesDe(mesRef)}`,
            serie: (cajaDatos.t ?? []).map((x) => x.disponible),
          }
        : null,
    kpis: {
      socios: {
        total: totalSocios,
        nuevos: padron?.nuevos ?? 0,
        textoNuevos: esAnio ? "nuevos este año" : mes === mesActual ? "nuevos este mes" : `nuevos en ${mesDe(mes)}`,
      },
      morosos: { n: morosos?.socios ?? 0, pct: totalSocios > 0 ? Math.round(((morosos?.socios ?? 0) / totalSocios) * 100) : 0 },
      consumo: { titulo: esAnio ? "Consumo del año" : "Consumo del mes", m3: m3Periodo, porSocio: totalSocios > 0 ? Math.round((m3Periodo / totalSocios) * 10) / 10 : 0 },
      lecturas: { hechas: conLectura?.n ?? 0, total: activos },
    },
    recaudacion: { meses, valores: periodos.map((p) => porP.get(p)?.recaudado ?? 0), actual },
    consumo: { meses, valores: valoresConsumo, actual, raro, avisoRaro, residencial, comercial },
    atencion,
    pagos: pagosRecientes.map((p) => ({ id: p.id, socio: p.socio, cuando: cuando(p.fecha), medio: textoMedioPago(p.medio), monto: p.monto })),
    boletas: boletasRecientes.map((b) => {
      const estado: EstadoBoletaResumen = b.pagado >= b.monto ? "Pagada" : b.vence.getTime() < ahora ? "Vencida" : "Pendiente";
      return { id: b.id, socio: b.socio, periodo: mayus(mesDe(b.periodo)), m3: b.m3, monto: b.monto, estado };
    }),
    subtituloBoletas,
    rutas: { pagos: opts.conCaja ? "/panel/pagos" : "/panel/boletas", caja: opts.conCaja ? "/panel/caja" : null },
  };
}
