import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { lecturas, socios } from "@/lib/db/schema";
import { anterioresDelComite } from "@/lib/lectura-anterior";
import { aprobadasPorSocio, promedioDe, type LecturaCalculo } from "@/lib/lecturas-calculos";

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

  // Quién ya tiene lectura en los últimos meses (la registre quien la registre): arma la «ruta» del mes.
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);
  const desdePeriodo = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, "0")}`;
  const delComite = await db
    .select({ socioId: lecturas.socioId, periodo: lecturas.periodo, estado: lecturas.estado })
    .from(lecturas)
    .innerJoin(socios, eq(socios.id, lecturas.socioId))
    .where(and(eq(socios.aprId, aprId), gte(lecturas.periodo, desdePeriodo), inArray(lecturas.estado, ["PENDIENTE", "APROBADA"])));

  // Las lecturas aprobadas de los últimos meses: de ahí salen el promedio de consumo de cada socio (para avisar de
  // un consumo muy alto) y lo que consumió cada lectura que cargó el operador.
  const desdePromedio = new Date(hoy.getFullYear(), hoy.getMonth() - 8, 1);
  const desdePromedioPeriodo = `${desdePromedio.getFullYear()}-${String(desdePromedio.getMonth() + 1).padStart(2, "0")}`;
  const aprobadas = await db
    .select({ id: lecturas.id, socioId: lecturas.socioId, periodo: lecturas.periodo, valor: lecturas.valor })
    .from(lecturas)
    .innerJoin(socios, eq(socios.id, lecturas.socioId))
    .where(and(eq(socios.aprId, aprId), eq(lecturas.estado, "APROBADA"), gte(lecturas.periodo, desdePromedioPeriodo)))
    .catch(() => []);
  const aprobadasMap = aprobadasPorSocio<LecturaCalculo>(
    aprobadas.map((l) => ({ ...l, estado: "APROBADA" as const, inicial: false, anterior: null }))
  );
  /** Lo que consumió una lectura: contra la última aprobada de un período anterior. */
  const consumoDe = (socioId: string, periodo: string, valor: number) => {
    const previas = (aprobadasMap.get(socioId) ?? []).filter((x) => x.periodo < periodo);
    return previas.length ? valor - previas[previas.length - 1].valor : null;
  };

  return {
    leidas: delComite.map((l) => ({ socioId: l.socioId, periodo: l.periodo, estado: l.estado as "PENDIENTE" | "APROBADA" })),
    socios: listaSocios.map((s) => {
      const a = anteriorPorSocio.get(s.id);
      return {
        id: s.id,
        nombre: s.nombre,
        rut: s.rut,
        numeroCliente: s.numeroCliente,
        tipo: s.tipo,
        anterior: a ? { valor: a.valor, periodo: a.periodo, origen: a.origen } : null,
        promedio: promedioDe(s.id, aprobadasMap),
      };
    }),
    recientes: propias.map((l) => ({
      id: l.id,
      socioId: l.socioId,
      socio: l.socio.nombre,
      consumo: consumoDe(l.socioId, l.periodo, l.valor),
      periodo: l.periodo,
      valor: l.valor,
      estado: l.estado,
      motivoRechazo: l.motivoRechazo,
    })),
  };
}
