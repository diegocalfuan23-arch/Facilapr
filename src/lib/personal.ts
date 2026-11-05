import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trabajadores } from "@/lib/db/schema";
import type { Contrato, TrabajadorFila } from "@/lib/personal-comun";

export * from "@/lib/personal-comun";

/** Las personas del comité, las activas primero. Si la tabla no existe, devuelve vacío. */
export async function listarTrabajadores(aprId: string): Promise<TrabajadorFila[]> {
  try {
    const filas = await db
      .select({
        id: trabajadores.id,
        nombre: trabajadores.nombre,
        rut: trabajadores.rut,
        cargo: trabajadores.cargo,
        telefono: trabajadores.telefono,
        email: trabajadores.email,
        contrato: trabajadores.contrato,
        sueldo: trabajadores.sueldo,
        fechaIngreso: trabajadores.fechaIngreso,
        activo: trabajadores.activo,
        notas: trabajadores.notas,
      })
      .from(trabajadores)
      .where(eq(trabajadores.aprId, aprId))
      .orderBy(desc(trabajadores.activo), asc(trabajadores.nombre));
    return filas.map((f) => ({ ...f, contrato: f.contrato as Contrato }));
  } catch (e) {
    console.error("Personal: no se pudieron leer las personas:", e);
    return [];
  }
}
