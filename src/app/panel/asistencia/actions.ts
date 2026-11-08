"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { asistencias, configAsistencia, diasCalendario, horariosComite, horariosLaborales, horasExtras, trabajadores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { mensajeError } from "@/lib/db-errores";
import { puede, type Plan } from "@/lib/planes";
import { ESTADOS_ASISTENCIA_MANUAL, HORARIO_POR_DEFECTO, aMinutos, type DatosAsistencia, type EstadoAsistencia } from "@/lib/rrhh-comun";
import { datosAsistencia } from "@/lib/asistencia-datos";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { FERIADOS_NACIONALES } from "@/lib/feriados";
import { z } from "zod";

export type ResultadoAsistencia = { ok: true } | { ok: false; error: string };

/** Los datos de Asistencia para un día, para que la pantalla los vuelva a pedir sin recargar la página (la usa TanStack Query). */
export async function consultarAsistencia(dia: string): Promise<DatosAsistencia> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) throw new Error("RR.HH. está disponible en el plan Grande.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error("La fecha no es válida.");
  return datosAsistencia(apr.id, dia, hoyEnChile());
}

/** Marca (o cambia) el estado de una persona en un día. Con `estado` null, quita la marca. */
export async function marcarAsistencia(
  trabajadorId: string,
  dia: string,
  estado: EstadoAsistencia | null,
  nota?: string
): Promise<ResultadoAsistencia> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: "RR.HH. está disponible en el plan Grande." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, error: "La fecha no es válida." };
  if (estado !== null && !ESTADOS_ASISTENCIA_MANUAL.includes(estado)) return { ok: false, error: "Ese estado no se marca a mano." };

  const [persona] = await db
    .select({ id: trabajadores.id })
    .from(trabajadores)
    .where(and(eq(trabajadores.id, trabajadorId), eq(trabajadores.aprId, apr.id)))
    .limit(1);
  if (!persona) return { ok: false, error: "No encontramos a esa persona." };

  try {
    if (estado === null) {
      await db.delete(asistencias).where(and(eq(asistencias.trabajadorId, trabajadorId), eq(asistencias.fecha, dia), eq(asistencias.aprId, apr.id)));
    } else {
      const notaLimpia = (nota ?? "").trim().slice(0, 200) || null;
      // La hora de llegada solo tiene sentido si la persona vino: con otro estado se borra.
      const vino = estado === "PRESENTE" || estado === "ATRASO";
      await db
        .insert(asistencias)
        .values({ aprId: apr.id, trabajadorId, fecha: dia, estado, nota: notaLimpia })
        .onConflictDoUpdate({
          target: [asistencias.trabajadorId, asistencias.fecha],
          set: vino ? { estado, nota: notaLimpia } : { estado, nota: notaLimpia, horaLlegada: null },
        });
    }
  } catch (e) {
    console.error("RR.HH.: no se pudo marcar la asistencia:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar la marca. Inténtalo de nuevo.") };
  }

  revalidatePath("/panel/asistencia");
  return { ok: true };
}

/** Anota las horas extras de una persona en un día; con 0 se quitan. Se suman solas al armar la liquidación del mes. */
export async function guardarHorasExtra(trabajadorId: string, dia: string, horas: number): Promise<ResultadoAsistencia> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: "RR.HH. está disponible en el plan Grande." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, error: "La fecha no es válida." };
  if (!Number.isFinite(horas) || horas < 0) return { ok: false, error: "Las horas no son válidas." };
  if (horas > 12) return { ok: false, error: "Un día no puede tener más de 12 horas extras." };

  const [persona] = await db
    .select({ id: trabajadores.id })
    .from(trabajadores)
    .where(and(eq(trabajadores.id, trabajadorId), eq(trabajadores.aprId, apr.id)))
    .limit(1);
  if (!persona) return { ok: false, error: "No encontramos a esa persona." };

  try {
    if (horas === 0) {
      await db.delete(horasExtras).where(and(eq(horasExtras.trabajadorId, trabajadorId), eq(horasExtras.fecha, dia), eq(horasExtras.aprId, apr.id)));
    } else {
      await db
        .insert(horasExtras)
        .values({ aprId: apr.id, trabajadorId, fecha: dia, horas })
        .onConflictDoUpdate({ target: [horasExtras.trabajadorId, horasExtras.fecha], set: { horas } });
    }
  } catch (e) {
    console.error("RR.HH.: no se pudieron guardar las horas extras:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar las horas extras. Inténtalo de nuevo.") };
  }

  revalidatePath("/panel/asistencia");
  revalidatePath("/panel/remuneraciones");
  return { ok: true };
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Anota a qué hora llegó una persona en un día (HH:MM); con null, se quita. La persona ya tiene que estar marcada como presente o con atraso. */
export async function guardarHoraLlegada(trabajadorId: string, dia: string, hora: string | null): Promise<ResultadoAsistencia> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: "RR.HH. está disponible en el plan Grande." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { ok: false, error: "La fecha no es válida." };
  if (hora !== null && !HORA.test(hora)) return { ok: false, error: "La hora no es válida." };

  try {
    const actualizadas = await db
      .update(asistencias)
      .set({ horaLlegada: hora })
      .where(and(eq(asistencias.trabajadorId, trabajadorId), eq(asistencias.fecha, dia), eq(asistencias.aprId, apr.id), inArray(asistencias.estado, ["PRESENTE", "ATRASO"])))
      .returning({ id: asistencias.id });
    if (actualizadas.length === 0) return { ok: false, error: "Primero marca a la persona como presente o con atraso." };
  } catch (e) {
    console.error("RR.HH.: no se pudo guardar la hora de llegada:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar la hora. Inténtalo de nuevo.") };
  }

  revalidatePath("/panel/asistencia");
  return { ok: true };
}

