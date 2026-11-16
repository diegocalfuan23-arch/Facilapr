import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { cuentasDelPanel, listarTrabajadores, type ExtrasPersona } from "@/lib/personal";
import { listarPrestamos } from "@/lib/prestamos";
import { saldoVacaciones, vacacionesTomadas, vacacionesTomadasDetalle } from "@/lib/rrhh";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { PersonalVista } from "@/components/panel/personal-vista";

export const metadata: Metadata = {
  title: "Personal",
};

export default async function PersonalPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const [personas, cuentas, tomadas, detalle, prestamos] = await Promise.all([
    listarTrabajadores(apr.id),
    cuentasDelPanel(apr.id),
    vacacionesTomadas(apr.id),
    vacacionesTomadasDetalle(apr.id),
    listarPrestamos(apr.id),
  ]);

  const hoy = hoyEnChile();
  const extras: Record<string, ExtrasPersona> = {};
  for (const p of personas) {
    const s = saldoVacaciones(p.fechaIngreso, tomadas[p.id] ?? 0, hoy, detalle[p.id] ?? []);
    const anticipo = prestamos.filter((x) => x.trabajadorId === p.id && x.estado === "ACTIVO" && x.saldo > 0).reduce((t, x) => t + x.saldo, 0);
    extras[p.id] = { vacaciones: s?.saldo ?? null, anticipo };
  }

  return <PersonalVista personas={personas} cuentas={cuentas} puedeTesorero={puede(apr.plan as Plan, "finanzas")} extras={extras} hoy={hoy} />;
}
