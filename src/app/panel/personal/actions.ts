"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { movimientos, pagosTrabajador, trabajadores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { MEDIOS_MOVIMIENTO } from "@/lib/finanzas-comun";
import { diaCerrado, mensajeDiaCerrado } from "@/lib/finanzas";
import { PREFIJO_CONCEPTO_PERSONAL } from "@/lib/personal-comun";

export type ResultadoPersonal = { ok: true } | { ok: false; error: string };

const SIN_PLAN = "Personal está disponible desde el plan Estándar.";
const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const aEntero = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[^\d]/g, "")) || 0;

function refrescar() {
  revalidatePath("/panel/personal");
  revalidatePath("/panel/caja");
}

const trabajadorSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre.").max(120),
  rut: z.string().trim().max(20).nullable(),
  cargo: z.string().trim().min(1, "Escribe el cargo.").max(60),
  telefono: z.string().trim().max(30).nullable(),
  email: z.string().trim().email("El correo no es válido.").max(120).nullable(),
  contrato: z.enum(["SUELDO", "HONORARIO"]),
  sueldo: z.number().int().min(0).max(100_000_000),
  fechaIngreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de ingreso no es válida.").nullable(),
  activo: z.boolean(),
  notas: z.string().trim().max(500).nullable(),
});

/** Crea una persona, o la corrige si viene con `id`. */
export async function guardarTrabajador(_prev: ResultadoPersonal | null, formData: FormData): Promise<ResultadoPersonal> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: SIN_PLAN };

  const parsed = trabajadorSchema.safeParse({
    nombre: formData.get("nombre"),
    rut: aTexto(formData.get("rut")),
    cargo: formData.get("cargo"),
    telefono: aTexto(formData.get("telefono")),
    email: aTexto(formData.get("email")),
    contrato: formData.get("contrato"),
    sueldo: aEntero(formData.get("sueldo")),
    fechaIngreso: aTexto(formData.get("fechaIngreso")),
    activo: formData.get("activo") !== "no",
    notas: aTexto(formData.get("notas")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const id = String(formData.get("id") ?? "");
  try {
    if (id) {
      const [editado] = await db
        .update(trabajadores)
        .set(parsed.data)
        .where(and(eq(trabajadores.id, id), eq(trabajadores.aprId, apr.id)))
        .returning({ id: trabajadores.id });
      if (!editado) return { ok: false, error: "No encontramos a esa persona." };
    } else {
      await db.insert(trabajadores).values({ ...parsed.data, aprId: apr.id });
    }
  } catch (e) {
    console.error("Personal: no se pudo guardar:", e);
    return { ok: false, error: "No pudimos guardar. Inténtalo de nuevo en un momento." };
  }

  refrescar();
  return { ok: true };
}

/** Borra a una persona que nunca recibió un pago. Si ya tiene pagos, se desactiva para no perder el historial. */
export async function eliminarTrabajador(id: string): Promise<ResultadoPersonal> {
  const { apr } = await requireAdmin();

  const [pago] = await db
    .select({ id: pagosTrabajador.id })
    .from(pagosTrabajador)
    .where(and(eq(pagosTrabajador.trabajadorId, id), eq(pagosTrabajador.aprId, apr.id)))
    .limit(1);
  if (pago) return { ok: false, error: "Ya tiene pagos registrados. Márcala como inactiva para conservar el historial." };

  const borrados = await db
    .delete(trabajadores)
    .where(and(eq(trabajadores.id, id), eq(trabajadores.aprId, apr.id)))
    .returning({ id: trabajadores.id });
  if (borrados.length === 0) return { ok: false, error: "No encontramos a esa persona." };

  refrescar();
  return { ok: true };
}

const pagoSchema = z.object({
  trabajadorId: z.string().min(1).max(64),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes no es válido."),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
  monto: z.number().int().min(1, "Escribe el monto.").max(100_000_000),
  medio: z.string(),
  nota: z.string().trim().max(200).nullable(),
});

/** Registra el pago a una persona y deja su egreso en Caja. Todo o nada. */
export async function registrarPagoTrabajador(_prev: ResultadoPersonal | null, formData: FormData): Promise<ResultadoPersonal> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "personal")) return { ok: false, error: SIN_PLAN };

  const parsed = pagoSchema.safeParse({
    trabajadorId: formData.get("trabajadorId"),
    periodo: formData.get("periodo"),
    fecha: formData.get("fecha"),
    monto: aEntero(formData.get("monto")),
    medio: formData.get("medio"),
    nota: aTexto(formData.get("nota")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!MEDIOS_MOVIMIENTO.some((m) => m.valor === d.medio)) return { ok: false, error: "El medio de pago no es válido." };

  try {
    const r = await db.transaction(async (tx) => {
      const [persona] = await tx
        .select({ nombre: trabajadores.nombre })
        .from(trabajadores)
        .where(and(eq(trabajadores.id, d.trabajadorId), eq(trabajadores.aprId, apr.id)))
        .limit(1);
      if (!persona) return { ok: false as const, error: "No encontramos a esa persona." };
      if (await diaCerrado(tx, apr.id, d.fecha)) return { ok: false as const, error: mensajeDiaCerrado(d.fecha) };

      const [egreso] = await tx
        .insert(movimientos)
        .values({
          aprId: apr.id,
          tipo: "EGRESO",
          fecha: d.fecha,
          monto: d.monto,
          categoria: "REMUNERACIONES",
          concepto: `${PREFIJO_CONCEPTO_PERSONAL}${persona.nombre} (${d.periodo})`,
          medio: d.medio,
          contraparte: persona.nombre,
          registradoPorId: user.id,
        })
        .returning({ id: movimientos.id });
      await tx.insert(pagosTrabajador).values({ ...d, aprId: apr.id, movimientoId: egreso.id });
      return { ok: true as const };
    });
    if (r.ok) refrescar();
    return r;
  } catch (e) {
    console.error("Personal: no se pudo registrar el pago:", e);
    return { ok: false, error: "No pudimos registrar el pago. Inténtalo de nuevo en un momento." };
  }
}

/** Anula un pago: borra también su egreso de la Caja, salvo que ese día ya esté cerrado. */
export async function anularPagoTrabajador(id: string): Promise<ResultadoPersonal> {
  const { apr } = await requireAdmin();

  try {
    const r = await db.transaction(async (tx) => {
      const [pago] = await tx
        .select({ movimientoId: pagosTrabajador.movimientoId })
        .from(pagosTrabajador)
        .where(and(eq(pagosTrabajador.id, id), eq(pagosTrabajador.aprId, apr.id)))
        .limit(1);
      if (!pago) return { ok: false as const, error: "No encontramos ese pago." };

      if (pago.movimientoId) {
        const [mov] = await tx
          .select({ fecha: movimientos.fecha })
          .from(movimientos)
          .where(and(eq(movimientos.id, pago.movimientoId), eq(movimientos.aprId, apr.id)))
          .limit(1);
        if (mov && (await diaCerrado(tx, apr.id, mov.fecha))) return { ok: false as const, error: mensajeDiaCerrado(mov.fecha) };
        await tx.delete(movimientos).where(and(eq(movimientos.id, pago.movimientoId), eq(movimientos.aprId, apr.id)));
      }
      await tx.delete(pagosTrabajador).where(and(eq(pagosTrabajador.id, id), eq(pagosTrabajador.aprId, apr.id)));
      return { ok: true as const };
    });
    if (r.ok) refrescar();
    return r;
  } catch (e) {
    console.error("Personal: no se pudo anular el pago:", e);
    return { ok: false, error: "No pudimos anular el pago. Inténtalo de nuevo en un momento." };
  }
}
