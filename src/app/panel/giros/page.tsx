import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { bolsillosAl, diaVecino, hoyEnChile, saldoInicialDe, traspasosEntre } from "@/lib/finanzas";
import { GirosVista } from "@/components/panel/giros-vista";

export const metadata: Metadata = {
  title: "Giros",
};

export default async function GirosPage() {
  const { apr } = await requireFinanzas();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "finanzas")) redirect("/panel");

  const hoy = hoyEnChile();
  const [bolsillos, saldoInicial, traspasos] = await Promise.all([
    bolsillosAl(apr.id, diaVecino(hoy, 1)).catch(() => null),
    saldoInicialDe(apr.id),
    traspasosEntre(apr.id, "2000-01-01", "2100-01-01"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Giros</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Cuando sacas plata del banco o depositas efectivo en la cuenta: cuánto hay en cada lugar y el historial.</p>
      </div>

      <GirosVista bolsillos={bolsillos} haySaldoInicial={saldoInicial !== null} traspasos={traspasos.slice(0, 300)} />
    </div>
  );
}
