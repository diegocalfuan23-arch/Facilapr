import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { arranqueSocios, arranques, boletas, lecturas, socios } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/auth-schema";
import { formatearRut } from "@/lib/formato";
import { sociosConAnterior } from "@/lib/terreno";
import type { LecturaFila, SocioOpcion } from "@/components/panel/lecturas-tabla";

/** Todo lo que muestra la pantalla de Lecturas de la directiva y que cambia al aprobar, rechazar o cargar lecturas. */
export type DatosLecturas = {
  lecturas: LecturaFila[];
  socios: SocioOpcion[];
  /** El nombre del arranque (nodo de la red) de cada socio, para ordenar la ruta. */
  arranquePorSocio: Record<string, string>;
};

/**
 * Los datos de la pantalla de Lecturas de la directiva. La usan la página (al abrirse) y la acción que vuelve a pedirlos
 * sin recargar.
 */
export async function datosLecturas(aprId: string): Promise<DatosLecturas> {
  const { listaSocios, anteriorPorSocio } = await sociosConAnterior(aprId);

  // Todas las lecturas del comité, no solo las pendientes: la directiva
  // necesita ver también lo ya resuelto. Tope alto por si el padrón es grande.
  const todas = await db
    .select({
      id: lecturas.id,
      periodo: lecturas.periodo,
      valor: lecturas.valor,
      observacion: lecturas.observacion,
      estado: lecturas.estado,
      motivoRechazo: lecturas.motivoRechazo,
      createdAt: lecturas.createdAt,
      socioId: lecturas.socioId,
      socioNombre: socios.nombre,
      socioRut: socios.rut,
      registradaPor: userTable.name,
      boletaId: boletas.id,
    })
    .from(lecturas)
    .innerJoin(socios, eq(lecturas.socioId, socios.id))
    // Una lectura aprobada sin boleta del mismo período es una lectura inicial.
    .leftJoin(boletas, and(eq(boletas.socioId, lecturas.socioId), eq(boletas.periodo, lecturas.periodo)))
    .leftJoin(userTable, eq(lecturas.registradaPorId, userTable.id))
    .where(eq(socios.aprId, aprId))
    .orderBy(desc(lecturas.createdAt))
    .limit(1500);

  // El arranque (nodo de la red) de cada socio ordena la ruta. Si la tabla todavía no existe, la ruta se ordena solo por número.
  const arranquePorSocio: Record<string, string> = {};
  try {
    const filas = await db
      .select({ socioId: arranqueSocios.socioId, nombre: arranques.nombre })
      .from(arranqueSocios)
      .innerJoin(arranques, eq(arranqueSocios.arranqueId, arranques.id))
      .where(eq(arranques.aprId, aprId));
    for (const f of filas) arranquePorSocio[f.socioId] = f.nombre;
  } catch (e) {
    console.error("Lecturas: no se pudieron leer los arranques:", e);
  }

  return {
    arranquePorSocio,
    socios: listaSocios.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      rut: s.rut,
      numeroCliente: s.numeroCliente,
      tipo: s.tipo,
      // La última lectura aprobada: el dato con el que se compara la nueva.
      ultimaLectura: anteriorPorSocio.get(s.id)?.valor ?? null,
    })),
    lecturas: todas.map((l) => ({
      id: l.id,
      socio: l.socioNombre,
      rut: formatearRut(l.socioRut),
      periodo: l.periodo,
      valor: l.valor,
      observacion: l.observacion,
      estado: l.estado,
      motivoRechazo: l.motivoRechazo,
      registradaPor: l.registradaPor,
      createdAt: l.createdAt,
      anterior: anteriorPorSocio.get(l.socioId)?.valor ?? null,
      socioId: l.socioId,
      inicial: l.estado === "APROBADA" && l.boletaId === null,
    })),
  };
}
