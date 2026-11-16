import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarTrabajadores } from "@/lib/personal";
import { listarAusencias } from "@/lib/rrhh";
import { AusenciasVista } from "@/components/panel/ausencias-vista";

export const metadata: Metadata = {
  title: "Licencias",
};

export default async function LicenciasPage() {
  const { apr } = await requireAdmin();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "personal")) redirect("/panel");

  const [personas, todas] = await Promise.all([listarTrabajadores(apr.id), listarAusencias(apr.id, ["VACACIONES", "PERMISO", "LICENCIA"])]);
  // El tablero muestra licencias; vacaciones y permisos solo sirven para avisar cuando una solicitud se cruza con alguien que no estará.
  const licencias = todas.filter((a) => a.tipo === "LICENCIA");
  const ajenas = todas.filter((a) => a.tipo !== "LICENCIA");

  return <AusenciasVista tipo="LICENCIA" ausencias={licencias} ajenas={ajenas} personas={personas.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre }))} />;
}
