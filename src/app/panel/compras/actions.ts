"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { compras, comprasItems, insumos, movimientos, proveedores } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { MEDIOS_MOVIMIENTO, hoyEnChile } from "@/lib/finanzas-comun";
import { UNIDADES_INSUMO } from "@/lib/inventario-comun";
import { totalesDe } from "@/lib/compras-comun";
import { anotarCambioStock } from "@/lib/inventario-historial";
import { diaCerrado, mensajeDiaCerrado } from "@/lib/finanzas";

export type ResultadoCompras = { ok: true } | { ok: false; error: string };

const SIN_PLAN = "Las compras están disponibles desde el plan Estándar.";

function refrescar() {
  revalidatePath("/panel/compras");
  revalidatePath("/panel/inventario");
  revalidatePath("/panel/caja");
}

// ---------------------------------------------------------------- proveedores

const proveedorSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre del proveedor.").max(120),
  rut: z.string().trim().max(20).nullable(),
  email: z.string().trim().email("El correo no es válido.").max(120).nullable(),
  telefono: z.string().trim().max(30).nullable(),
  direccion: z.string().trim().max(200).nullable(),
  notas: z.string().trim().max(500).nullable(),
});

const aTexto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

/** Crea un proveedor, o lo corrige si viene con `id`. */
export async function guardarProveedor(
  _prev: ResultadoCompras | null,
  formData: FormData
): Promise<ResultadoCompras> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) return { ok: false, error: SIN_PLAN };

  const parsed = proveedorSchema.safeParse({
    nombre: formData.get("nombre"),
    rut: aTexto(formData.get("rut")),
    email: aTexto(formData.get("email")),
    telefono: aTexto(formData.get("telefono")),
    direccion: aTexto(formData.get("direccion")),
    notas: aTexto(formData.get("notas")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const id = String(formData.get("id") ?? "");
  try {
    if (id) {
      const [editado] = await db
        .update(proveedores)
        .set(parsed.data)
        .where(and(eq(proveedores.id, id), eq(proveedores.aprId, apr.id)))
        .returning({ id: proveedores.id });
      if (!editado) return { ok: false, error: "No encontramos ese proveedor." };
      // Las compras guardan el nombre del proveedor: si cambió, se actualiza también ahí.
      await db
        .update(compras)
        .set({ proveedorNombre: parsed.data.nombre })
        .where(and(eq(compras.aprId, apr.id), eq(compras.proveedorId, id)));
    } else {
      await db.insert(proveedores).values({ ...parsed.data, aprId: apr.id });
    }
  } catch (e) {
    console.error("Compras: no se pudo guardar el proveedor:", e);
    return { ok: false, error: "No pudimos guardar el proveedor. Inténtalo de nuevo en un momento." };
  }

  refrescar();
  return { ok: true };
}

/** Borra un proveedor. Sus compras se quedan con el nombre que tenía. */
export async function eliminarProveedor(id: string): Promise<ResultadoCompras> {
  const { apr } = await requireAdmin();

  const borrados = await db
    .delete(proveedores)
    .where(and(eq(proveedores.id, id), eq(proveedores.aprId, apr.id)))
    .returning({ id: proveedores.id });
  if (borrados.length === 0) return { ok: false, error: "No encontramos ese proveedor." };

  refrescar();
  return { ok: true };
}

// ---------------------------------------------------------------- compras

const itemSchema = z.object({
  origen: z.enum(["INVENTARIO", "NUEVO", "GASTO"]),
  insumoId: z.string().max(64).nullable(),
  descripcion: z.string().trim().min(1, "Cada línea necesita una descripción.").max(160),
  unidad: z.string().max(20).nullable(),
  cantidad: z.number({ message: "La cantidad no es un número." }).positive("La cantidad debe ser mayor que 0.").max(1_000_000),
  costoUnitario: z.number({ message: "El costo no es un número." }).int("El costo debe ser un número entero.").min(0, "El costo no puede ser negativo.").max(2_000_000_000),
});

const compraSchema = z.object({
  proveedorId: z.string().max(64).nullable(),
  proveedorNombre: z.string().trim().max(120),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
  vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  folio: z.string().trim().max(60),
  notas: z.string().trim().max(500),
  conIva: z.boolean(),
  estado: z.enum(["PENDIENTE", "PAGADA"]),
  medio: z.string(),
  items: z.array(itemSchema).min(1, "Agrega al menos una línea.").max(100, "Máximo 100 líneas por compra."),
});

export type DatosCompra = z.input<typeof compraSchema>;

/**
 * Registra una compra. El stock sube ahora (la mercadería ya llegó), sin esperar al pago.
 * Si nace pagada, también deja su egreso en Caja. Todo o nada: si algo falla, no queda a medias.
 */
export async function crearCompra(
  datos: DatosCompra
): Promise<{ ok: true; numero: number } | { ok: false; error: string }> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) return { ok: false, error: SIN_PLAN };

  const parsed = compraSchema.safeParse(datos);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (!MEDIOS_MOVIMIENTO.some((m) => m.valor === d.medio)) return { ok: false, error: "El medio de pago no es válido." };
  for (const i of d.items) {
    if (i.origen === "INVENTARIO" && !i.insumoId) return { ok: false, error: "Elige el material del inventario en cada línea que lo pide." };
    if (i.origen === "NUEVO" && !UNIDADES_INSUMO.some((u) => u.valor === i.unidad)) {
      return { ok: false, error: "Elige en qué unidad se cuenta cada material nuevo." };
    }
  }

  // Una compra pagada deja su egreso en Caja el día de la compra: ese día no puede estar cerrado.
  if (d.estado === "PAGADA" && (await diaCerrado(db, apr.id, d.fecha))) return { ok: false, error: mensajeDiaCerrado(d.fecha) };

  const { subtotal, impuesto, total } = totalesDe(d.items, d.conIva);

  try {
    const numero = await db.transaction(async (tx) => {
      // El proveedor registrado, si lo hay, tiene que ser de este comité; si no, se usa el nombre escrito.
      let proveedorId: string | null = null;
      let proveedorNombre: string | null = d.proveedorNombre || null;
      if (d.proveedorId) {
        const [p] = await tx
          .select({ id: proveedores.id, nombre: proveedores.nombre })
          .from(proveedores)
          .where(and(eq(proveedores.id, d.proveedorId), eq(proveedores.aprId, apr.id)))
          .limit(1);
        if (!p) throw new Error("PROVEEDOR");
        proveedorId = p.id;
        proveedorNombre = p.nombre;
      }

      const [{ ultimo }] = await tx
        .select({ ultimo: sql<number>`coalesce(max(${compras.numero}), 0)::int` })
        .from(compras)
        .where(eq(compras.aprId, apr.id));
      const numeroNuevo = ultimo + 1;

      // Cada línea toca el inventario según su origen.
      const lineas: { origen: string; insumoId: string | null; descripcion: string; cantidad: number; costoUnitario: number }[] = [];
      for (const i of d.items) {
        let insumoId: string | null = null;
        if (i.origen === "INVENTARIO") {
          const [actualizado] = await tx
            .update(insumos)
            .set({ stock: sql`${insumos.stock} + ${i.cantidad}`, updatedAt: new Date() })
            .where(and(eq(insumos.id, i.insumoId as string), eq(insumos.aprId, apr.id)))
            .returning({ id: insumos.id, nombre: insumos.nombre, unidad: insumos.unidad, stock: insumos.stock });
          if (!actualizado) throw new Error("INSUMO");
          insumoId = actualizado.id;
          await anotarCambioStock(tx, {
            aprId: apr.id,
            insumoId: actualizado.id,
            insumoNombre: actualizado.nombre,
            unidad: actualizado.unidad,
            cantidad: i.cantidad,
            stockResultante: actualizado.stock,
            origen: "COMPRA",
            motivo: `Compra C-${numeroNuevo}`,
            registradoPorId: user.id,
          });
        } else if (i.origen === "NUEVO") {
          const [nuevo] = await tx
            .insert(insumos)
            .values({
              aprId: apr.id,
              nombre: i.descripcion,
              categoria: "",
              unidad: i.unidad as string,
              stock: i.cantidad,
              costo: i.costoUnitario,
            })
            .returning({ id: insumos.id, nombre: insumos.nombre, unidad: insumos.unidad, stock: insumos.stock });
          insumoId = nuevo.id;
          await anotarCambioStock(tx, {
            aprId: apr.id,
            insumoId: nuevo.id,
            insumoNombre: nuevo.nombre,
            unidad: nuevo.unidad,
            cantidad: i.cantidad,
            stockResultante: nuevo.stock,
            origen: "COMPRA",
            motivo: `Compra C-${numeroNuevo} (material nuevo)`,
            registradoPorId: user.id,
          });
        }
        lineas.push({
          origen: i.origen,
          insumoId,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          costoUnitario: i.costoUnitario,
        });
      }

      const [creada] = await tx
        .insert(compras)
        .values({
          aprId: apr.id,
          numero: numeroNuevo,
          proveedorId,
          proveedorNombre,
          fecha: d.fecha,
          vencimiento: d.vencimiento,
          estado: d.estado,
          folio: d.folio || null,
          notas: d.notas || null,
          subtotal,
          impuesto,
          total,
        })
        .returning({ id: compras.id });

      await tx.insert(comprasItems).values(lineas.map((l) => ({ ...l, compraId: creada.id })));

      // Si ya se pagó, el egreso queda en Caja el mismo día de la compra.
      if (d.estado === "PAGADA") {
        const [egreso] = await tx
          .insert(movimientos)
          .values({
            aprId: apr.id,
            tipo: "EGRESO",
            fecha: d.fecha,
            monto: total,
            categoria: "COMPRAS",
            concepto: `Compra C-${numeroNuevo}`,
            medio: d.medio,
            referencia: d.folio || null,
            contraparte: proveedorNombre,
            registradoPorId: user.id,
          })
          .returning({ id: movimientos.id });
        await tx.update(compras).set({ movimientoId: egreso.id }).where(eq(compras.id, creada.id));
      }

      return numeroNuevo;
    });

    refrescar();
    return { ok: true, numero };
  } catch (e) {
    if (e instanceof Error && e.message === "PROVEEDOR") return { ok: false, error: "Ese proveedor ya no existe. Elige otro." };
    if (e instanceof Error && e.message === "INSUMO") return { ok: false, error: "Un material del inventario ya no existe. Revisa las líneas." };
    console.error("Compras: no se pudo registrar la compra:", e);
    return { ok: false, error: "No pudimos registrar la compra. No se guardó nada; inténtalo otra vez." };
  }
}

