import type { Metadata } from "next";
import Link from "next/link";
import { requireFinanzas } from "@/lib/apr-session";
import { recibosDelPeriodo } from "@/lib/recibo";
import { formatearPeriodo } from "@/lib/boletas";
import { Recibo } from "@/components/recibos/recibo";
import { ImprimirBoton } from "@/components/recibos/imprimir-boton";

type Props = { params: Promise<{ periodo: string }> };

export const metadata: Metadata = {
  title: "Recibos del período",
  robots: { index: false, follow: false },
};

export default async function RecibosPeriodoPage({ params }: Props) {
  const { periodo } = await params;
  const { apr } = await requireFinanzas();

  const recibos = await recibosDelPeriodo(apr.id, periodo);

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-8 print:max-w-none print:p-0">
      {/* Tamaño y márgenes de la hoja: con varios recibos por página el talonario
          sale como el de papel, y se corta por las líneas. */}
      <style>{`@page { size: A4; margin: 10mm; }`}</style>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link
            href="/panel/boletas"
            className="text-[0.9rem] text-muted-foreground hover:underline"
          >
            ← Volver a boletas
          </Link>
          <h1 className="mt-1 text-[1.2rem] font-semibold">
            Recibos de {formatearPeriodo(periodo)}
          </h1>
          <p className="text-[0.88rem] text-muted-foreground">
            {recibos.length} {recibos.length === 1 ? "recibo" : "recibos"}, varios por
            hoja. Las boletas anuladas no se incluyen.
          </p>
        </div>
        {recibos.length > 0 && <ImprimirBoton etiqueta="Imprimir recibos" />}
      </div>

      {recibos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-[0.9rem] text-muted-foreground print:hidden">
          No hay boletas de este período.
        </p>
      ) : (
        <div className="flex flex-col gap-4 print:gap-[4mm]">
          {recibos.map((r) => (
            <Recibo key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
