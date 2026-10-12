"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lecturas, socios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { normalizarPeriodo } from "@/lib/boletas";
import { leerTabla } from "@/lib/tabla";
import {
  detectarLecturas,
  resolverLecturas,
  type CuentaRef,
  type LecturaResuelta,
  type ModoLecturas,
} from "@/lib/importar-lecturas";

/**
 * Cargar lecturas desde una planilla, en DOS pasos: primero se lee y se muestra
 * qué se entendió (sin guardar), y recién al confirmar se cargan.
 *  - "inicial": la lectura de partida de cada medidor; queda aprobada y SIN
 *    boleta, para que la primera boleta cobre solo el consumo del mes.
 *  - "mensual": las lecturas del mes; quedan POR REVISAR (como si las hubiera
 *    cargado un técnico) y se aprueban después, de a una o en bloque.
 */

const MAX_BYTES = 4_000_000;
const MAX_FILAS = 2000;

export type PrevisualizacionMasiva =
  | {
      ok: true;
      modo: ModoLecturas;
      periodo: string;
      notas: string[];
      filas: LecturaResuelta[];
      /** Para estimar el monto de cada una en pantalla; null si faltan las tarifas. */
      tarifas: { cargoFijo: number; valorM3: number } | null;
      /** La tarifa de los arranques comerciales, si el comité definió una distinta. */
      tarifasComercial: { cargoFijo: number; valorM3: number } | null;
      /** Los arranques comerciales de esta carga, para estimar con su tarifa. */
      comercialIds: string[];
    }
  | { ok: false; error: string };

export type ResultadoMasivo =
  | { ok: true; cargadas: number; ids: string[] }
  | { ok: false; error: string };

async function cuentasDelComite(aprId: string, periodo: string): Promise<CuentaRef[]> {
  const todas = await db.query.socios.findMany({
    where: eq(socios.aprId, aprId),
    columns: { id: true, nombre: true, rut: true, tipo: true, numeroCliente: true },
  });

  // La última aprobada de cada arranque es la base del consumo (igual que al aprobar).
  const aprobadas = await db
    .selectDistinctOn([lecturas.socioId], {
      socioId: lecturas.socioId,
      valor: lecturas.valor,
    })
    .from(lecturas)
    .innerJoin(socios, eq(lecturas.socioId, socios.id))
    .where(and(eq(socios.aprId, aprId), eq(lecturas.estado, "APROBADA")))
    .orderBy(lecturas.socioId, desc(lecturas.createdAt));
  const anteriorDe = new Map(aprobadas.map((l) => [l.socioId, l.valor]));

  const pendientes = await db
    .select({ socioId: lecturas.socioId })
    .from(lecturas)
    .innerJoin(socios, eq(lecturas.socioId, socios.id))
    .where(
      and(
        eq(socios.aprId, aprId),
        eq(lecturas.estado, "PENDIENTE"),
        eq(lecturas.periodo, periodo)
      )
    );
  const conPendiente = new Set(pendientes.map((l) => l.socioId));

  return todas.map((s) => ({
    ...s,
    tieneLecturas: anteriorDe.has(s.id),
    anterior: anteriorDe.get(s.id) ?? null,
    pendienteEnPeriodo: conPendiente.has(s.id),
  }));
}

function modoDe(valor: unknown): ModoLecturas {
  return valor === "inicial" ? "inicial" : "mensual";
}

