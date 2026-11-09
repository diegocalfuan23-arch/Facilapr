import type { Metadata } from "next";
import { requireFinanzas } from "@/lib/apr-session";
import { PagosTabla } from "@/components/panel/pagos-tabla";
import { MercadoPagoCard } from "@/components/panel/mercadopago-card";
import { ConsultasProvider } from "@/components/panel/consultas-provider";
import { estadoConexion, modoMp, mpConfigurado } from "@/lib/mercadopago";
import { envioAutomaticoActivo } from "@/lib/whatsapp-api";
import { datosPagos } from "@/lib/pagos-datos";

export const metadata: Metadata = {
  title: "Pagos",
};

export default async function PagosPage({ searchParams }: { searchParams: Promise<{ mp?: string; detalle?: string }> }) {
  const { apr } = await requireFinanzas();
  const { mp, detalle } = await searchParams;
  const conexionMp = apr.mercadoPagoHabilitado ? await estadoConexion(apr.id) : null;
  const datos = await datosPagos(apr);

  return (
    <ConsultasProvider>
      <PagosTabla
        datos={datos}
        costoReconexion={apr.costoReconexion || null}
        comite={{
          nombre: apr.nombre,
          slug: apr.slug,
          infoPago: apr.infoPago,
          comprobanteAutomatico: envioAutomaticoActivo() && apr.whatsappComprobanteAuto,
        }}
        mpConectado={Boolean(conexionMp)}
        mpHabilitado={apr.mercadoPagoHabilitado}
        mpModo={modoMp()}
        estadoMp={apr.mercadoPagoHabilitado ? <MercadoPagoCard configurado={mpConfigurado()} aviso={mp} detalle={detalle} /> : null}
      />
    </ConsultasProvider>
  );
}
