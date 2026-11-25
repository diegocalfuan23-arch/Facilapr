import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { siiConfigs, siiFolios } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/apr-session";
import { cifradoListo, siiHabilitado } from "@/lib/sii/seguridad";
import { SiiVista } from "@/components/panel/sii-vista";

export const metadata: Metadata = {
  title: "Boletas SII",
};

export default async function SiiPage() {
  const { apr } = await requireAdmin();
  // Solo los comités activados la ven: no se muestra ni por la dirección directa.
  if (!siiHabilitado(apr.slug)) redirect("/panel");

  // Nunca se traen el certificado, su clave ni el contenido de los folios: la pantalla no los necesita.
  const [config, folios] = await Promise.all([
    db.query.siiConfigs.findFirst({
      where: eq(siiConfigs.aprId, apr.id),
      columns: { certificado: false, certificadoClave: false },
    }),
    db.query.siiFolios.findMany({
      where: eq(siiFolios.aprId, apr.id),
      columns: { id: true, tipo: true, desde: true, hasta: true, siguiente: true, fechaAutorizacion: true },
      orderBy: [asc(siiFolios.tipo), asc(siiFolios.desde)],
    }),
  ]);

  return (
    <SiiVista
      comite={{ nombre: apr.nombre, razonSocial: apr.razonSocial, rut: apr.rut, direccion: apr.direccion, comuna: apr.comuna }}
      listo={cifradoListo()}
      emisor={config ?? null}
      folios={folios}
    />
  );
}