const tramoSchema = z.object({ abre: z.string().regex(HORA), cierra: z.string().regex(HORA) });

const calendarioSchema = z.object({
  /** Por persona: los días en que trabaja (0 = domingo … 6 = sábado, o null para el horario de siempre, lunes a viernes) y su hora de ingreso. */
  horarios: z.record(z.string(), z.object({ dias: z.array(z.number().int().min(0).max(6)).max(7).nullable(), ingreso: z.string().regex(HORA).nullable() })),
  dias: z
    .array(
      z.object({
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
        tipo: z.enum(["FERIADO", "SIN_OPERACION"]),
        nombre: z.string().trim().min(1, "Escribe el motivo.").max(120),
      })
    )
    .max(400),
  /** Cuándo funciona el comité cada día (0 a 6); null en un día = cerrado. Si no se manda (null), el horario del comité no se toca. */
  comite: z.record(z.string().regex(/^[0-6]$/), tramoSchema.nullable()).nullable(),
  /** Minutos de tolerancia antes de contar un atraso; null = no se toca. */
  toleranciaMin: z.number().int().min(0).max(120).nullable(),
});

/**
 * Guarda el calendario laboral: el horario de cada persona (días e ingreso), el horario del comité con su tolerancia y
 * las fechas propias (feriados locales y días sin operación). La lista de fechas que llega es la completa: lo que no
 * esté, se quita.
 */
export async function guardarCalendarioLaboral(entrada: z.input<typeof calendarioSchema>): Promise<ResultadoAsistencia> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: "RR.HH. está disponible en el plan Grande." };

  const parsed = calendarioSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: "Alguno de los datos no es válido. Revisa las horas y los días." };
  const { horarios, dias, comite, toleranciaMin } = parsed.data;

  const fechas = new Set<string>();
  for (const d of dias) {
    if (fechas.has(d.fecha)) return { ok: false, error: "Hay una fecha repetida en el calendario." };
    if (Object.prototype.hasOwnProperty.call(FERIADOS_NACIONALES, d.fecha)) return { ok: false, error: `El ${d.fecha.split("-").reverse().join("-")} ya es un feriado nacional.` };
    const real = new Date(`${d.fecha}T00:00:00Z`);
    if (Number.isNaN(real.getTime()) || real.toISOString().slice(0, 10) !== d.fecha) return { ok: false, error: "Hay una fecha que no existe." };
    fechas.add(d.fecha);
  }
  if (comite) {
    for (const t of Object.values(comite)) {
      if (t && aMinutos(t.cierra) <= aMinutos(t.abre)) return { ok: false, error: "En el horario del comité, la hora de cierre debe ser posterior a la de apertura." };
    }
  }

  const ids = Object.keys(horarios);
  try {
    await db.transaction(async (tx) => {
      if (ids.length > 0) {
        const propias = await tx.select({ id: trabajadores.id }).from(trabajadores).where(and(eq(trabajadores.aprId, apr.id), inArray(trabajadores.id, ids)));
        if (propias.length !== ids.length) throw new Error("PERSONA_AJENA");
      }
      for (const id of ids) {
        const { dias: diasPersona, ingreso } = horarios[id];
        const igualAlDefecto = !diasPersona || (diasPersona.length === HORARIO_POR_DEFECTO.length && HORARIO_POR_DEFECTO.every((d) => diasPersona.includes(d)));
        // Sin días propios ni hora de ingreso no hace falta guardar nada: trabaja de lunes a viernes, desde que abre el comité.
        if (igualAlDefecto && !ingreso) {
          await tx.delete(horariosLaborales).where(and(eq(horariosLaborales.trabajadorId, id), eq(horariosLaborales.aprId, apr.id)));
        } else {
          if (diasPersona && diasPersona.length === 0) throw new Error("SIN_DIAS");
          const ordenados = [...new Set(igualAlDefecto ? HORARIO_POR_DEFECTO : diasPersona!)].sort((a, b) => a - b);
          await tx
            .insert(horariosLaborales)
            .values({ aprId: apr.id, trabajadorId: id, dias: ordenados, horaIngreso: ingreso })
            .onConflictDoUpdate({ target: horariosLaborales.trabajadorId, set: { dias: ordenados, horaIngreso: ingreso, updatedAt: new Date() } });
        }
      }
      await tx.delete(diasCalendario).where(eq(diasCalendario.aprId, apr.id));
      if (dias.length > 0) await tx.insert(diasCalendario).values(dias.map((d) => ({ aprId: apr.id, fecha: d.fecha, tipo: d.tipo, nombre: d.nombre })));

      if (comite) {
        await tx.delete(horariosComite).where(eq(horariosComite.aprId, apr.id));
        await tx.insert(horariosComite).values(
          [0, 1, 2, 3, 4, 5, 6].map((dia) => {
            const t = comite[String(dia)] ?? null;
            return { aprId: apr.id, dia, abre: t?.abre ?? null, cierra: t?.cierra ?? null };
          })
        );
      }
      if (toleranciaMin !== null) {
        await tx
          .insert(configAsistencia)
          .values({ aprId: apr.id, toleranciaMin })
          .onConflictDoUpdate({ target: configAsistencia.aprId, set: { toleranciaMin, updatedAt: new Date() } });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "PERSONA_AJENA") return { ok: false, error: "Alguna de las personas ya no existe." };
    if (e instanceof Error && e.message === "SIN_DIAS") return { ok: false, error: "Cada persona debe trabajar al menos un día." };
    console.error("RR.HH.: no se pudo guardar el calendario laboral:", e);
    return { ok: false, error: mensajeError(e, "No pudimos guardar el calendario laboral. Inténtalo de nuevo.") };
  }

  revalidatePath("/panel/asistencia");
  return { ok: true };
}
