import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/apr-session";
import { NOMBRE_PLAN, planMinimoPara, puede, type Plan } from "@/lib/planes";
import {
  diaValido,
  hoyEnChile,
  diaVecino,
  libroDelDia,
  libroDelMes,
  mesValido,
  mesVecino,
  nombreMes,
  resumenPeriodo,
  resumir,
  saldoInicialDe,
} from "@/lib/finanzas";
import { CajaVista } from "@/components/panel/caja-vista";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Caja",
};

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; dia?: string; mes?: string }>;
}) {
  const { apr } = await requireAdmin();

  if (!puede(apr.plan as Plan, "finanzas")) {
    return (
      <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Caja</h1>
        <p className="text-[0.9rem] text-muted-foreground">
          Lleva la plata de tu comité en un solo lugar: con cuánta partes, lo que entra y sale, por día o por mes, y el
          cierre de caja. Disponible en el plan {NOMBRE_PLAN[planMinimoPara("finanzas")]}.
        </p>
        <Link href="/panel/plan" className={cn(buttonVariants())}>
          Ver planes
        </Link>
      </div>
    );
  }

  const params = await searchParams;
  const esDia = params.vista !== "mes";
  const dia = diaValido(params.dia);
  const mes = mesValido(params.mes ?? (esDia ? dia.slice(0, 7) : undefined));

  const desde = esDia ? dia : `${mes}-01`;
  const hasta = esDia ? diaVecino(dia, 1) : `${mesVecino(mes, 1)}-01`;

  const lineas = await (esDia ? libroDelDia(apr.id, dia) : libroDelMes(apr.id, mes));
  const [resumen, saldoInicial] = await Promise.all([resumenPeriodo(apr.id, desde, hasta, lineas), saldoInicialDe(apr.id)]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Caja</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">La plata de tu comité: lo que entra, lo que sale y cuánta hay.</p>
      </div>

      <CajaVista
        modo={esDia ? "dia" : "mes"}
        desde={desde}
        etiqueta={esDia ? dia : nombreMes(mes)}
        hrefAnterior={esDia ? `/panel/caja?vista=dia&dia=${diaVecino(dia, -1)}` : `/panel/caja?vista=mes&mes=${mesVecino(mes, -1)}`}
        hrefSiguiente={esDia ? `/panel/caja?vista=dia&dia=${diaVecino(dia, 1)}` : `/panel/caja?vista=mes&mes=${mesVecino(mes, 1)}`}
        hrefOtraVista={
          esDia
            ? `/panel/caja?vista=mes&mes=${dia.slice(0, 7)}`
            : `/panel/caja?vista=dia&dia=${mes === hoyEnChile().slice(0, 7) ? hoyEnChile() : `${mes}-01`}`
        }
        resumen={resumen}
        lineas={lineas}
        porCategoria={resumir(lineas).porCategoria}
        saldoInicial={saldoInicial}
      />
    </div>
  );
}
