import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cargarSitio } from "@/lib/sitio";
import { SitioApr } from "@/components/sitio/sitio-apr";

/**
 * Landing servida en el dominio propio del comité (plan Premium). El proxy
 * reescribe aquí pasando el host; la resolución del comité ocurre en la base.
 */
type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host } = await params;
  const datos = await cargarSitio({ dominio: decodeURIComponent(host) });
  if (!datos) return { title: "Sitio no encontrado" };

  const descripcion =
    datos.apr.sitioDescripcion ??
    `Comité de Agua Potable Rural de ${datos.apr.comuna}. Contacto, avisos de corte e información de pago.`;

  return {
    title: datos.apr.nombre,
    description: descripcion,
    openGraph: {
      title: datos.apr.nombre,
      description: descripcion,
      type: "website",
    },
  };
}

export default async function SitioDominioPage({ params }: Props) {
  const { host } = await params;
  const dominio = decodeURIComponent(host);
  const datos = await cargarSitio({ dominio });
  if (!datos) notFound();

  return <SitioApr apr={datos.apr} avisos={datos.avisos} dominio={dominio} imagenes={datos.imagenes} secciones={datos.secciones} color={datos.color} />;
}
