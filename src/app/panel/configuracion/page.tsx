import type { Metadata } from "next";
import { requireAdmin } from "@/lib/apr-session";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/auth-schema";
import { usoIaChat } from "@/lib/ia-chat-cuota";
import { LIMITE_SOCIOS, LIMITE_TECNICOS, NOMBRE_PLAN, puede, type Plan } from "@/lib/planes";
import { resumenDatos } from "@/app/panel/configuracion/datos-actions";
import { ConfiguracionForm } from "@/components/panel/configuracion-form";

export const metadata: Metadata = {
  title: "Configuración",
};

export default async function ConfiguracionPage() {
  const { apr } = await requireAdmin();
  const resumen = await resumenDatos();
  const plan = apr.plan as Plan;

  const [{ n: nSocios }] = await db.select({ n: count() }).from(socios).where(eq(socios.aprId, apr.id));
  const [{ n: nTecnicos }] = await db
    .select({ n: count() })
    .from(userTable)
    .where(and(eq(userTable.aprId, apr.id), eq(userTable.rol, "OPERADOR")));
  const finito = (n: number) => (Number.isFinite(n) ? n : null);

  return (
    <ConfiguracionForm
      resumenDatos={resumen}
      uso={{
        nombrePlan: NOMBRE_PLAN[plan],
        desde: apr.createdAt.toISOString(),
        socios: { usados: nSocios, limite: finito(LIMITE_SOCIOS[plan]) },
        tecnicos: { usados: nTecnicos, limite: finito(LIMITE_TECNICOS[plan]) },
        usoIa: puede(plan, "iaChat") ? await usoIaChat(apr.id, plan) : null,
      }}
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
        tarifaCargoFijo: apr.tarifaCargoFijo,
        tarifaMetroCubico: apr.tarifaMetroCubico,
        tarifaCargoFijoComercial: apr.tarifaCargoFijoComercial,
        tarifaMetroCubicoComercial: apr.tarifaMetroCubicoComercial,
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
