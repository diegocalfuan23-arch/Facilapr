import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { boletas, socios } from "@/lib/db/schema";
import { anterioresDelComite } from "@/lib/lectura-anterior";
import { requireAdmin } from "@/lib/apr-session";
import { BoletasTabla } from "@/components/panel/boletas-tabla";
import { urlRecibo } from "@/lib/recibo-enlace";
import { envioAutomaticoActivo } from "@/lib/whatsapp-api";

export const metadata: Metadata = {
  title: "Boletas",
};

export default async function BoletasPage() {
  const { apr } = await requireAdmin();

  const listado = await db
    .select({
      id: boletas.id,
      socioId: boletas.socioId,
      socioNombre: socios.nombre,
      socioRut: socios.rut,
      socioTelefono: socios.telefono,
      periodo: boletas.periodo,
      montoTotal: boletas.montoTotal,
      montoPagado: boletas.montoPagado,
      estado: boletas.estado,
      fechaEmision: boletas.fechaEmision,
      fechaVencimiento: boletas.fechaVencimiento,
      lecturaAnterior: boletas.lecturaAnterior,
      lecturaActual: boletas.lecturaActual,
      consumoM3: boletas.consumoM3,
      observacion: boletas.observacion,
    })
    .from(boletas)
    .innerJoin(socios, eq(boletas.socioId, socios.id))
    .where(eq(socios.aprId, apr.id))
    .orderBy(desc(boletas.periodo), asc(socios.nombre));

  const padron = await db.query.socios.findMany({
    where: eq(socios.aprId, apr.id),
    orderBy: [asc(socios.nombre)],
    columns: { id: true, nombre: true, rut: true, numeroCliente: true, tipo: true, uso: true },
  });

  // La lectura anterior de cada arranque: sugiere la anterior al crear una boleta.
  const anteriorDe = new Map([...(await anterioresDelComite(apr.id))].map(([id, a]) => [id, a.valor]));

  return (
    <BoletasTabla
      boletas={listado.map((b) => ({ ...b, reciboUrl: urlRecibo(b.id) }))}
      socios={padron.map((p) => ({ ...p, ultimaLectura: anteriorDe.get(p.id) ?? null }))}
      tarifas={
        apr.tarifaCargoFijo !== null && apr.tarifaMetroCubico !== null
          ? { cargoFijo: apr.tarifaCargoFijo, valorM3: apr.tarifaMetroCubico }
          : null
      }
      tarifasComercial={
        apr.tarifaCargoFijoComercial !== null && apr.tarifaMetroCubicoComercial !== null
          ? { cargoFijo: apr.tarifaCargoFijoComercial, valorM3: apr.tarifaMetroCubicoComercial }
          : null
      }
      comite={{
        nombre: apr.nombre,
        slug: apr.slug,
        infoPago: apr.infoPago,
      }}
      envioAutomatico={envioAutomaticoActivo()}
    />
  );
}
