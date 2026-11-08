import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { asistencias, ausencias, configAsistencia, diasCalendario, horariosComite, horariosLaborales, horasExtras, prestamoDescuentos, prestamos, remuneraciones, trabajadores } from "@/lib/db/schema";
import type {
  AsistenciaDia,
  CuotaPrestamoLinea,
  AusenciaFila,
  DiaEspecial,
  EstadoAsistencia,
  EstadoAusencia,
  EstadoRemuneracion,
  HorarioComite,
  HorarioPersona,
  RemuneracionFila,
  ResumenAusenciasMes,
  TipoAusencia,
} from "@/lib/rrhh-comun";
import { SIN_AUSENCIAS, TOLERANCIA_POR_DEFECTO } from "@/lib/rrhh-comun";
import { esFeriado } from "@/lib/feriados";

export * from "@/lib/rrhh-comun";

/** Las liquidaciones de un mes (AAAA-MM). Si la tabla no existe, devuelve vacío. */
export async function listarRemuneraciones(aprId: string, periodo: string): Promise<RemuneracionFila[]> {
  try {
    const filas = await db
      .select({
        id: remuneraciones.id,
        trabajadorId: remuneraciones.trabajadorId,
        trabajador: trabajadores.nombre,
        cargo: trabajadores.cargo,
        periodo: remuneraciones.periodo,
        sueldoBase: remuneraciones.sueldoBase,
        diasDescontados: remuneraciones.diasDescontados,
        descAusencias: remuneraciones.descAusencias,
        horasDescontadas: remuneraciones.horasDescontadas,
        horasExtra: remuneraciones.horasExtra,
        montoHorasExtra: remuneraciones.montoHorasExtra,
        noImponible: remuneraciones.noImponible,
        bonos: remuneraciones.bonos,
        descAfp: remuneraciones.descAfp,
        descSalud: remuneraciones.descSalud,
        descCesantia: remuneraciones.descCesantia,
        retencion: remuneraciones.retencion,
        otrosDescuentos: remuneraciones.otrosDescuentos,
        descuentos: remuneraciones.descuentos,
        liquido: remuneraciones.liquido,
        valorDiaFicha: trabajadores.valorDia,
        porDia: trabajadores.porDia,
        jornadaSemanal: trabajadores.jornadaSemanal,
        diasSemana: trabajadores.diasSemana,
        valorHoraExtraFicha: trabajadores.valorHoraExtra,
        contrato: trabajadores.contrato,
        afpTasa: trabajadores.afpTasa,
        saludTasa: trabajadores.saludTasa,
        cesantiaPaga: trabajadores.cesantia,
        estado: remuneraciones.estado,
        fechaPago: remuneraciones.fechaPago,
        medio: remuneraciones.medio,
        nota: remuneraciones.nota,
      })
      .from(remuneraciones)
      .innerJoin(trabajadores, eq(trabajadores.id, remuneraciones.trabajadorId))
      .where(and(eq(remuneraciones.aprId, aprId), eq(remuneraciones.periodo, periodo)))
      .orderBy(asc(trabajadores.nombre));
    const resumen = await resumenAusenciasMes(aprId, periodo);

    // Las cuotas de anticipos y préstamos de cada liquidación, con su número («cuota 2 de 6»).
    const cuotasDe = new Map<string, CuotaPrestamoLinea[]>();
    if (filas.length > 0) {
      try {
        const aplicadas = await db
          .select({ remuneracionId: prestamoDescuentos.remuneracionId, prestamoId: prestamoDescuentos.prestamoId, monto: prestamoDescuentos.monto, tipo: prestamos.tipo, total: prestamos.cuotas })
          .from(prestamoDescuentos)
          .innerJoin(prestamos, eq(prestamos.id, prestamoDescuentos.prestamoId))
          .where(
            inArray(
              prestamoDescuentos.remuneracionId,
              filas.map((f) => f.id)
            )
          );
        if (aplicadas.length > 0) {
          const historial = await db
            .select({ prestamoId: prestamoDescuentos.prestamoId, periodo: prestamoDescuentos.periodo })
            .from(prestamoDescuentos)
            .where(
              inArray(
                prestamoDescuentos.prestamoId,
                aplicadas.map((a) => a.prestamoId)
              )
            );
          for (const a of aplicadas) {
            const numero = historial.filter((h) => h.prestamoId === a.prestamoId && h.periodo <= periodo).length;
            const nombre = a.tipo === "ANTICIPO" ? "Anticipo" : "Préstamo";
            const concepto = a.total > 1 ? `${nombre} (cuota ${numero} de ${a.total})` : nombre;
            cuotasDe.set(a.remuneracionId, [...(cuotasDe.get(a.remuneracionId) ?? []), { concepto, monto: a.monto }]);
          }
        }
      } catch (e) {
        console.error("RR.HH.: no se pudieron leer las cuotas de préstamos:", e);
      }
    }

    return filas.map((f) => ({
      ...f,
      estado: f.estado as EstadoRemuneracion,
      contrato: f.contrato as "SUELDO" | "HONORARIO",
      ausenciasMes: resumen[f.trabajadorId] ?? SIN_AUSENCIAS,
      cuotasPrestamo: cuotasDe.get(f.id) ?? [],
    }));
  } catch (e) {
    console.error("RR.HH.: no se pudieron leer las remuneraciones:", e);
    return [];
  }
}

