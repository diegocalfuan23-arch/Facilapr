import type { Metadata } from "next";
import { requireSocio } from "@/lib/socio-session";
import { basePortal } from "@/lib/portal-socio";
import { boletasDelPortal } from "@/lib/portal-socio-datos";
import {
  ListaBoletas,
  SinDatos,
  TituloPantalla,
} from "@/components/socio/boletas-ui";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Mis boletas" };

export default async function BoletasSocioPage({ params }: Props) {
  const { slug } = await params;
  const { socio } = await requireSocio(slug);
  const base = await basePortal(slug);
  const { cuentas, lista } = await boletasDelPortal(socio);

  return (
    <>
      <TituloPantalla
        titulo="Tus boletas"
        descripcion="Todas las boletas que el comité te ha emitido."
      />
      {lista.length === 0 ? (
        <SinDatos>Todavía no tienes boletas emitidas.</SinDatos>
      ) : (
        <ListaBoletas boletas={lista} base={base} variasCuentas={cuentas.length > 1} />
      )}
    </>
  );
}
