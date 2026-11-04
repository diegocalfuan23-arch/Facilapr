import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/apr-session";
import { NOMBRE_PLAN, planMinimoPara, puede, type Plan } from "@/lib/planes";
import { diaValido, libroDelDia, resumenDelDia, saldoInicialDe } from "@/lib/finanzas";
import { CajaVista } from "@/components/panel/caja-vista";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Caja",
};

export default async function CajaPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { apr } = await requireAdmin();

  if (!puede(apr.plan as Plan, "finanzas")) {
    return (
      <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center">
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Caja</h1>
        <p className="text-[0.9rem] text-muted-foreground">
          Lleva la caja de tu comité día por día: con cuánta plata partes, lo que entra y sale, y el cierre.
          Disponible en el plan {NOMBRE_PLAN[planMinimoPara("finanzas")]}.
        </p>
        <Link href="/panel/plan" className={cn(buttonVariants())}>
          Ver planes
        </Link>
      </div>
    );
  }

  const dia = diaValido((await searchParams).dia);
  const lineas = await libroDelDia(apr.id, dia);
  const [resumen, saldoInicial] = await Promise.all([resumenDelDia(apr.id, dia, lineas), saldoInicialDe(apr.id)]);

  return (
    <>
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Caja</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
          Lo que entró y salió en efectivo y otros medios, día por día.
        </p>
      </div>

      <CajaVista resumen={resumen} lineas={lineas} saldoInicial={saldoInicial} />
    </>
  );
}
