import type { Metadata } from "next";
import { requireAdmin } from "@/lib/apr-session";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios as sociosTabla } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/auth-schema";
import { usoIaChat } from "@/lib/ia-chat-cuota";
import { LIMITE_SOCIOS, LIMITE_TECNICOS, NOMBRE_PLAN, puede, type Plan } from "@/lib/planes";
import { resumenDatos } from "@/app/panel/configuracion/datos-actions";
import { ConfiguracionForm } from "@/components/panel/configuracion-form";

export const metadata: Metadata = {
  title: "Configuración",
};

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>;
}) {
  const { apr } = await requireAdmin();
  const { seccion } = await searchParams;
  const resumen = await resumenDatos();
  const plan = apr.plan as Plan;

  const [{ n: socios }] = await db
    .select({ n: count() })
    .from(sociosTabla)
    .where(eq(sociosTabla.aprId, apr.id));
  const [{ n: tecnicos }] = await db
    .select({ n: count() })
    .from(userTable)
    .where(and(eq(userTable.aprId, apr.id), eq(userTable.rol, "OPERADOR")));
  const finito = (n: number) => (Number.isFinite(n) ? n : null);

  return (
    <ConfiguracionForm
      seccionInicial={seccion}
      plan={{
        nombre: NOMBRE_PLAN[plan],
        desde: apr.createdAt.toISOString(),
        socios: { usados: socios, limite: finito(LIMITE_SOCIOS[plan]) },
        tecnicos: { usados: tecnicos, limite: finito(LIMITE_TECNICOS[plan]) },
        capacidades: [
          { texto: "Boletas, lecturas y recibos en PDF", incluida: true },
          { texto: "Portal para cada socio", incluida: true },
          { texto: "Chat en tiempo real con tus socios", incluida: puede(plan, "chat") },
          { texto: "IA que responde en el chat", incluida: puede(plan, "iaChat") },
          { texto: "Sitio público con avisos de corte", incluida: puede(plan, "avisos") },
          { texto: "Dominio propio", incluida: puede(plan, "dominioPropio") },
        ],
        usoIa: puede(plan, "iaChat")
          ? await usoIaChat(apr.id, plan)
          : null,
      }}
      resumenDatos={resumen}
      datos={{
        slug: apr.slug,
        iaChatDisponible: puede(apr.plan as Plan, "iaChat"),
        iaChatModo: apr.iaChatModo,
        iaChatEsperaMin: apr.iaChatEsperaMin,
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
