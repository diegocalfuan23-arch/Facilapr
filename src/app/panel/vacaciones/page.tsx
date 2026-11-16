import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarTrabajadores } from "@/lib/personal";
import { listarAusencias, saldoVacaciones, vacacionesTomadas } from "@/lib/rrhh";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { AusenciasVista } from "@/components/panel/ausencias-vista";

export const metadata: Metadata = {
  title: "Vacaciones",
};

export default async function VacacionesPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const [personas, ausencias, tomadas] = await Promise.all([
    listarTrabajadores(apr.id),
    listarAusencias(apr.id, ["VACACIONES", "PERMISO"]),
    vacacionesTomadas(apr.id),
  ]);
  const activas = personas.filter((p) => p.activo);
  const hoy = hoyEnChile();
  const saldos = activas.map((p) => {
    const s = saldoVacaciones(p.fechaIngreso, tomadas[p.id] ?? 0, hoy);
    return { id: p.id, nombre: p.nombre, ganados: s?.ganados ?? null, tomados: tomadas[p.id] ?? 0, saldo: s?.saldo ?? null };
  });

  return (
    <AusenciasVista tipo="VACACIONES" ausencias={ausencias} personas={activas.map((p) => ({ id: p.id, nombre: p.nombre }))} saldos={saldos} />
  );
}
