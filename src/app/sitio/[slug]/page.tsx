import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cargarSitio } from "@/lib/sitio";
import { SitioApr } from "@/components/sitio/sitio-apr";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const datos = await cargarSitio({ slug });
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

export default async function SitioPage({ params }: Props) {
  const { slug } = await params;
  const datos = await cargarSitio({ slug });
  if (!datos) notFound();

  return <SitioApr apr={datos.apr} avisos={datos.avisos} slug={slug} imagenes={datos.imagenes} secciones={datos.secciones} color={datos.color} />;
}
