import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarPagosPersonal, listarTrabajadores } from "@/lib/personal";
import { mesValido, nombreMes } from "@/lib/finanzas";
import { PersonalVista } from "@/components/panel/personal-vista";

export const metadata: Metadata = {
  title: "Personal",
};

export default async function PersonalPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const periodo = mesValido(undefined);
  const [personas, pagos] = await Promise.all([listarTrabajadores(apr.id, periodo), listarPagosPersonal(apr.id)]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Personal</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Quienes trabajan para el comité y sus pagos. Cada pago queda en la Caja.</p>
      </div>

      <PersonalVista personas={personas} pagos={pagos} periodo={periodo} mesTexto={nombreMes(periodo).split(" ")[0].toLowerCase()} />
    </div>
  );
}
