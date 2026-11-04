"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { categoriasMovimiento, movimientos } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import {
  CATEGORIA_MOV_NUEVA,
  MEDIOS_MOVIMIENTO,
  PREFIJO_CATEGORIA_MOV,
  TIPO_CIERRE,
  TIPO_SALDO_INICIAL,
  diaCerrado,
  diaValido,
  diaVecino,
  libroDelDia,
  mensajeDiaCerrado,
  resumenPeriodo,
} from "@/lib/finanzas";

export type ResultadoFinanzas = { ok: true } | { ok: false; error: string };

const movimientoSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
  monto: z.number().int("El monto debe ser un número entero.").min(1, "El monto debe ser mayor que 0.").max(2_000_000_000),
  categoria: z.string().max(60),
  concepto: z.string().trim().min(1, "Escribe qué fue.").max(200),
  medio: z.string(),
  referencia: z.string().trim().max(80).nullable(),
  contraparte: z.string().trim().max(120).nullable(),
});

const aTexto = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};

/** Anota un ingreso o un egreso del comité. Solo la directiva, y solo con un plan que incluya Finanzas. */
export async function crearMovimiento(
  _prev: ResultadoFinanzas | null,
  formData: FormData
): Promise<ResultadoFinanzas> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) {
    return { ok: false, error: "La Caja está disponible desde el plan Estándar." };
  }

  const parsed = movimientoSchema.safeParse({
    tipo: formData.get("tipo"),
    fecha: formData.get("fecha"),
    monto: Number(String(formData.get("monto") ?? "").replace(/[^\d]/g, "")),
    categoria: formData.get("categoria"),
    concepto: formData.get("concepto"),
    medio: formData.get("medio"),
    referencia: aTexto(formData.get("referencia")),
    contraparte: aTexto(formData.get("contraparte")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  if (!MEDIOS_MOVIMIENTO.some((m) => m.valor === d.medio)) {
    return { ok: false, error: "El medio de pago no es válido." };
  }
  if (await diaCerrado(db, apr.id, d.fecha)) return { ok: false, error: mensajeDiaCerrado(d.fecha) };

  // La categoría es ninguna, una del comité para este tipo de movimiento, o una nueva por crear.
  let categoria = d.categoria;
  if (categoria === CATEGORIA_MOV_NUEVA) {
    const creada = await categoriaDe(apr.id, d.tipo, String(formData.get("categoriaNueva") ?? ""));
    if (!creada.ok) return creada;
    categoria = `${PREFIJO_CATEGORIA_MOV}${creada.id}`;
  } else if (categoria !== "") {
    const idCategoria = categoria.startsWith(PREFIJO_CATEGORIA_MOV) ? categoria.slice(PREFIJO_CATEGORIA_MOV.length) : "";
    const [existe] = idCategoria
      ? await db
          .select({ id: categoriasMovimiento.id })
          .from(categoriasMovimiento)
          .where(
            and(
              eq(categoriasMovimiento.id, idCategoria),
              eq(categoriasMovimiento.aprId, apr.id),
              eq(categoriasMovimiento.tipo, d.tipo)
            )
          )
          .limit(1)
          .catch(() => [])
      : [];
    if (!existe) return { ok: false, error: "Esa categoría ya no existe. Elige otra." };
  }

  try {
    await db.insert(movimientos).values({ ...d, categoria, aprId: apr.id, registradoPorId: user.id });
  } catch (e) {
    console.error("Finanzas: no se pudo guardar el movimiento:", e);
    return { ok: false, error: "No pudimos guardar el movimiento. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel/caja");
  return { ok: true };
}

/**
 * Define con cuánta plata parte el comité en Facilapr (caja y banco juntos) y desde qué día.
 * Reemplaza al anterior: es un solo saldo de partida por comité.
 */
export async function guardarSaldoInicial(
  _prev: ResultadoFinanzas | null,
  formData: FormData
): Promise<ResultadoFinanzas> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) {
    return { ok: false, error: "La Caja está disponible desde el plan Estándar." };
  }

  const parsed = z
    .object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
      monto: z.number().int("El monto debe ser un número entero.").min(0, "El saldo no puede ser negativo.").max(2_000_000_000),
    })
    .safeParse({
      fecha: formData.get("fecha"),
      monto: Number(String(formData.get("monto") ?? "").replace(/[^\d]/g, "")),
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(movimientos)
        .where(and(eq(movimientos.aprId, apr.id), eq(movimientos.tipo, TIPO_SALDO_INICIAL)));
      await tx.insert(movimientos).values({
        aprId: apr.id,
        tipo: TIPO_SALDO_INICIAL,
        fecha: parsed.data.fecha,
        monto: parsed.data.monto,
        categoria: TIPO_SALDO_INICIAL,
        concepto: "Saldo inicial",
        registradoPorId: user.id,
      });
    });
  } catch (e) {
    console.error("Finanzas: no se pudo guardar el saldo inicial:", e);
    return { ok: false, error: "No pudimos guardar el saldo inicial. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel/caja");
  return { ok: true };
}

