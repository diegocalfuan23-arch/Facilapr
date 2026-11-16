import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
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
    <PrestamosVista
      prestamos={prestamos}
      personas={personas.map((p) => ({ id: p.id, nombre: p.nombre, cargo: p.cargo, sueldo: p.sueldo, activo: p.activo }))}
      hoy={hoyEnChile()}
    />
  );
}
