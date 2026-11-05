import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { asistencias, ausencias, remuneraciones, trabajadores } from "@/lib/db/schema";
import type {
  AsistenciaDia,
  AusenciaFila,
  EstadoAsistencia,
  EstadoAusencia,
  EstadoRemuneracion,
  RemuneracionFila,
  TipoAusencia,
} from "@/lib/rrhh-comun";

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
        bonos: remuneraciones.bonos,
        descAfp: remuneraciones.descAfp,
        descSalud: remuneraciones.descSalud,
        descCesantia: remuneraciones.descCesantia,
        retencion: remuneraciones.retencion,
        otrosDescuentos: remuneraciones.otrosDescuentos,
        descuentos: remuneraciones.descuentos,
        liquido: remuneraciones.liquido,
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
    return filas.map((f) => ({ ...f, estado: f.estado as EstadoRemuneracion, contrato: f.contrato as "SUELDO" | "HONORARIO" }));
  } catch (e) {
    console.error("RR.HH.: no se pudieron leer las remuneraciones:", e);
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
    const [personas, marcas, cubiertas] = await Promise.all([
      db
        .select({ id: trabajadores.id, nombre: trabajadores.nombre, cargo: trabajadores.cargo })
        .from(trabajadores)
        .where(and(eq(trabajadores.aprId, aprId), eq(trabajadores.activo, true)))
        .orderBy(asc(trabajadores.nombre)),
      db
        .select({ trabajadorId: asistencias.trabajadorId, estado: asistencias.estado, nota: asistencias.nota })
        .from(asistencias)
        .where(and(eq(asistencias.aprId, aprId), eq(asistencias.fecha, dia))),
      db
        .select({ trabajadorId: ausencias.trabajadorId, tipo: ausencias.tipo })
        .from(ausencias)
        .where(and(eq(ausencias.aprId, aprId), eq(ausencias.estado, "APROBADA"), lte(ausencias.desde, dia), gte(ausencias.hasta, dia))),
    ]);
    const marcaDe = new Map(marcas.map((m) => [m.trabajadorId, m]));
    const cubiertaDe = new Map(cubiertas.map((c) => [c.trabajadorId, c.tipo]));
    return personas.map((p) => {
      const cubierta = cubiertaDe.get(p.id);
      if (cubierta === "VACACIONES" || cubierta === "LICENCIA") {
        return { trabajadorId: p.id, nombre: p.nombre, cargo: p.cargo, estado: cubierta as EstadoAsistencia, automatico: true, nota: null };
      }
      const marca = marcaDe.get(p.id);
      return {
        trabajadorId: p.id,
        nombre: p.nombre,
        cargo: p.cargo,
        estado: (marca?.estado ?? (cubierta === "PERMISO" ? "PERMISO" : null)) as EstadoAsistencia | null,
        automatico: false,
        nota: marca?.nota ?? null,
      };
    });
  } catch (e) {
    console.error("RR.HH.: no se pudo leer la asistencia:", e);
    return [];
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
