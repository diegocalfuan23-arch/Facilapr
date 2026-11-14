"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, lecturas, pagos, socios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { textoMedioPago } from "@/lib/pagos";

/** Lo que muestra la ficha del socio al lado de su conversación. Las fechas van como AAAA-MM-DD, en hora de Chile. */
export type FichaSocio = {
  boleta: { periodo: string; monto: number; vence: string; estado: "Pendiente" | "Pagada" | "Vencida" } | null;
  /** Los últimos meses con boleta, del más viejo al más nuevo. */
  consumo: { periodo: string; m3: number }[];
  actividad: { titulo: string; detalle: string; fecha: string; color: "morado" | "azul" | "verde" }[];
  /** La cuenta en línea del socio, para mandarle el enlace. Null si el comité no tiene dirección propia. */
  portal: string | null;
};

const dia = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" });
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const corta = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;

/** La ficha de un socio del comité: su última boleta, su consumo reciente y lo último que le pasó. Solo la directiva. */
export async function fichaDelSocio(socioId: string): Promise<FichaSocio | null> {
  const { apr } = await requireAdmin();
  if (!puede(apr.plan as Plan, "chat")) return null;

  // El filtro por comité impide pedir la ficha de un socio de otro.
  const [socio] = await db.select({ id: socios.id }).from(socios).where(and(eq(socios.id, socioId), eq(socios.aprId, apr.id))).limit(1);
  if (!socio) return null;

  const [filas, [lectura], [pago]] = await Promise.all([
    db
      .select({
        periodo: boletas.periodo,
        total: boletas.montoTotal,
        pagado: boletas.montoPagado,
        vence: boletas.fechaVencimiento,
        emision: boletas.fechaEmision,
        m3: boletas.consumoM3,
      })
      .from(boletas)
      .where(and(eq(boletas.socioId, socioId), sql`${boletas.estado} <> 'ANULADA'`))
      .orderBy(desc(boletas.periodo))
      .limit(6),
    db
      .select({ valor: lecturas.valor, fecha: lecturas.updatedAt })
      .from(lecturas)
      .where(and(eq(lecturas.socioId, socioId), eq(lecturas.estado, "APROBADA")))
      .orderBy(desc(lecturas.updatedAt))
      .limit(1),
    db
      .select({ monto: pagos.monto, fecha: pagos.fecha, medio: pagos.medio })
      .from(pagos)
      .leftJoin(boletas, eq(pagos.boletaId, boletas.id))
      .where(sql`coalesce(${pagos.socioId}, ${boletas.socioId}) = ${socioId}`)
      .orderBy(desc(pagos.fecha))
      .limit(1),
  ]);

  const ultima = filas[0];
  const ahora = Date.now();
  const actividad: FichaSocio["actividad"] = [];
  if (ultima) actividad.push({ titulo: "Boleta emitida", detalle: `${clp.format(ultima.total)} · ${corta(dia.format(ultima.emision))}`, fecha: dia.format(ultima.emision), color: "morado" });
  if (lectura) actividad.push({ titulo: "Lectura aprobada", detalle: `Medidor en ${lectura.valor.toLocaleString("es-CL")} · ${corta(dia.format(lectura.fecha))}`, fecha: dia.format(lectura.fecha), color: "azul" });
  if (pago) actividad.push({ titulo: "Pago registrado", detalle: `${clp.format(pago.monto)} · ${corta(dia.format(pago.fecha))} · ${textoMedioPago(pago.medio)}`, fecha: dia.format(pago.fecha), color: "verde" });
  actividad.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const dominio = process.env.NEXT_PUBLIC_DOMINIO_RAIZ ?? "facilapr.cl";

  return {
    boleta: ultima
      ? { periodo: ultima.periodo, monto: ultima.total, vence: dia.format(ultima.vence), estado: ultima.pagado >= ultima.total ? "Pagada" : ultima.vence.getTime() < ahora ? "Vencida" : "Pendiente" }
      : null,
    consumo: [...filas].reverse().map((f) => ({ periodo: f.periodo, m3: f.m3 ?? 0 })),
    actividad,
    portal: apr.slug ? `https://${dominio}/${apr.slug}/cuenta` : null,
  };
}
