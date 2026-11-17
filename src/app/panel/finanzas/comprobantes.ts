"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { movimientoAdjuntos, movimientos } from "@/lib/db/schema";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { archivoDe, leerComprobante } from "@/lib/comprobantes";
import { TIPO_DEPOSITO, TIPO_GIRO } from "@/lib/finanzas-comun";
import type { ResultadoFinanzas } from "@/app/panel/finanzas/actions";

/** Adjunta (o reemplaza) el comprobante de un movimiento de la Caja o de un giro o depósito. */
export async function adjuntarComprobante(movimientoId: string, formData: FormData): Promise<ResultadoFinanzas> {
  const { apr } = await requireFinanzas();
  if (!puede(apr.plan as Plan, "finanzas")) return { ok: false, error: "La Caja está disponible desde el plan Estándar." };

  const archivo = archivoDe(formData.get("archivo"));
  if (!archivo) return { ok: false, error: "Elige un archivo." };
  const leido = await leerComprobante(archivo);
  if (!leido.ok) return leido;

  try {
    const [m] = await db
      .select({ id: movimientos.id })
      .from(movimientos)
      .where(and(eq(movimientos.id, movimientoId), eq(movimientos.aprId, apr.id), inArray(movimientos.tipo, ["INGRESO", "EGRESO", TIPO_GIRO, TIPO_DEPOSITO])))
      .limit(1);
    if (!m) return { ok: false, error: "No encontramos ese movimiento." };
    await db.transaction(async (tx) => {
      await tx.delete(movimientoAdjuntos).where(and(eq(movimientoAdjuntos.movimientoId, movimientoId), eq(movimientoAdjuntos.aprId, apr.id)));
      await tx.insert(movimientoAdjuntos).values({ aprId: apr.id, movimientoId, nombre: leido.nombre, tipo: leido.tipo, tamano: leido.tamano, contenido: leido.contenido });
    });
  } catch (e) {
    console.error("Finanzas: no se pudo adjuntar el comprobante:", e);
    return { ok: false, error: "No pudimos adjuntar el archivo. Inténtalo de nuevo en un momento." };
  }

  // Caja y Giros se actualizan solos con TanStack Query: recargar la página los haría parpadear.
  revalidatePath("/panel/caja");
  return { ok: true };
}
