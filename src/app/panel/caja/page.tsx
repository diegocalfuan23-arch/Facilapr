import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
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
  listarCategoriasMovimiento,
  saldoBancoDe,
  saldoInicialDe,
  tendenciaDisponible,
} from "@/lib/finanzas";
import { CajaVista } from "@/components/panel/caja-vista";

export const metadata: Metadata = {
  title: "Caja",
};

/** El disponible día a día: los últimos 7 días en la vista del día, o el mes entero (hasta hoy) en la del mes. */
async function tendenciaDelPeriodo(aprId: string, esDia: boolean, dia: string, mes: string) {
  if (esDia) return tendenciaDisponible(aprId, dia, 7);
  const ultimo = diaVecino(`${mesVecino(mes, 1)}-01`, -1);
  const hoy = hoyEnChile();
  const hasta = ultimo < hoy ? ultimo : hoy;
  if (hasta < `${mes}-01`) return null;
  return tendenciaDisponible(aprId, hasta, Number(hasta.slice(8)));
}

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; dia?: string; mes?: string }>;
}) {
  const { apr } = await requireFinanzas();

  // Un plan que no incluye este módulo no lo tiene: no se muestra ni por la dirección directa.
  if (!puede(apr.plan as Plan, "finanzas")) redirect("/panel");

  const params = await searchParams;
  const esDia = params.vista !== "mes";
  const dia = diaValido(params.dia);
  const mes = mesValido(params.mes ?? (esDia ? dia.slice(0, 7) : undefined));

  const desde = esDia ? dia : `${mes}-01`;
  const hasta = esDia ? diaVecino(dia, 1) : `${mesVecino(mes, 1)}-01`;

  const lineas = await (esDia ? libroDelDia(apr.id, dia) : libroDelMes(apr.id, mes));
  const [resumen, saldoInicialBase, categoriasPropias, saldoBanco, tendencia] = await Promise.all([
    resumenPeriodo(apr.id, desde, hasta, lineas),
    saldoInicialDe(apr.id),
    listarCategoriasMovimiento(apr.id),
    saldoBancoDe(apr.id),
    tendenciaDelPeriodo(apr.id, esDia, dia, mes).catch(() => null),
  ]);
  const saldoInicial = saldoInicialBase ? { ...saldoInicialBase, banco: Math.min(saldoBanco, saldoInicialBase.monto) } : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Caja</h1>
        <p className="mt-0.5 text-[15px] text-[#5B5970]">Lo que entra, lo que sale y cuánta plata hay en tu APR.</p>
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
        hrefInforme={esDia ? null : `/informes/caja/${mes}`}
        resumen={resumen}
        lineas={lineas}
        porCategoria={resumir(lineas, categoriasPropias).porCategoria}
        categoriasPropias={categoriasPropias}
        saldoInicial={saldoInicial}
        tendencia={tendencia}
      />
    </div>
  );
}
