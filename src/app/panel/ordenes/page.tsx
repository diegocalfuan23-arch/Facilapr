import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";
import { requireApr } from "@/lib/apr-session";
import { ordenesDelComite } from "@/lib/ordenes-datos";
import { OrdenesTecnico } from "@/components/panel/ordenes-tecnico";

export const metadata: Metadata = {
  title: "Órdenes",
};

/** Las órdenes de terreno, para el técnico y para la directiva cuando sale ella. */
export default async function OrdenesPage() {
  const { apr } = await requireApr();

  const abiertas = await ordenesDelComite(apr.id, ["EN_TRAMITE", "POR_CONFIRMAR"]);
  const padron = await db.query.socios.findMany({
    where: eq(socios.aprId, apr.id),
    orderBy: [asc(socios.nombre)],
    columns: { id: true, nombre: true, rut: true, numeroCliente: true, tipo: true },
  });

  return (
    <OrdenesTecnico
      pendientes={abiertas.filter((o) => o.estado === "EN_TRAMITE")}
      esperandoAlta={abiertas.filter((o) => o.estado === "POR_CONFIRMAR").length}
      socios={padron}
    />
  );
}
