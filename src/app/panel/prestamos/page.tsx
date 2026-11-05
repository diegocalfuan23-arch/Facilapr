import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarPrestamos } from "@/lib/prestamos";
import { listarTrabajadores } from "@/lib/personal";
import { PrestamosVista } from "@/components/panel/prestamos-vista";

export const metadata: Metadata = {
  title: "Préstamos",
};

export default async function PrestamosPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const [prestamos, personas] = await Promise.all([listarPrestamos(apr.id), listarTrabajadores(apr.id)]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Anticipos y préstamos</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Lo que el comité adelanta o presta al personal. Las cuotas se descuentan solas al armar cada mes en Remuneraciones.</p>
      </div>

      <PrestamosVista prestamos={prestamos} personas={personas.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre }))} />
    </div>
  );
}
