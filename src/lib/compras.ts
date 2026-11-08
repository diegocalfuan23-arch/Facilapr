import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { compras, comprasItems, movimientos, proveedores } from "@/lib/db/schema";
import type { CompraFila, EstadoCompra, ItemCompraFila, OrigenItem, ProveedorFila, TipoDocumento } from "@/lib/compras-comun";

export * from "@/lib/compras-comun";

/** Los proveedores del comité, por nombre. Si la tabla todavía no existe en la base, devuelve vacío. */
export async function listarProveedores(aprId: string): Promise<ProveedorFila[]> {
  return db
    .select({
      id: proveedores.id,
      nombre: proveedores.nombre,
      rut: proveedores.rut,
      email: proveedores.email,
      telefono: proveedores.telefono,
      direccion: proveedores.direccion,
      notas: proveedores.notas,
      rubro: proveedores.rubro,
      contacto: proveedores.contacto,
      diasPago: proveedores.diasPago,
    })
    .from(proveedores)
    .where(eq(proveedores.aprId, aprId))
    .orderBy(asc(proveedores.nombre))
    .catch((e) => {
      console.error("Compras: no se pudieron leer los proveedores:", e);
      return [];
    });
}

/** Las compras del comité con sus líneas, de la más nueva a la más antigua. Si las tablas no existen, devuelve vacío. */
export async function listarCompras(aprId: string): Promise<CompraFila[]> {
  try {
    const filas = await db
      .select({
        id: compras.id,
        numero: compras.numero,
        proveedor: compras.proveedorNombre,
        proveedorId: compras.proveedorId,
        folio: compras.folio,
        documento: compras.documento,
        fecha: compras.fecha,
        vencimiento: compras.vencimiento,
        estado: compras.estado,
        fechaPago: movimientos.fecha,
        subtotal: compras.subtotal,
        impuesto: compras.impuesto,
        total: compras.total,
        notas: compras.notas,
      })
      .from(compras)
      .leftJoin(movimientos, eq(movimientos.id, compras.movimientoId))
      .where(eq(compras.aprId, aprId))
      .orderBy(desc(compras.fecha), desc(compras.numero))
      .limit(500);
    if (filas.length === 0) return [];

    const lineas = await db
      .select({
        id: comprasItems.id,
        compraId: comprasItems.compraId,
        origen: comprasItems.origen,
        descripcion: comprasItems.descripcion,
        cantidad: comprasItems.cantidad,
        costoUnitario: comprasItems.costoUnitario,
      })
      .from(comprasItems)
      .where(inArray(comprasItems.compraId, filas.map((f) => f.id)));

    const porCompra = new Map<string, ItemCompraFila[]>();
    for (const l of lineas) {
      const lista = porCompra.get(l.compraId) ?? [];
      lista.push({
        id: l.id,
        origen: l.origen as OrigenItem,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        costoUnitario: l.costoUnitario,
      });
      porCompra.set(l.compraId, lista);
    }

    return filas.map((f) => ({
      ...f,
      estado: f.estado as EstadoCompra,
      documento: f.documento as TipoDocumento | null,
      items: porCompra.get(f.id) ?? [],
    }));
  } catch (e) {
    console.error("Compras: no se pudieron leer las compras:", e);
    return [];
  }
}