/** Las personas activas que todavía no tienen liquidación en el mes (AAAA-MM). */
export async function personasSinLiquidacion(aprId: string, periodo: string): Promise<{ id: string; nombre: string; cargo: string }[]> {
  try {
    const personas = await db
      .select({ id: trabajadores.id, nombre: trabajadores.nombre, cargo: trabajadores.cargo })
      .from(trabajadores)
      .where(and(eq(trabajadores.aprId, aprId), eq(trabajadores.activo, true)))
      .orderBy(asc(trabajadores.nombre));
    if (personas.length === 0) return [];
    const con = await db.select({ id: remuneraciones.trabajadorId }).from(remuneraciones).where(and(eq(remuneraciones.aprId, aprId), eq(remuneraciones.periodo, periodo)));
    const tienen = new Set(con.map((c) => c.id));
    return personas.filter((p) => !tienen.has(p.id));
  } catch (e) {
    console.error("RR.HH.: no se pudo ver quién no tiene liquidación:", e);
    return [];
  }
}

/** Las ausencias de un tipo (o de todos), de la más reciente a la más antigua. */
export async function listarAusencias(aprId: string, tipos: TipoAusencia[]): Promise<AusenciaFila[]> {
  try {
    const filas = await db
      .select({
        id: ausencias.id,
        trabajadorId: ausencias.trabajadorId,
        trabajador: trabajadores.nombre,
        tipo: ausencias.tipo,
        desde: ausencias.desde,
        hasta: ausencias.hasta,
        dias: ausencias.dias,
        estado: ausencias.estado,
        detalle: ausencias.detalle,
        sinGoce: ausencias.sinGoce,
        horas: ausencias.horas,
        nota: ausencias.nota,
      })
      .from(ausencias)
      .innerJoin(trabajadores, eq(trabajadores.id, ausencias.trabajadorId))
      .where(and(eq(ausencias.aprId, aprId), inArray(ausencias.tipo, tipos)))
      .orderBy(desc(ausencias.desde))
      .limit(500);
    return filas.map((f) => ({ ...f, tipo: f.tipo as TipoAusencia, estado: f.estado as EstadoAusencia }));
  } catch (e) {
    console.error("RR.HH.: no se pudieron leer las ausencias:", e);
    return [];
  }
}