/** Marca como pagada una compra pendiente y deja su egreso en Caja con la fecha de hoy. */
export async function marcarPagada(compraId: string, medio: string): Promise<ResultadoCompras> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) return { ok: false, error: SIN_PLAN };
  if (!MEDIOS_MOVIMIENTO.some((m) => m.valor === medio)) return { ok: false, error: "El medio de pago no es válido." };

  try {
    const r = await db.transaction(async (tx) => {
      const [c] = await tx
        .select()
        .from(compras)
        .where(and(eq(compras.id, compraId), eq(compras.aprId, apr.id)))
        .limit(1);
      if (!c) return "NO_EXISTE" as const;
      if (c.estado !== "PENDIENTE") return "ESTADO" as const;
      // El egreso queda con la fecha de hoy: si la caja de hoy está cerrada, no se puede anotar.
      if (await diaCerrado(tx, apr.id, hoyEnChile())) return "CERRADA" as const;

      const [egreso] = await tx
        .insert(movimientos)
        .values({
          aprId: apr.id,
          tipo: "EGRESO",
          fecha: hoyEnChile(),
          monto: c.total,
          categoria: "COMPRAS",
          concepto: `Compra C-${c.numero}`,
          medio,
          referencia: c.folio,
          contraparte: c.proveedorNombre,
          registradoPorId: user.id,
        })
        .returning({ id: movimientos.id });
      await tx
        .update(compras)
        .set({ estado: "PAGADA", movimientoId: egreso.id, updatedAt: new Date() })
        .where(eq(compras.id, c.id));
      return "OK" as const;
    });
    if (r === "NO_EXISTE") return { ok: false, error: "No encontramos esa compra." };
    if (r === "ESTADO") return { ok: false, error: "Esa compra ya no está por pagar." };
    if (r === "CERRADA") return { ok: false, error: mensajeDiaCerrado(hoyEnChile()) };
  } catch (e) {
    console.error("Compras: no se pudo marcar como pagada:", e);
    return { ok: false, error: "No pudimos marcar la compra como pagada. Inténtalo de nuevo." };
  }

  refrescar();
  return { ok: true };
}

