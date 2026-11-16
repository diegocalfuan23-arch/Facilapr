import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarTrabajadores } from "@/lib/personal";
import { listarAusencias, saldoVacaciones, vacacionesTomadas, vacacionesTomadasDetalle } from "@/lib/rrhh";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { AusenciasVista } from "@/components/panel/ausencias-vista";

export const metadata: Metadata = {
  title: "Vacaciones",
};

export default async function VacacionesPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const [personas, todas, tomadas, detalle] = await Promise.all([
    listarTrabajadores(apr.id),
    listarAusencias(apr.id, ["VACACIONES", "PERMISO", "LICENCIA"]),
    vacacionesTomadas(apr.id),
    vacacionesTomadasDetalle(apr.id),
  ]);
  // El tablero muestra vacaciones y permisos; las licencias solo sirven para avisar cuando una solicitud se cruza con alguien que no estará.
  const ausencias = todas.filter((a) => a.tipo !== "LICENCIA");
  const ajenas = todas.filter((a) => a.tipo === "LICENCIA");
  const activas = personas.filter((p) => p.activo);
  const hoy = hoyEnChile();
  const saldos = activas.map((p) => {
    const s = saldoVacaciones(p.fechaIngreso, tomadas[p.id] ?? 0, hoy, detalle[p.id] ?? []);
    return {
      id: p.id,
      nombre: p.nombre,
      ganados: s?.ganados ?? null,
      tomados: tomadas[p.id] ?? 0,
      saldo: s?.saldo ?? null,
      desde: s?.primerAniversario ?? null,
      delAnio: s?.delAnio ?? null,
      acumulados: s?.acumulados ?? null,
      usadosPeriodo: s?.usadosPeriodo ?? null,
    };
  });

  return <AusenciasVista tipo="VACACIONES" ausencias={ausencias} ajenas={ajenas} personas={activas.map((p) => ({ id: p.id, nombre: p.nombre }))} saldos={saldos} />;
}