/** Borra un movimiento anotado a mano. Los pagos de socios no se borran desde aquí. */
export async function eliminarMovimiento(id: string): Promise<ResultadoFinanzas> {
  const { apr } = await requireAdmin();

  // Solo ingresos y egresos: el saldo inicial y los cierres de caja no se borran por aquí.
  const [m] = await db
    .select({ fecha: movimientos.fecha, tipo: movimientos.tipo })
    .from(movimientos)
    .where(and(eq(movimientos.id, id), eq(movimientos.aprId, apr.id)))
    .limit(1);
  if (!m || (m.tipo !== "INGRESO" && m.tipo !== "EGRESO")) return { ok: false, error: "No encontramos ese movimiento." };
  if (await diaCerrado(db, apr.id, m.fecha)) return { ok: false, error: mensajeDiaCerrado(m.fecha) };

  await db.delete(movimientos).where(and(eq(movimientos.id, id), eq(movimientos.aprId, apr.id)));

  revalidatePath("/panel/caja");
  return { ok: true };
}

/**
 * Reabre la caja de un día cerrado: borra la constancia del cierre y el día vuelve a admitir
 * movimientos. Solo la directiva. Los movimientos del día no se tocan.
 */
export async function reabrirCaja(diaCrudo: string): Promise<ResultadoFinanzas> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) return { ok: false, error: "La Caja está disponible desde el plan Estándar." };

  const dia = diaValido(diaCrudo);
  const borrados = await db
    .delete(movimientos)
    .where(and(eq(movimientos.aprId, apr.id), eq(movimientos.tipo, TIPO_CIERRE), eq(movimientos.fecha, dia)))
    .returning({ id: movimientos.id });
  if (borrados.length === 0) return { ok: false, error: "Esa caja no estaba cerrada." };

  revalidatePath("/panel/caja");
  return { ok: true };
}

/**
 * Cierra la caja de un día: deja anotado con cuánta plata se terminó y un comentario.
 * Es una marca de control (igual que en MecánicoApp): no bloquea el día ni mueve plata.
 * Pide que haya saldo inicial, porque sin él no se sabe cuánto había.
 */
export async function cerrarCaja(
  _prev: ResultadoFinanzas | null,
  formData: FormData
): Promise<ResultadoFinanzas> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) {
    return { ok: false, error: "La Caja está disponible desde el plan Estándar." };
  }

  const dia = diaValido(String(formData.get("dia") ?? ""));
  const comentario = String(formData.get("comentario") ?? "").trim().slice(0, 200);

  const resumen = await resumenPeriodo(apr.id, dia, diaVecino(dia, 1), await libroDelDia(apr.id, dia));
  if (resumen.cierre) return { ok: false, error: "Ese día ya tiene la caja cerrada." };
  if (resumen.disponible === null) {
    return { ok: false, error: "Para cerrar la caja define antes el saldo inicial, anterior o igual a este día." };
  }

  try {
    await db.insert(movimientos).values({
      aprId: apr.id,
      tipo: TIPO_CIERRE,
      fecha: dia,
      monto: resumen.disponible,
      categoria: TIPO_CIERRE,
      concepto: comentario || "Cierre de caja",
      registradoPorId: user.id,
    });
  } catch (e) {
    console.error("Finanzas: no se pudo cerrar la caja:", e);
    return { ok: false, error: "No pudimos cerrar la caja. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel/caja");
  return { ok: true };
}

// ---------------------------------------------------------------- categorías de Caja

type ResultadoCategoriaMov = { ok: true; id: string } | { ok: false; error: string };

const mismoNombre = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" }) === 0;