/** Anula una compra: devuelve el stock que había sumado y, si estaba pagada, borra su egreso de Caja. */
export async function anularCompra(compraId: string): Promise<ResultadoCompras> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) return { ok: false, error: SIN_PLAN };

  let diaBloqueado = "";
  try {
    const r = await db.transaction(async (tx) => {
      const [c] = await tx
        .select()
        .from(compras)
        .where(and(eq(compras.id, compraId), eq(compras.aprId, apr.id)))
        .limit(1);
      if (!c) return "NO_EXISTE" as const;
      if (c.estado === "ANULADA") return "ESTADO" as const;

      // Anular borra el egreso de Caja: si ese día ya se cerró, primero hay que reabrir la caja.
      if (c.movimientoId) {
        const [egreso] = await tx
          .select({ fecha: movimientos.fecha })
          .from(movimientos)
          .where(and(eq(movimientos.id, c.movimientoId), eq(movimientos.aprId, apr.id)))
          .limit(1);
        if (egreso && (await diaCerrado(tx, apr.id, egreso.fecha))) {
          diaBloqueado = egreso.fecha;
          return "CERRADA" as const;
        }
      }

      // El stock vuelve a lo que era, sin bajar de cero.
      const lineas = await tx
        .select({ insumoId: comprasItems.insumoId, cantidad: comprasItems.cantidad, origen: comprasItems.origen })
        .from(comprasItems)
        .where(eq(comprasItems.compraId, c.id));
      for (const l of lineas) {
        if (l.insumoId && (l.origen === "INVENTARIO" || l.origen === "NUEVO")) {
          const [antes] = await tx
            .select({ stock: insumos.stock })
            .from(insumos)
            .where(and(eq(insumos.id, l.insumoId), eq(insumos.aprId, apr.id)))
            .limit(1);
          const [despues] = await tx
            .update(insumos)
            .set({ stock: sql`greatest(0, ${insumos.stock} - ${l.cantidad})`, updatedAt: new Date() })
            .where(and(eq(insumos.id, l.insumoId), eq(insumos.aprId, apr.id)))
            .returning({ nombre: insumos.nombre, unidad: insumos.unidad, stock: insumos.stock });
          // Lo que de verdad bajó: si ya se había usado parte, no baja más de lo que había.
          if (antes && despues) {
            await anotarCambioStock(tx, {
              aprId: apr.id,
              insumoId: l.insumoId,
              insumoNombre: despues.nombre,
              unidad: despues.unidad,
              cantidad: Math.round((despues.stock - antes.stock) * 1000) / 1000,
              stockResultante: despues.stock,
              origen: "ANULACION",
              motivo: `Se anuló la compra C-${c.numero}`,
              registradoPorId: user.id,
            });
          }
        }
      }

      if (c.movimientoId) {
        await tx.delete(movimientos).where(and(eq(movimientos.id, c.movimientoId), eq(movimientos.aprId, apr.id)));
      }
      await tx
        .update(compras)
        .set({ estado: "ANULADA", movimientoId: null, updatedAt: new Date() })
        .where(eq(compras.id, c.id));
      return "OK" as const;
    });
    if (r === "NO_EXISTE") return { ok: false, error: "No encontramos esa compra." };
    if (r === "ESTADO") return { ok: false, error: "Esa compra ya estaba anulada." };
    if (r === "CERRADA") return { ok: false, error: mensajeDiaCerrado(diaBloqueado) };
  } catch (e) {
    console.error("Compras: no se pudo anular la compra:", e);
    return { ok: false, error: "No pudimos anular la compra. No se cambió nada; inténtalo otra vez." };
  }

  refrescar();
  return { ok: true };
}

