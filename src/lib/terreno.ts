import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lecturas, socios } from "@/lib/db/schema";
import { anterioresDelComite } from "@/lib/lectura-anterior";

/**
 * Lo que necesita la vista de terreno (cargar lecturas en el celular) y la tabla
 * de la directiva: los arranques del comité y la última lectura aprobada de cada
 * uno, que es la base del consumo y la misma que usa el servidor al aprobar.
 */
export async function sociosConAnterior(aprId: string) {
  const listaSocios = await db.query.socios.findMany({
    where: eq(socios.aprId, aprId),
    orderBy: [asc(socios.nombre)],
    columns: { id: true, nombre: true, rut: true, numeroCliente: true, tipo: true },
  });

  // La misma base que usa el servidor al aprobar: la última lectura aprobada o, si
  // el arranque no tiene ninguna, la lectura actual de su última boleta.
  return {
    listaSocios,
    anteriorPorSocio: await anterioresDelComite(aprId),
  };
}

/**
 * Los datos de la pantalla "Cargar lectura": cualquier usuario del comité (el
 * operador, o la directiva en modo terreno) ve a todos los arranques y sus
 * propias últimas lecturas.
 */
export async function datosTerreno(userId: string, aprId: string) {
  const { listaSocios, anteriorPorSocio } = await sociosConAnterior(aprId);

  const propias = await db.query.lecturas.findMany({
    where: eq(lecturas.registradaPorId, userId),
    orderBy: [desc(lecturas.createdAt)],
    limit: 200,
    with: { socio: { columns: { nombre: true } } },
  });

  return {
    socios: listaSocios.map((s) => {
      const a = anteriorPorSocio.get(s.id);
      return {
        id: s.id,
        nombre: s.nombre,
        rut: s.rut,
        numeroCliente: s.numeroCliente,
        tipo: s.tipo,
        anterior: a ? { valor: a.valor, periodo: a.periodo, origen: a.origen } : null,
      };
    }),
    recientes: propias.map((l) => ({
      id: l.id,
      socio: l.socio.nombre,
      periodo: l.periodo,
      valor: l.valor,
      estado: l.estado,
      motivoRechazo: l.motivoRechazo,
    })),
  };
}
