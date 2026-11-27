import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, pagos, socios } from "@/lib/db/schema";
import { cuentasDelSocio } from "@/lib/socio-session";
import { ordenesDeSocios } from "@/lib/ordenes-datos";
import { ESTADOS_ORDEN, TIPOS_ORDEN } from "@/lib/ordenes";
import { formatearPeriodo, saldo } from "@/lib/boletas";
import { textoConcepto, textoMedioPago } from "@/lib/pagos";

/** Todo lo de una persona en una sola vista: sus arranques (mismo RUT) con consumo, deuda, boletas, pagos y solicitudes. */
export type FichaSocio = {
  arranques: { id: string; nombre: string; numero: string | null }[];
  deuda: number;
  boletasPendientes: number;
  /** Los últimos doce períodos con consumo, del más antiguo al más nuevo, sumando sus arranques. */
  consumo: { periodo: string; m3: number }[];
  boletas: { id: string; arranque: string; periodo: string; m3: number | null; total: number; saldo: number }[];
  pagos: { id: string; fecha: string; monto: number; medio: string; que: string }[];
  solicitudes: { id: string; tipo: string; estado: string; fecha: string; arranque: string }[];
};

/** Null si la persona no es de ese comité. */
export async function fichaSocio(aprId: string, socioId: string): Promise<FichaSocio | null> {
  const socio = await db.query.socios.findFirst({
    where: and(eq(socios.id, socioId), eq(socios.aprId, aprId)),
    columns: { id: true, nombre: true, aprId: true, rut: true },
  });
  if (!socio) return null;

  const ids = (await cuentasDelSocio(socio)).map((c) => c.id);

  const [arranques, listaBoletas, listaPagos, ordenes] = await Promise.all([
    db
      .select({ id: socios.id, nombre: socios.nombre, numero: socios.numeroCliente })
      .from(socios)
      .where(inArray(socios.id, ids)),
    db
      .select()
      .from(boletas)
      .where(and(inArray(boletas.socioId, ids), ne(boletas.estado, "ANULADA")))
      .orderBy(desc(boletas.periodo)),
    // Los pagos antiguos de boletas pueden no traer el socio: se encuentran por la boleta.
    db
      .select({
        id: pagos.id,
        fecha: pagos.fecha,
        monto: pagos.monto,
        medio: pagos.medio,
        concepto: pagos.concepto,
        descripcion: pagos.descripcion,
        periodo: boletas.periodo,
      })
      .from(pagos)
      .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
      .where(or(inArray(pagos.socioId, ids), inArray(boletas.socioId, ids)))
      .orderBy(desc(pagos.fecha))
      .limit(60),
    ordenesDeSocios(ids),
  ]);

  const nombre = new Map(arranques.map((a) => [a.id, a.numero ? `N.º ${a.numero}` : a.nombre]));
  const porPeriodo = new Map<string, number>();
  for (const b of listaBoletas) {
    if (b.consumoM3 !== null) porPeriodo.set(b.periodo, (porPeriodo.get(b.periodo) ?? 0) + b.consumoM3);
  }
  const conDeuda = listaBoletas.filter((b) => saldo(b.montoTotal, b.montoPagado) > 0);

  return {
    arranques,
    deuda: conDeuda.reduce((s, b) => s + saldo(b.montoTotal, b.montoPagado), 0),
    boletasPendientes: conDeuda.length,
    consumo: [...porPeriodo]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([periodo, m3]) => ({ periodo, m3 })),
    boletas: listaBoletas.map((b) => ({
      id: b.id,
      arranque: nombre.get(b.socioId) ?? "",
      periodo: b.periodo,
      m3: b.consumoM3,
      total: b.montoTotal,
      saldo: saldo(b.montoTotal, b.montoPagado),
    })),
    pagos: listaPagos.map((p) => ({
      id: p.id,
      fecha: p.fecha.toISOString(),
      monto: p.monto,
      medio: textoMedioPago(p.medio),
      que: p.periodo ? formatearPeriodo(p.periodo) : p.descripcion || textoConcepto(p.concepto),
    })),
    solicitudes: ordenes.map((o) => ({
      id: o.id,
      tipo: TIPOS_ORDEN[o.tipo].texto,
      estado: ESTADOS_ORDEN[o.estado],
      fecha: o.creada,
      arranque: nombre.get(o.socioId) ?? "",
    })),
  };
}