/**
 * Si una compra figura como pagada pero su egreso no está en Caja, lo anota (con la fecha de
 * la compra). No hace nada si el egreso ya existe, para no contar dos veces la misma plata.
 */
export async function anotarEgresoCompra(compraId: string, medio: string): Promise<ResultadoCompras> {
  const { user, apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "finanzas")) return { ok: false, error: SIN_PLAN };
  if (!MEDIOS_MOVIMIENTO.some((m) => m.valor === medio)) return { ok: false, error: "El medio de pago no es válido." };

  // Si el egreso cae en un día de caja cerrada, se avisa con la fecha de ese día.
  let diaBloqueado = "";
  try {
    const r = await db.transaction(async (tx) => {
      const [c] = await tx
        .select()
        .from(compras)
        .where(and(eq(compras.id, compraId), eq(compras.aprId, apr.id)))
        .limit(1);
      if (!c) return "NO_EXISTE" as const;
      if (c.estado !== "PAGADA") return "ESTADO" as const;
      if (await diaCerrado(tx, apr.id, c.fecha)) {
        diaBloqueado = c.fecha;
        return "CERRADA" as const;
      }

      if (c.movimientoId) {
        const [ya] = await tx
          .select({ id: movimientos.id })
          .from(movimientos)
          .where(and(eq(movimientos.id, c.movimientoId), eq(movimientos.aprId, apr.id)))
          .limit(1);
        if (ya) return "YA_TIENE" as const;
      }

      const [egreso] = await tx
        .insert(movimientos)
        .values({
          aprId: apr.id,
          tipo: "EGRESO",
          fecha: c.fecha,
          monto: c.total,
          categoria: "COMPRAS",
          concepto: `Compra C-${c.numero}`,
          medio,
          referencia: c.folio,
          contraparte: c.proveedorNombre,
          registradoPorId: user.id,
        })
        .returning({ id: movimientos.id });
      await tx.update(compras).set({ movimientoId: egreso.id, updatedAt: new Date() }).where(eq(compras.id, c.id));
      return "OK" as const;
    });
    if (r === "NO_EXISTE") return { ok: false, error: "No encontramos esa compra." };
    if (r === "ESTADO") return { ok: false, error: "Esa compra no está pagada." };
    if (r === "YA_TIENE") return { ok: false, error: "Esa compra ya tiene su egreso en Caja." };
    if (r === "CERRADA") return { ok: false, error: mensajeDiaCerrado(diaBloqueado) };
  } catch (e) {
    console.error("Compras: no se pudo anotar el egreso de la compra:", e);
    return { ok: false, error: "No pudimos anotar el egreso. Inténtalo de nuevo en un momento." };
  }

  refrescar();
  return { ok: true };
}