/** Días de vacaciones aprobados que ya tomó cada persona, por id. */
export async function vacacionesTomadas(aprId: string): Promise<Record<string, number>> {
  try {
    const filas = await db
      .select({ trabajadorId: ausencias.trabajadorId, dias: sql<number>`coalesce(sum(${ausencias.dias}), 0)::int` })
      .from(ausencias)
      .where(and(eq(ausencias.aprId, aprId), eq(ausencias.tipo, "VACACIONES"), eq(ausencias.estado, "APROBADA")))
      .groupBy(ausencias.trabajadorId);
    return Object.fromEntries(filas.map((f) => [f.trabajadorId, f.dias]));
  } catch (e) {
    console.error("RR.HH.: no se pudieron leer las vacaciones tomadas:", e);
    return {};
  }
}

/**
 * La asistencia de un día: cada persona activa con su marca. Si tiene una vacación o licencia
 * aprobada que cubre ese día, el estado sale solo de ahí y no se marca a mano.
 */
export async function asistenciaDelDia(aprId: string, dia: string): Promise<AsistenciaDia[]> {
  try {
    const [personas, marcas, cubiertas, extras] = await Promise.all([
      db
        .select({ id: trabajadores.id, nombre: trabajadores.nombre, cargo: trabajadores.cargo })
        .from(trabajadores)
        .where(and(eq(trabajadores.aprId, aprId), eq(trabajadores.activo, true)))
        .orderBy(asc(trabajadores.nombre)),
      db
        .select({ trabajadorId: asistencias.trabajadorId, estado: asistencias.estado, nota: asistencias.nota, horaLlegada: asistencias.horaLlegada })
        .from(asistencias)
        .where(and(eq(asistencias.aprId, aprId), eq(asistencias.fecha, dia))),
      db
        .select({ trabajadorId: ausencias.trabajadorId, tipo: ausencias.tipo })
        .from(ausencias)
        .where(and(eq(ausencias.aprId, aprId), eq(ausencias.estado, "APROBADA"), lte(ausencias.desde, dia), gte(ausencias.hasta, dia))),
      // Si la tabla de horas extras aún no existe, el día se ve igual, sin ellas.
      db
        .select({ trabajadorId: horasExtras.trabajadorId, horas: horasExtras.horas })
        .from(horasExtras)
        .where(and(eq(horasExtras.aprId, aprId), eq(horasExtras.fecha, dia)))
        .catch(() => [] as { trabajadorId: string; horas: number }[]),
    ]);
    const extraDe = new Map(extras.map((x) => [x.trabajadorId, x.horas]));
    const marcaDe = new Map(marcas.map((m) => [m.trabajadorId, m]));
    const cubiertaDe = new Map(cubiertas.map((c) => [c.trabajadorId, c.tipo]));
    return personas.map((p) => {
      const cubierta = cubiertaDe.get(p.id);
      if (cubierta === "VACACIONES" || cubierta === "LICENCIA") {
        return { trabajadorId: p.id, nombre: p.nombre, cargo: p.cargo, estado: cubierta as EstadoAsistencia, automatico: true, nota: null, horasExtra: 0, horaLlegada: null };
      }
      const marca = marcaDe.get(p.id);
      return {
        trabajadorId: p.id,
        nombre: p.nombre,
        cargo: p.cargo,
        estado: (marca?.estado ?? (cubierta === "PERMISO" ? "PERMISO" : null)) as EstadoAsistencia | null,
        automatico: false,
        nota: marca?.nota ?? null,
        horasExtra: extraDe.get(p.id) ?? 0,
        horaLlegada: marca?.horaLlegada ?? null,
      };
    });
  } catch (e) {
    console.error("RR.HH.: no se pudo leer la asistencia:", e);
    return [];
  }
}

/** Los días y la hora de ingreso de cada persona que tiene un horario cargado. Si la tabla aún no existe, devuelve vacío. */
export async function horariosDelComite(aprId: string): Promise<Record<string, HorarioPersona>> {
  try {
    const filas = await db
      .select({ trabajadorId: horariosLaborales.trabajadorId, dias: horariosLaborales.dias, ingreso: horariosLaborales.horaIngreso })
      .from(horariosLaborales)
      .where(eq(horariosLaborales.aprId, aprId));
    return Object.fromEntries(filas.map((f) => [f.trabajadorId, { dias: f.dias, ingreso: f.ingreso }]));
  } catch (e) {
    console.error("RR.HH.: no se pudieron leer los horarios:", e);
    return {};
  }
}

