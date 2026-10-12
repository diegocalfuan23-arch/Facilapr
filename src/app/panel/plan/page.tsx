import type { Metadata } from "next";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socios } from "@/lib/db/schema";
import { user as userTable } from "@/lib/db/auth-schema";
import { requireAdmin } from "@/lib/apr-session";
import { usoIaChat } from "@/lib/ia-chat-cuota";
import { LIMITE_SOCIOS, LIMITE_TECNICOS, NOMBRE_PLAN, puede, type Plan } from "@/lib/planes";
import { MiPlan } from "@/components/panel/mi-plan";

export const metadata: Metadata = {
  title: "Mi plan",
};

/** El plan del comité con Facilapr: qué incluye, cuánto lleva usado y el consumo de IA. Se llega desde el menú del comité. */
export default async function MiPlanPage() {
  const { apr } = await requireAdmin();
  const plan = apr.plan as Plan;

  const [{ n: nSocios }] = await db
    .select({ n: count() })
    .from(socios)
    .where(eq(socios.aprId, apr.id));
  const [{ n: nTecnicos }] = await db
    .select({ n: count() })
    .from(userTable)
    .where(and(eq(userTable.aprId, apr.id), eq(userTable.rol, "OPERADOR")));
  const finito = (n: number) => (Number.isFinite(n) ? n : null);

  return (
    <>
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Mi plan</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
          Lo que incluye tu plan y cuánto llevas usado.
        </p>
      </div>
      <MiPlan
        plan={{
          nombre: NOMBRE_PLAN[plan],
          desde: apr.createdAt.toISOString(),
          socios: { usados: nSocios, limite: finito(LIMITE_SOCIOS[plan]) },
          tecnicos: { usados: nTecnicos, limite: finito(LIMITE_TECNICOS[plan]) },
          capacidades: [
            { texto: "Boletas, lecturas y recibos en PDF", incluida: true },
            { texto: "Portal para cada socio", incluida: true },
            { texto: "Chat en tiempo real con tus socios", incluida: puede(plan, "chat") },
            { texto: "IA que responde en el chat", incluida: puede(plan, "iaChat") },
            { texto: "Sitio público con avisos de corte", incluida: puede(plan, "avisos") },
            { texto: "Dominio propio", incluida: puede(plan, "dominioPropio") },
          ],
          usoIa: puede(plan, "iaChat") ? await usoIaChat(apr.id, plan) : null,
        }}
      />
    </>
  );
}
