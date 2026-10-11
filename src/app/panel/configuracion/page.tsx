import type { Metadata } from "next";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { resumenDatos } from "@/app/panel/configuracion/datos-actions";
import { ConfiguracionForm } from "@/components/panel/configuracion-form";

export const metadata: Metadata = {
  title: "Configuración",
};

export default async function ConfiguracionPage() {
  const { apr } = await requireAdmin();
  const resumen = await resumenDatos();

  return (
    <ConfiguracionForm
      resumenDatos={resumen}
      datos={{
        slug: apr.slug,
        iaChatDisponible: puede(apr.plan as Plan, "iaChat"),
        iaChatModo: apr.iaChatModo,
        iaChatInstrucciones: apr.iaChatInstrucciones,
        infoPago: apr.infoPago,
        nombre: apr.nombre,
        razonSocial: apr.razonSocial,
        rut: apr.rut,
        comuna: apr.comuna,
        region: apr.region,
        direccion: apr.direccion,
        telefono: apr.telefono,
        email: apr.email,
        sitioWeb: apr.sitioWeb,
        pais: apr.pais,
        moneda: apr.moneda,
        zonaHoraria: apr.zonaHoraria,
        tarifaCargoFijo: apr.tarifaCargoFijo,
        tarifaMetroCubico: apr.tarifaMetroCubico,
        diaGeneracionBoletas: apr.diaGeneracionBoletas,
        diasVencimiento: apr.diasVencimiento,
        prefijoBoleta: apr.prefijoBoleta,
        incluyeIva: apr.incluyeIva,
        porcentajeIva: apr.porcentajeIva,
        frecuenciaLectura: apr.frecuenciaLectura,
        toleranciaConsumoAnormal: apr.toleranciaConsumoAnormal,
        alertaFugaConsumo: apr.alertaFugaConsumo,
        requiereFotoLectura: apr.requiereFotoLectura,
        diasGraciaCorte: apr.diasGraciaCorte,
        diasAvisoCorte: apr.diasAvisoCorte,
        costoReconexion: apr.costoReconexion,
      }}
    />
  );
}
