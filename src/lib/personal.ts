import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pagosTrabajador, trabajadores } from "@/lib/db/schema";
import type { Contrato, PagoTrabajadorFila, TrabajadorFila } from "@/lib/personal-comun";

export * from "@/lib/personal-comun";

/** Las personas del comité con lo pagado en `periodo` (AAAA-MM). Si las tablas no existen, devuelve vacío. */
export async function listarTrabajadores(aprId: string, periodo: string): Promise<TrabajadorFila[]> {
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
        pagadoMes: sql<number>`coalesce((select sum(p."monto") from "PagoTrabajador" p where p."trabajadorId" = ${trabajadores.id} and p."periodo" = ${periodo}), 0)::int`,
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

/** Los últimos pagos a personal, del más nuevo al más antiguo. */
export async function listarPagosPersonal(aprId: string): Promise<PagoTrabajadorFila[]> {
  return db
    .select({
      id: pagosTrabajador.id,
      trabajadorId: pagosTrabajador.trabajadorId,
      trabajador: trabajadores.nombre,
      periodo: pagosTrabajador.periodo,
      fecha: pagosTrabajador.fecha,
      monto: pagosTrabajador.monto,
      medio: pagosTrabajador.medio,
      nota: pagosTrabajador.nota,
    })
    .from(pagosTrabajador)
    .innerJoin(trabajadores, eq(trabajadores.id, pagosTrabajador.trabajadorId))
    .where(eq(pagosTrabajador.aprId, aprId))
    .orderBy(desc(pagosTrabajador.fecha), desc(pagosTrabajador.createdAt))
    .limit(200)
    .catch((e) => {
      console.error("Personal: no se pudieron leer los pagos:", e);
      return [];
    });
}
