import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { cortadosActuales, morososParaCorte, ordenesDelComite } from "@/lib/ordenes-datos";
import { CortesPanel } from "@/components/panel/cortes-panel";

export const metadata: Metadata = {
  title: "Cortes",
};

export default async function CortesPage() {
  const { apr } = await requireAdmin();

  const ordenes = await ordenesDelComite(apr.id);
  const cortados = cortadosActuales(ordenes);

  // No se sugiere cortar a quien ya tiene un corte en curso o ya está cortado.
  const excluir = new Set([
    ...cortados.map((o) => o.socioId),
    ...ordenes
      .filter((o) => o.tipo === "CORTE" && ["SOLICITADA", "EN_TRAMITE", "POR_CONFIRMAR"].includes(o.estado))
      .map((o) => o.socioId),
  ]);
  const morosos = await morososParaCorte(apr.id, apr.diasGraciaCorte, excluir);

  const padron = await db.query.socios.findMany({
    where: eq(socios.aprId, apr.id),
    orderBy: [asc(socios.nombre)],
    columns: { id: true, nombre: true, rut: true, numeroCliente: true, tipo: true },
  });

  return (
    <CortesPanel
      ordenes={ordenes}
      cortados={cortados}
      morosos={morosos}
      socios={padron}
      diasGracia={apr.diasGraciaCorte}
      comite={{
        nombre: apr.nombre,
        slug: apr.slug,
        infoPago: apr.infoPago,
        diasAviso: apr.diasAvisoCorte,
        costoReconexion: apr.costoReconexion,
      }}
    />
  );
}