/**
 * Cuándo funciona el comité cada día de la semana y cuántos minutos de tolerancia da antes de contar un atraso.
 * `horario` es null si el comité no definió su horario. Si las tablas aún no existen, también.
 */
export async function horarioDelComite(aprId: string): Promise<{ horario: HorarioComite | null; toleranciaMin: number }> {
  try {
    const [filas, config] = await Promise.all([
      db.select({ dia: horariosComite.dia, abre: horariosComite.abre, cierra: horariosComite.cierra }).from(horariosComite).where(eq(horariosComite.aprId, aprId)),
      db.select({ toleranciaMin: configAsistencia.toleranciaMin }).from(configAsistencia).where(eq(configAsistencia.aprId, aprId)).limit(1),
    ]);
    const toleranciaMin = config[0]?.toleranciaMin ?? TOLERANCIA_POR_DEFECTO;
    if (filas.length === 0) return { horario: null, toleranciaMin };
    const horario: HorarioComite = {};
    for (let d = 0; d < 7; d++) horario[d] = null;
    for (const f of filas) horario[f.dia] = f.abre && f.cierra ? { abre: f.abre, cierra: f.cierra } : null;
    return { horario, toleranciaMin };
  } catch (e) {
    console.error("RR.HH.: no se pudo leer el horario del comité:", e);
    return { horario: null, toleranciaMin: TOLERANCIA_POR_DEFECTO };
  }
}

/** Los feriados locales y días sin operación que el comité anotó. Si la tabla aún no existe, devuelve vacío. */
export async function diasCalendarioDelComite(aprId: string): Promise<DiaEspecial[]> {
  try {
    const filas = await db
      .select({ fecha: diasCalendario.fecha, tipo: diasCalendario.tipo, nombre: diasCalendario.nombre })
      .from(diasCalendario)
      .where(eq(diasCalendario.aprId, aprId))
      .orderBy(asc(diasCalendario.fecha));
    return filas.map((f) => ({ fecha: f.fecha, tipo: f.tipo as DiaEspecial["tipo"], nombre: f.nombre }));
  } catch (e) {
    console.error("RR.HH.: no se pudo leer el calendario laboral:", e);
    return [];
  }
}

/** Las horas extras de cada persona en un mes (AAAA-MM), sumadas. Si la tabla aún no existe, devuelve vacío. */
export async function horasExtraDelMes(aprId: string, mes: string): Promise<Record<string, number>> {
  const [a, m] = mes.split("-").map(Number);
  const desde = new Date(Date.UTC(a, m - 1, 1)).toISOString().slice(0, 10);
  const hasta = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  try {
    const filas = await db
      .select({ trabajadorId: horasExtras.trabajadorId, horas: sql<number>`sum(${horasExtras.horas})::float` })
      .from(horasExtras)
      .where(and(eq(horasExtras.aprId, aprId), gte(horasExtras.fecha, desde), lte(horasExtras.fecha, hasta)))
      .groupBy(horasExtras.trabajadorId);
    return Object.fromEntries(filas.map((f) => [f.trabajadorId, f.horas]));
  } catch (e) {
    console.error("RR.HH.: no se pudieron leer las horas extras del mes:", e);
    return {};
  }
}