/** Paso 1: lee la planilla y resuelve a qué arranque corresponde cada lectura. No guarda nada. */
export async function previsualizarLecturas(
  formData: FormData
): Promise<PrevisualizacionMasiva> {
  const { apr } = await requireAdmin();

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "Elige un archivo CSV o Excel (.xlsx)." };
  }
  if (archivo.size > MAX_BYTES) {
    return { ok: false, error: "El archivo es demasiado grande (máximo 4 MB)." };
  }

  const periodo = normalizarPeriodo(String(formData.get("periodo") ?? ""));
  if (!periodo) {
    return { ok: false, error: "El período debe ser un mes válido, por ejemplo 2026-10." };
  }
  const modo = modoDe(formData.get("modo"));

  const tabla = await leerTabla(archivo, { conservarVacias: true });
  if (!tabla.ok) return { ok: false, error: tabla.error };

  const deteccion = detectarLecturas(tabla.filas);
  if (!deteccion.ok) return { ok: false, error: deteccion.error };
  if (deteccion.filas.length > MAX_FILAS) {
    return { ok: false, error: `El archivo trae ${deteccion.filas.length} filas; el máximo es ${MAX_FILAS}.` };
  }

  const filas = resolverLecturas(
    deteccion.filas,
    await cuentasDelComite(apr.id, periodo),
    modo
  );

  const tarifas =
    apr.tarifaCargoFijo !== null && apr.tarifaMetroCubico !== null
      ? { cargoFijo: apr.tarifaCargoFijo, valorM3: apr.tarifaMetroCubico }
      : null;

  const tarifasComercial =
    apr.tarifaCargoFijoComercial !== null && apr.tarifaMetroCubicoComercial !== null
      ? { cargoFijo: apr.tarifaCargoFijoComercial, valorM3: apr.tarifaMetroCubicoComercial }
      : null;
  const comerciales = tarifasComercial
    ? await db.query.socios.findMany({
        where: and(eq(socios.aprId, apr.id), eq(socios.uso, "COMERCIAL")),
        columns: { id: true },
      })
    : [];

  return {
    ok: true,
    modo,
    periodo,
    notas: deteccion.notas,
    filas,
    tarifas,
    tarifasComercial,
    comercialIds: comerciales.map((c) => c.id),
  };
}

/** Paso 2: guarda las que la directiva confirmó. Se vuelve a validar en el servidor. */
export async function confirmarLecturas(
  items: { socioId: string; valor: number }[],
  periodoCrudo: string,
  modoCrudo: string
): Promise<ResultadoMasivo> {
  const { user, apr } = await requireAdmin();

  const modo = modoDe(modoCrudo);
  const periodo = normalizarPeriodo(String(periodoCrudo ?? ""));
  if (!periodo) return { ok: false, error: "El período no es válido." };
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "No hay lecturas para cargar." };
  }
  if (items.length > MAX_FILAS) {
    return { ok: false, error: `Máximo ${MAX_FILAS} lecturas por carga.` };
  }

  const limpios = items.map((i) => ({
    socioId: String(i.socioId ?? ""),
    valor: Number(i.valor),
  }));
  if (limpios.some((i) => !i.socioId || !Number.isInteger(i.valor) || i.valor < 0)) {
    return { ok: false, error: "Hay una lectura con un valor inválido." };
  }
  if (new Set(limpios.map((i) => i.socioId)).size !== limpios.length) {
    return { ok: false, error: "Hay un arranque repetido en la carga." };
  }

  // Se vuelven a aplicar las reglas con lo que hay AHORA en la base.
  const cuentas = await cuentasDelComite(apr.id, periodo);
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  for (const i of limpios) {
    const c = porId.get(i.socioId);
    if (!c) return { ok: false, error: "Un arranque no pertenece a tu comité." };
    if (modo === "inicial") {
      if (c.tieneLecturas) {
        return { ok: false, error: `${c.nombre} ya tiene lecturas aprobadas: no es una lectura inicial.` };
      }
    } else {
      if (c.anterior === null) {
        return { ok: false, error: `${c.nombre} no tiene lectura anterior: cárgala como inicial.` };
      }
      if (i.valor < c.anterior) {
        return { ok: false, error: `${c.nombre}: la lectura es menor que la anterior.` };
      }
      if (c.pendienteEnPeriodo) {
        return { ok: false, error: `${c.nombre} ya tiene una lectura pendiente de este período.` };
      }
    }
  }

  const inicial = modo === "inicial";
  try {
    const ids: string[] = [];
    await db.transaction(async (tx) => {
      for (let i = 0; i < limpios.length; i += 500) {
        const creadas = await tx
          .insert(lecturas)
          .values(
            limpios.slice(i, i + 500).map((l) => ({
              socioId: l.socioId,
              periodo,
              valor: l.valor,
              observacion: inicial ? "Lectura inicial" : "Cargada desde archivo",
              // La inicial entra aprobada y sin boleta; la del mes queda por revisar.
              estado: inicial ? ("APROBADA" as const) : ("PENDIENTE" as const),
              registradaPorId: user.id,
              revisadaPorId: inicial ? user.id : null,
            }))
          )
          .returning({ id: lecturas.id });
        ids.push(...creadas.map((c) => c.id));
      }
    });
    revalidatePath("/panel/lecturas");
    return { ok: true, cargadas: ids.length, ids };
  } catch {
    return { ok: false, error: "No pudimos guardar las lecturas. No se cargó nada; inténtalo otra vez." };
  }
}
