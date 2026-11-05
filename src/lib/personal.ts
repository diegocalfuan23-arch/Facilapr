import { asc, desc, eq, inArray, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { trabajadores } from "@/lib/db/schema";
import { user as usuarios } from "@/lib/db/auth-schema";
import type { AccesoPanel, Contrato, CuentaPanel, TrabajadorFila } from "@/lib/personal-comun";

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
        afp: trabajadores.afp,
        afpTasa: trabajadores.afpTasa,
        saludTasa: trabajadores.saludTasa,
        cesantia: trabajadores.cesantia,
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

/** Las personas con cuenta en el panel del comité y con qué rol entran. Sirve para ligarlas a su ficha por el correo. */
export async function cuentasDelPanel(aprId: string): Promise<CuentaPanel[]> {
  try {
    const filas = await db
      .select({ nombre: usuarios.name, email: usuarios.email, rol: usuarios.rol })
      .from(usuarios)
      .where(and(eq(usuarios.aprId, aprId), inArray(usuarios.rol, ["ADMIN", "OPERADOR", "TESORERO", "DESACTIVADO", "DESACTIVADO_TESORERO"])));
    return filas.map((f) => ({
      nombre: f.nombre,
      email: f.email.toLowerCase(),
      acceso: (f.rol.startsWith("DESACTIVADO") ? "DESACTIVADO" : f.rol) as AccesoPanel,
    }));
  } catch (e) {
    console.error("Personal: no se pudieron leer las cuentas del panel:", e);
    return [];
  }
}