function limpiarNombre(crudo: string) {
  return String(crudo ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Crea una categoría del comité para un tipo de movimiento, o devuelve la que ya tiene ese nombre
 * (sin distinguir mayúsculas ni tildes). Así crearla desde el formulario nunca falla por repetida.
 */
async function categoriaDe(aprId: string, tipo: "INGRESO" | "EGRESO", nombreCrudo: string): Promise<ResultadoCategoriaMov> {
  const nombre = limpiarNombre(nombreCrudo);
  if (nombre.length < 2) return { ok: false, error: "Escribe el nombre de la categoría." };
  if (nombre.length > 40) return { ok: false, error: "El nombre de la categoría es muy largo (máximo 40 letras)." };

  try {
    const propias = await db
      .select({ id: categoriasMovimiento.id, nombre: categoriasMovimiento.nombre })
      .from(categoriasMovimiento)
      .where(and(eq(categoriasMovimiento.aprId, aprId), eq(categoriasMovimiento.tipo, tipo)));
    const repetida = propias.find((c) => mismoNombre(c.nombre, nombre));
    if (repetida) return { ok: true, id: repetida.id };
    if (propias.length >= 40) return { ok: false, error: "Llegaste al máximo de 40 categorías." };

    const [creada] = await db
      .insert(categoriasMovimiento)
      .values({ aprId, tipo, nombre })
      .returning({ id: categoriasMovimiento.id });
    return { ok: true, id: creada.id };
  } catch (e) {
    console.error("Finanzas: no se pudo crear la categoría:", e);
    return { ok: false, error: "No pudimos crear la categoría. Inténtalo de nuevo en un momento." };
  }
}

/** Crea una categoría desde el modal de categorías. Avisa si ya existía una con ese nombre. */
export async function crearCategoriaMov(tipo: "INGRESO" | "EGRESO", nombreCrudo: string): Promise<ResultadoFinanzas> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) return { ok: false, error: "La Caja está disponible desde el plan Estándar." };
  if (tipo !== "INGRESO" && tipo !== "EGRESO") return { ok: false, error: "Tipo no válido." };

  const nombre = limpiarNombre(nombreCrudo);
  const antes = await db
    .select({ nombre: categoriasMovimiento.nombre })
    .from(categoriasMovimiento)
    .where(and(eq(categoriasMovimiento.aprId, apr.id), eq(categoriasMovimiento.tipo, tipo)))
    .catch(() => []);
  if (antes.some((c) => mismoNombre(c.nombre, nombre))) return { ok: false, error: "Ya tienes una categoría con ese nombre." };

  const r = await categoriaDe(apr.id, tipo, nombre);
  if (!r.ok) return r;

  revalidatePath("/panel/caja");
  return { ok: true };
}

/** Cambia el nombre de una categoría. Los movimientos que la usan la siguen usando: guardan su id. */
export async function renombrarCategoriaMov(id: string, nombreCrudo: string): Promise<ResultadoFinanzas> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) return { ok: false, error: "La Caja está disponible desde el plan Estándar." };

  const nombre = limpiarNombre(nombreCrudo);
  if (nombre.length < 2) return { ok: false, error: "Escribe el nombre de la categoría." };
  if (nombre.length > 40) return { ok: false, error: "El nombre de la categoría es muy largo (máximo 40 letras)." };

  try {
    const propias = await db
      .select({ id: categoriasMovimiento.id, tipo: categoriasMovimiento.tipo, nombre: categoriasMovimiento.nombre })
      .from(categoriasMovimiento)
      .where(eq(categoriasMovimiento.aprId, apr.id));
    const actual = propias.find((c) => c.id === id);
    if (!actual) return { ok: false, error: "No encontramos esa categoría." };
    if (propias.some((c) => c.id !== id && c.tipo === actual.tipo && mismoNombre(c.nombre, nombre))) {
      return { ok: false, error: "Ya tienes otra categoría con ese nombre." };
    }

    await db
      .update(categoriasMovimiento)
      .set({ nombre })
      .where(and(eq(categoriasMovimiento.id, id), eq(categoriasMovimiento.aprId, apr.id)));
  } catch (e) {
    console.error("Finanzas: no se pudo renombrar la categoría:", e);
    return { ok: false, error: "No pudimos cambiar el nombre. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel/caja");
  return { ok: true };
}

/** Borra una categoría. Los movimientos que la usaban quedan sin categoría: no se pierde ninguno. */
export async function eliminarCategoriaMov(id: string): Promise<ResultadoFinanzas> {
  const { apr } = await requireAdmin();

  try {
    await db.transaction(async (tx) => {
      const [borrada] = await tx
        .delete(categoriasMovimiento)
        .where(and(eq(categoriasMovimiento.id, id), eq(categoriasMovimiento.aprId, apr.id)))
        .returning({ id: categoriasMovimiento.id });
      if (!borrada) throw new Error("NO_EXISTE");
      await tx
        .update(movimientos)
        .set({ categoria: "" })
        .where(and(eq(movimientos.aprId, apr.id), eq(movimientos.categoria, `${PREFIJO_CATEGORIA_MOV}${id}`)));
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_EXISTE") return { ok: false, error: "No encontramos esa categoría." };
    console.error("Finanzas: no se pudo borrar la categoría:", e);
    return { ok: false, error: "No pudimos borrar la categoría. Inténtalo de nuevo en un momento." };
  }

  revalidatePath("/panel/caja");
  return { ok: true };
}