/** Cuántos días de cada estado tuvo cada persona en un mes (AAAA-MM), según las marcas manuales. */
export async function resumenAsistenciaMes(aprId: string, mes: string): Promise<Record<string, Partial<Record<EstadoAsistencia, number>>>> {
  try {
    const filas = await db
      .select({ trabajadorId: asistencias.trabajadorId, estado: asistencias.estado, n: sql<number>`count(*)::int` })
      .from(asistencias)
      .where(and(eq(asistencias.aprId, aprId), sql`to_char(${asistencias.fecha}, 'YYYY-MM') = ${mes}`))
      .groupBy(asistencias.trabajadorId, asistencias.estado);
    const salida: Record<string, Partial<Record<EstadoAsistencia, number>>> = {};
    for (const f of filas) (salida[f.trabajadorId] ??= {})[f.estado as EstadoAsistencia] = f.n;
    return salida;
  } catch (e) {
    console.error("RR.HH.: no se pudo leer el resumen de asistencia:", e);
    return {};
  }
}

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Lo que pasó cada día de un mes (AAAA-MM) con cada persona: sus marcas de asistencia, y las vacaciones
 * y licencias aprobadas que cubren esos días (que mandan sobre una marca). Un permiso aprobado llena
 * los días que no tengan marca. Es la base de la planilla del mes.
 */
export async function asistenciaMes(aprId: string, mes: string): Promise<Record<string, Record<string, EstadoAsistencia>>> {
  const [a, m] = mes.split("-").map(Number);
  const primero = Date.UTC(a, m - 1, 1);
  const ultimo = Date.UTC(a, m, 0);
  const desde = ymd(primero);
  const hasta = ymd(ultimo);
  const grilla: Record<string, Record<string, EstadoAsistencia>> = {};
  const poner = (id: string, dia: string, estado: EstadoAsistencia) => ((grilla[id] ??= {})[dia] = estado);

  try {
    const [marcas, cubiertas] = await Promise.all([
      db
        .select({ trabajadorId: asistencias.trabajadorId, fecha: asistencias.fecha, estado: asistencias.estado })
        .from(asistencias)
        .where(and(eq(asistencias.aprId, aprId), gte(asistencias.fecha, desde), lte(asistencias.fecha, hasta))),
      db
        .select({ trabajadorId: ausencias.trabajadorId, tipo: ausencias.tipo, desde: ausencias.desde, hasta: ausencias.hasta })
        .from(ausencias)
        .where(and(eq(ausencias.aprId, aprId), eq(ausencias.estado, "APROBADA"), isNull(ausencias.horas), lte(ausencias.desde, hasta), gte(ausencias.hasta, desde))),
    ]);

    for (const x of marcas) poner(x.trabajadorId, x.fecha, x.estado as EstadoAsistencia);

    for (const x of cubiertas) {
      const ini = Math.max(Date.parse(x.desde), primero);
      const fin = Math.min(Date.parse(x.hasta), ultimo);
      for (let t = ini; t <= fin; t += 86_400_000) {
        const diaSemana = new Date(t).getUTCDay();
        const dia = ymd(t);
        // Un feriado nacional cuenta como un día no laboral, igual que un fin de semana.
        const finDeSemana = diaSemana === 0 || diaSemana === 6 || esFeriado(dia);
        if (x.tipo === "LICENCIA") poner(x.trabajadorId, dia, "LICENCIA");
        else if (!finDeSemana && x.tipo === "VACACIONES") poner(x.trabajadorId, dia, "VACACIONES");
        else if (!finDeSemana && x.tipo === "PERMISO" && !grilla[x.trabajadorId]?.[dia]) poner(x.trabajadorId, dia, "PERMISO");
      }
    }
  } catch (e) {
    console.error("RR.HH.: no se pudo leer la planilla del mes:", e);
  }
  return grilla;
}

/**
 * Los días que cada persona no trabajó en un mes (AAAA-MM), según la asistencia y las ausencias
 * aprobadas: faltas marcadas, días de licencia y permisos sin goce no se pagan; las vacaciones sí.
 */
