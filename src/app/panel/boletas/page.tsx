import type { Metadata } from "next";
import { requireAdmin } from "@/lib/apr-session";
import { BoletasTabla } from "@/components/panel/boletas-tabla";
import { ConsultasProvider } from "@/components/panel/consultas-provider";
import { datosBoletas } from "@/lib/boletas-datos";
import { envioAutomaticoActivo } from "@/lib/whatsapp-api";
import { plantillaBoletaApi } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Boletas",
};

export default async function BoletasPage() {
  const { apr } = await requireAdmin();
  const datos = await datosBoletas(apr);

  return (
    <ConsultasProvider>
      <BoletasTabla
        boletas={datos.boletas}
        socios={datos.socios}
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
          comprobanteAutomatico: envioAutomaticoActivo() && apr.whatsappComprobanteAuto,
        }}
        envioAutomatico={datos.envioAutomatico}
        cupoWhatsapp={datos.cupoWhatsapp}
        plantillaBoleta={plantillaBoletaApi()}
      />
    </ConsultasProvider>
  );
}
