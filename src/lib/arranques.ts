import { and, asc, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, socios } from "@/lib/db/schema";
import { anterioresDelComite } from "@/lib/lectura-anterior";
import { cortadosActuales, ordenesDelComite } from "@/lib/ordenes-datos";

export type EstadoArranque = "CORTADO" | "INACTIVO" | "MOROSO" | "AL_DIA";

export const TEXTO_ESTADO_ARRANQUE: Record<EstadoArranque, string> = {
  CORTADO: "Cortado",
  INACTIVO: "Inactivo",
  MOROSO: "Con deuda vencida",
  AL_DIA: "Al día",
};

export type ArranqueFila = {
  id: string;
  /** El N.º de cliente o de arranque, si el comité lo lleva. */
  numero: string | null;
  nombre: string;
  rut: string | null;
  direccion: string | null;
  tipo: "SOCIO" | "USUARIO";
  uso: "RESIDENCIAL" | "COMERCIAL";
  estado: EstadoArranque;
  /** Lo que debe en boletas impagas, en pesos. */
  deuda: number;
  boletasVencidas: number;
  /** La lectura del medidor más reciente (aprobada, o la de su última boleta). */
  ultimaLectura: { valor: number; periodo: string } | null;
  /** El consumo de su última boleta. */
  ultimoConsumo: { m3: number; periodo: string } | null;
};

/**
 * El catastro de arranques del comité: cada conexión con su socio, su estado (al día, con deuda,
 * cortado o inactivo), su última lectura y su último consumo. Se arma con lo que ya existe
 * (socios, boletas, lecturas y cortes); no guarda nada propio.
 */
export async function listarArranques(aprId: string): Promise<ArranqueFila[]> {
  const [lista, deudas, consumos, anteriores, ordenes] = await Promise.all([
    db
      .select({
        id: socios.id,
        numero: socios.numeroCliente,
        nombre: socios.nombre,
        rut: socios.rut,
        direccion: socios.direccion,
        tipo: socios.tipo,
        uso: socios.uso,
        activo: socios.activo,
      })
      .from(socios)
      .where(eq(socios.aprId, aprId))
      .orderBy(asc(socios.nombre)),
    db
      .select({
        socioId: boletas.socioId,
        deuda: sql<number>`coalesce(sum(${boletas.montoTotal} - ${boletas.montoPagado}), 0)::int`,
        vencidas: sql<number>`count(*) filter (where ${boletas.fechaVencimiento} < now())::int`,
      })
      .from(boletas)
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .where(and(eq(socios.aprId, aprId), ne(boletas.estado, "ANULADA"), sql`${boletas.montoPagado} < ${boletas.montoTotal}`))
      .groupBy(boletas.socioId),
    db
      .selectDistinctOn([boletas.socioId], { socioId: boletas.socioId, m3: boletas.consumoM3, periodo: boletas.periodo })
      .from(boletas)
      .innerJoin(socios, eq(boletas.socioId, socios.id))
      .where(and(eq(socios.aprId, aprId), ne(boletas.estado, "ANULADA"), isNotNull(boletas.consumoM3)))
      .orderBy(boletas.socioId, desc(boletas.periodo)),
    anterioresDelComite(aprId).catch(() => new Map()),
    ordenesDelComite(aprId, ["COMPLETADA"]).catch(() => []),
  ]);

  const deudaDe = new Map(deudas.map((d) => [d.socioId, d]));
  const consumoDe = new Map(consumos.map((c) => [c.socioId, c]));
  const cortados = new Set(cortadosActuales(ordenes).map((o) => o.socioId));

  return lista.map((s) => {
    const d = deudaDe.get(s.id);
    const c = consumoDe.get(s.id);
    const a = anteriores.get(s.id);
    const vencidas = d?.vencidas ?? 0;
    const estado: EstadoArranque = cortados.has(s.id) ? "CORTADO" : !s.activo ? "INACTIVO" : vencidas > 0 ? "MOROSO" : "AL_DIA";
    return {
      id: s.id,
      numero: s.numero,
      nombre: s.nombre,
      rut: s.rut,
      direccion: s.direccion,
      tipo: s.tipo,
      uso: s.uso,
      estado,
      deuda: d?.deuda ?? 0,
      boletasVencidas: vencidas,
      ultimaLectura: a ? { valor: a.valor, periodo: a.periodo } : null,
      ultimoConsumo: c && c.m3 !== null ? { m3: c.m3, periodo: c.periodo } : null,
    };
  });
}
