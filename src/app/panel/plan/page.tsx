import type { Metadata } from "next";
import { requireAdmin } from "@/lib/apr-session";
import type { Plan } from "@/lib/planes";
import { MiPlan } from "@/components/panel/mi-plan";

export const metadata: Metadata = {
  title: "Mi plan",
};

/** Los planes y cuál tiene el comité. Se llega desde el menú de la tarjeta del comité. */
export default async function MiPlanPage() {
  const { apr } = await requireAdmin();

  return (
    <>
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Mi plan</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
          Compara los planes y mira cuál tienes.
        </p>
      </div>
      <MiPlan planActual={apr.plan as Plan} />
    </>
  );
}
