import type { Metadata } from "next";
import { requireSocio } from "@/lib/socio-session";
import { boletasDelPortal } from "@/lib/portal-socio-datos";
import {
  clp,
  ListaPagos,
  SinDatos,
  TituloPantalla,
} from "@/components/socio/boletas-ui";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Mis pagos" };

export default async function PagosSocioPage({ params }: Props) {
  const { slug } = await params;
  const { socio } = await requireSocio(slug);
  const { cuentas, lista } = await boletasDelPortal(socio);

  // Pagos y abonos: toda boleta de la que ya se pagó algo.
  const pagos = lista.filter((b) => b.estado !== "ANULADA" && b.montoPagado > 0);
  const totalPagado = pagos.reduce((acc, b) => acc + b.montoPagado, 0);

  return (
    <>
      <TituloPantalla
        titulo="Tus pagos"
        descripcion={
          pagos.length > 0
            ? `Total pagado: ${clp.format(totalPagado)}`
            : "Aquí verás los pagos y abonos que registre el comité."
        }
      />
      {pagos.length === 0 ? (
        <SinDatos>Todavía no hay pagos registrados.</SinDatos>
      ) : (
        <ListaPagos boletas={pagos} variasCuentas={cuentas.length > 1} />
      )}
    </>
  );
}