export async function resumenAusenciasMes(aprId: string, mes: string): Promise<Record<string, ResumenAusenciasMes>> {
  const grilla = await asistenciaMes(aprId, mes);
  const [a, m] = mes.split("-").map(Number);
  const primero = Date.UTC(a, m - 1, 1);
  const ultimo = Date.UTC(a, m, 0);
  const desde = ymd(primero);
  const hasta = ymd(ultimo);

  const salida: Record<string, ResumenAusenciasMes> = {};
  for (const [id, dias] of Object.entries(grilla)) {
    const estados = Object.values(dias);
    salida[id] = {
      faltas: estados.filter((e) => e === "AUSENTE").length,
      licencia: estados.filter((e) => e === "LICENCIA").length,
      vacaciones: estados.filter((e) => e === "VACACIONES").length,
      permisoSinGoce: 0,
      descontables: 0,
      trabajados: estados.filter((e) => e === "PRESENTE" || e === "ATRASO").length,
      horasPermisoSinGoce: 0,
      horasExtra: 0,
    };
  }

  try {
    const permisos = await db
      .select({ trabajadorId: ausencias.trabajadorId, desde: ausencias.desde, hasta: ausencias.hasta })
      .from(ausencias)
      .where(
        and(
          eq(ausencias.aprId, aprId),
          eq(ausencias.tipo, "PERMISO"),
          eq(ausencias.estado, "APROBADA"),
          eq(ausencias.sinGoce, true),
          isNull(ausencias.horas),
          lte(ausencias.desde, hasta),
          gte(ausencias.hasta, desde)
        )
      );
    for (const x of permisos) {
      const r = (salida[x.trabajadorId] ??= { faltas: 0, licencia: 0, permisoSinGoce: 0, vacaciones: 0, descontables: 0, trabajados: 0, horasPermisoSinGoce: 0, horasExtra: 0 });
      const ini = Math.max(Date.parse(x.desde), primero);
      const fin = Math.min(Date.parse(x.hasta), ultimo);
      for (let t = ini; t <= fin; t += 86_400_000) {
        const diaSemana = new Date(t).getUTCDay();
        const estado = grilla[x.trabajadorId]?.[ymd(t)];
        // Un día de fin de semana, o que ya cuenta como licencia o vacaciones, no se suma dos veces.
        if (diaSemana !== 0 && diaSemana !== 6 && !esFeriado(ymd(t)) && estado !== "LICENCIA" && estado !== "VACACIONES") r.permisoSinGoce++;
      }
    }

    // Los permisos por horas (de un solo día): se suman las horas de cada persona.
    const porHoras = await db
      .select({ trabajadorId: ausencias.trabajadorId, horas: ausencias.horas })
      .from(ausencias)
      .where(
        and(
          eq(ausencias.aprId, aprId),
          eq(ausencias.tipo, "PERMISO"),
          eq(ausencias.estado, "APROBADA"),
          eq(ausencias.sinGoce, true),
          isNotNull(ausencias.horas),
          gte(ausencias.desde, desde),
          lte(ausencias.desde, hasta)
        )
      );
    for (const x of porHoras) {
      const r = (salida[x.trabajadorId] ??= { faltas: 0, licencia: 0, permisoSinGoce: 0, vacaciones: 0, descontables: 0, trabajados: 0, horasPermisoSinGoce: 0, horasExtra: 0 });
      r.horasPermisoSinGoce += x.horas ?? 0;
    }

    // Las horas extras registradas en Asistencia durante el mes.
    const extras = await db
      .select({ trabajadorId: horasExtras.trabajadorId, horas: horasExtras.horas })
      .from(horasExtras)
      .where(and(eq(horasExtras.aprId, aprId), gte(horasExtras.fecha, desde), lte(horasExtras.fecha, hasta)));
    for (const x of extras) {
      const r = (salida[x.trabajadorId] ??= { faltas: 0, licencia: 0, permisoSinGoce: 0, vacaciones: 0, descontables: 0, trabajados: 0, horasPermisoSinGoce: 0, horasExtra: 0 });
      r.horasExtra += x.horas;
    }
  } catch (e) {
    console.error("RR.HH.: no se pudieron leer los permisos sin goce:", e);
  }

  for (const r of Object.values(salida)) r.descontables = Math.min(30, r.faltas + r.licencia + r.permisoSinGoce);
  return salida;
}
