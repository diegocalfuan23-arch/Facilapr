import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { arranqueSocios, arranques, socios } from "@/lib/db/schema";
import { faltaEsquema } from "@/lib/db-errores";
import type { ArranqueFila, DatosArranques } from "@/lib/arranques-comun";

export * from "@/lib/arranques-comun";

/**
 * Los arranques del comité y a qué socios abastece cada uno, más todos los socios para poder
 * asignarlos. Si las tablas todavía no existen en la base, devuelve vacío y lo avisa.
 */
export async function listarArranques(aprId: string): Promise<DatosArranques> {
  const todosLosSocios = await db
    .select({ id: socios.id, nombre: socios.nombre, numero: socios.numeroCliente, rut: socios.rut })
    .from(socios)
    .where(eq(socios.aprId, aprId))
    .orderBy(asc(socios.nombre));

  try {
    const filas = await db.select().from(arranques).where(eq(arranques.aprId, aprId)).orderBy(asc(arranques.nombre));
    const vinculos = await db
      .select({ arranqueId: arranqueSocios.arranqueId, socioId: arranqueSocios.socioId })
      .from(arranqueSocios)
      .innerJoin(arranques, eq(arranqueSocios.arranqueId, arranques.id))
      .where(eq(arranques.aprId, aprId));

    const sociosPorId = new Map(todosLosSocios.map((s) => [s.id, s]));
    const arranquePorSocio = new Map(vinculos.map((v) => [v.socioId, v.arranqueId]));
    const delArranque = new Map<string, ArranqueFila["socios"]>();
    for (const v of vinculos) {
      const s = sociosPorId.get(v.socioId);
      if (!s) continue;
      const lista = delArranque.get(v.arranqueId) ?? [];
      lista.push({ id: s.id, nombre: s.nombre, numero: s.numero });
      delArranque.set(v.arranqueId, lista);
    }

    return {
      sinTablas: false,
      arranques: filas.map((a) => ({ id: a.id, nombre: a.nombre, ubicacion: a.ubicacion, lat: a.lat, lng: a.lng, notas: a.notas, socios: delArranque.get(a.id) ?? [] })),
      socios: todosLosSocios.map((s) => ({ ...s, arranqueId: arranquePorSocio.get(s.id) ?? null })),
    };
  } catch (e) {
    if (!faltaEsquema(e)) throw e;
    console.error("Arranques: faltan las tablas en la base de datos:", e);
    return { sinTablas: true, arranques: [], socios: todosLosSocios.map((s) => ({ ...s, arranqueId: null })) };
  }
}
