import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, socios, subsidios } from "@/lib/db/schema";
import { montoDeSubsidio, subsidioVigente, type ReglaSubsidio } from "@/lib/boletas";

/** El subsidio que se le aplica a un arranque en un mes; null si no tiene o no está vigente. */
export async function subsidioDe(socioId: string, periodo: string): Promise<ReglaSubsidio | null> {
  const fila = await db.query.subsidios.findFirst({ where: eq(subsidios.socioId, socioId) });
  return subsidioVigente(fila, periodo);
}

/** Los subsidios del comité por socio, para calcular muchas boletas de una vez. */
export async function subsidiosDelApr(aprId: string) {
  const filas = await db
    .select({
      socioId: subsidios.socioId,
      tipo: subsidios.tipo,
      valor: subsidios.valor,
      topeM3: subsidios.topeM3,
      desde: subsidios.desde,
      hasta: subsidios.hasta,
    })
    .from(subsidios)
    .innerJoin(socios, eq(socios.id, subsidios.socioId))
    .where(eq(socios.aprId, aprId));
  return new Map(filas.map((f) => [f.socioId, f]));
}

/**
 * Las boletas de un mes cuyo subsidio no coincide con lo que hoy corresponde: les falta, les sobra o cambió.
 * Solo las calculadas con lecturas y sin pagos, que son las que se pueden cambiar.
 */
export async function boletasPorAplicar(aprId: string, periodo: string) {
  const porSocio = await subsidiosDelApr(aprId);
  const filas = await db
    .select({
      id: boletas.id,
      socioId: boletas.socioId,
      cargoFijo: boletas.cargoFijo,
      valorM3: boletas.valorM3,
      consumoM3: boletas.consumoM3,
      montoSubsidio: boletas.montoSubsidio,
      estado: boletas.estado,
      vence: boletas.fechaVencimiento,
    })
    .from(boletas)
    .innerJoin(socios, eq(socios.id, boletas.socioId))
    .where(
      and(
        eq(socios.aprId, aprId),
        eq(boletas.periodo, periodo),
        eq(boletas.montoPagado, 0),
        ne(boletas.estado, "ANULADA"),
        isNotNull(boletas.cargoFijo),
        isNotNull(boletas.valorM3),
        isNotNull(boletas.consumoM3)
      )
    );

  return filas.flatMap((b) => {
    const montoSubsidio = montoDeSubsidio(b.cargoFijo!, b.valorM3!, b.consumoM3!, subsidioVigente(porSocio.get(b.socioId), periodo));
    if (montoSubsidio === b.montoSubsidio) return [];
    const montoTotal = b.cargoFijo! + b.consumoM3! * b.valorM3! - montoSubsidio;
    return [{ id: b.id, socioId: b.socioId, estado: b.estado, vence: b.vence, montoSubsidio, montoTotal }];
  });
}
