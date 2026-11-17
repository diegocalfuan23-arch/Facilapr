import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { bancoAlCierre, bolsillosAl, diaVecino, hoyEnChile, saldoInicialDe, traspasosEntre } from "@/lib/finanzas";
import { GirosVista } from "@/components/panel/giros-vista";

export const metadata: Metadata = {
  title: "Giros",
};

export default async function GirosPage() {
  const { apr } = await requireFinanzas();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "finanzas")) redirect("/panel");

  const hoy = hoyEnChile();
  const [bolsillos, saldoInicial, todos] = await Promise.all([
    bolsillosAl(apr.id, diaVecino(hoy, 1)).catch(() => null),
    saldoInicialDe(apr.id),
    traspasosEntre(apr.id, "2000-01-01", "2100-01-01"),
  ]);
  const traspasos = todos.slice(0, 300);
  // El saldo del banco al cierre de cada día en que hubo un giro o un depósito.
  const bancos = await bancoAlCierre(apr.id, traspasos.map((t) => t.fecha));

  return <GirosVista bolsillos={bolsillos} haySaldoInicial={saldoInicial !== null} traspasos={traspasos.map((t) => ({ ...t, bancoAlCierre: bancos[t.fecha] ?? null }))} hoy={hoy} />;
}
