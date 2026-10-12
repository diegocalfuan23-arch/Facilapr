import type { Metadata } from "next";
import { cuentasDelSocio, requireSocio } from "@/lib/socio-session";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { cortadosActuales, ordenesDeSocios } from "@/lib/ordenes-datos";
import { TituloPantalla } from "@/components/socio/boletas-ui";
import { SolicitudesSocio } from "@/components/socio/solicitudes-socio";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Mis solicitudes" };

export default async function SolicitudesSocioPage({ params }: Props) {
  const { slug } = await params;
  const { socio } = await requireSocio(slug);
  const cuentas = await cuentasDelSocio(socio);
  const ids = cuentas.map((c) => c.id);

  const [lista, arranques] = await Promise.all([
    ordenesDeSocios(ids),
    db.query.socios.findMany({
      where: inArray(socios.id, ids),
      columns: { id: true, nombre: true, direccion: true, activo: true },
    }),
  ]);
  const cortados = new Set(cortadosActuales(lista).map((o) => o.socioId));

  return (
    <>
      <TituloPantalla
        titulo="Tus solicitudes"
        descripcion="Reclamos, reparaciones, reposición del servicio o baja."
      />
      <SolicitudesSocio
        slug={slug}
        arranques={arranques.map((a) => ({ ...a, cortado: cortados.has(a.id) }))}
        solicitudes={lista.map((o) => ({
          id: o.id,
          tipo: o.tipo,
          estado: o.estado,
          detalle: o.detalle,
          // Solo reclamos y bajas llevan respuesta escrita; en terreno la nota es del técnico.
          respuesta: o.tipo === "RECLAMO" || o.tipo === "BAJA" || o.tipo === "REANUDACION" ? o.respuesta : null,
          creada: o.creada,
          arranque: o.socioNombre,
        }))}
      />
    </>
  );
}
