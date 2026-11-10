import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { diaValido, mesValido } from "@/lib/finanzas";
import { datosCaja } from "@/lib/caja-datos";
import { CajaVista } from "@/components/panel/caja-vista";
import { ConsultasProvider } from "@/components/panel/consultas-provider";

export const metadata: Metadata = {
  title: "Caja",
};

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
  const datos = await datosCaja(apr.id, esDia, dia, mes);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Caja</h1>
        <p className="mt-0.5 text-[15px] text-[#5B5970]">Lo que entra, lo que sale y cuánta plata hay en tu APR.</p>
      </div>

      <ConsultasProvider>
        {/* La clave hace que, si se llega aquí con otro día o mes desde otra pantalla, la vista parta de ese período. */}
        <CajaVista key={`${esDia ? "dia" : "mes"}-${desde}`} modo={esDia ? "dia" : "mes"} desde={desde} datos={datos} />
      </ConsultasProvider>
    </div>
  );
}
