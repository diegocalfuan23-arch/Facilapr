import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireApr } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { listarLabores } from "@/lib/labores";
import { avanzarLaboresVencidas } from "@/lib/labores-auto";
import { MisLabores } from "@/components/panel/mis-labores";

export const metadata: Metadata = {
  title: "Labores",
};

/** Las labores en rutas de socios, para quien sale a terreno (el operador, o la directiva cuando sale ella). */
export default async function MisLaboresPage() {
  const { apr } = await requireApr();
  // Las labores van con el mismo plan que el inventario.
  if (!puede(apr.plan as Plan, "inventario")) redirect("/panel");

  await avanzarLaboresVencidas(apr.id);
  const labores = (await listarLabores(apr.id)).filter((l) => l.estado !== "HECHA" && l.rutas.length > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));

  return <MisLabores labores={labores} />;
}
