import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, lecturas, socios } from "@/lib/db/schema";

/**
 * La lectura anterior de un arranque: el número del medidor con el que se
 * compara la nueva para sacar el consumo. Es la última lectura aprobada; si el
 * arranque no tiene ninguna (por ejemplo, su historial entró como boletas), la
 * lectura actual de su última boleta. Nunca se adivina: si no hay ni una ni otra,
 * es la primera lectura y se usa como punto de partida.
 *
 * Todas las pantallas y cálculos usan esto, para que lo que se muestra al
 * cargar una lectura sea lo mismo que se usa al aprobarla.
 */
export type AnteriorLectura = {
  socioId: string;
  valor: number;
  /** "AAAA-MM" de la lectura o de la boleta. */
  periodo: string;
  /** De dónde sale el dato. */
  origen: "LECTURA" | "BOLETA";
};

type Candidato = { socioId: string; valor: number | null; periodo: string };

/** Manda la lectura; solo gana la boleta si es de un período posterior (una cargada a mano, más nueva). */
function elegir(lectura: Candidato | undefined, boleta: Candidato | undefined): AnteriorLectura | null {
  const delaBoleta = boleta && boleta.valor !== null ? { ...boleta, valor: boleta.valor } : null;
  if (lectura && lectura.valor !== null) {
    if (delaBoleta && delaBoleta.periodo > lectura.periodo) return { ...delaBoleta, origen: "BOLETA" };
    return { ...lectura, valor: lectura.valor, origen: "LECTURA" };
  }
  return delaBoleta ? { ...delaBoleta, origen: "BOLETA" } : null;
}

async function consultar(filtroSocios: ReturnType<typeof eq> | ReturnType<typeof inArray>) {
  const deLecturas = await db
    .selectDistinctOn([lecturas.socioId], {
      socioId: lecturas.socioId,
      valor: lecturas.valor,
      periodo: lecturas.periodo,
    })
    .from(lecturas)
    .innerJoin(socios, eq(lecturas.socioId, socios.id))
    .where(and(filtroSocios, eq(lecturas.estado, "APROBADA")))
    .orderBy(lecturas.socioId, desc(lecturas.createdAt));

  const deBoletas = await db
    .selectDistinctOn([boletas.socioId], {
      socioId: boletas.socioId,
      valor: boletas.lecturaActual,
      periodo: boletas.periodo,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(and(filtroSocios, ne(boletas.estado, "ANULADA"), isNotNull(boletas.lecturaActual)))
    .orderBy(boletas.socioId, desc(boletas.periodo));

  const lecPorSocio = new Map(deLecturas.map((l) => [l.socioId, l]));
  const bolPorSocio = new Map(deBoletas.map((b) => [b.socioId, b]));

  const resultado = new Map<string, AnteriorLectura>();
  for (const id of new Set([...lecPorSocio.keys(), ...bolPorSocio.keys()])) {
    const a = elegir(lecPorSocio.get(id), bolPorSocio.get(id));
    if (a) resultado.set(id, a);
  }
  return resultado;
}

/** La lectura anterior de cada arranque del comité que tenga una. */
export function anterioresDelComite(aprId: string) {
  return consultar(eq(socios.aprId, aprId));
}

/** La lectura anterior de un arranque; null si es su primera lectura. */
export async function anteriorDelSocio(socioId: string): Promise<AnteriorLectura | null> {
  return (await consultar(eq(socios.id, socioId))).get(socioId) ?? null;
}
