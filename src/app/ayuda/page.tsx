import type { Metadata } from "next";
import { AyudaLayout } from "@/components/ayuda/ayuda-layout";
import { AyudaBuscador } from "@/components/ayuda/ayuda-buscador";

export const metadata: Metadata = {
  alternates: { canonical: "/ayuda" },
  title: "Centro de ayuda",
  description:
    "Guías paso a paso para administrar tu comité de agua potable rural con Facilapr: socios, lecturas, boletas y pagos.",
};

export default function AyudaPage() {
  return (
    <AyudaLayout>
      <main className="mx-auto max-w-[960px] px-7 py-14">
        <div className="text-center">
          <span className="font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
            Centro de ayuda
          </span>
          <h1 className="mt-3 text-[clamp(1.8rem,3vw,2.4rem)] font-semibold tracking-tight">
            ¿En qué te podemos ayudar?
          </h1>
          <p className="mx-auto mt-3 mb-9 max-w-lg text-[0.97rem] text-muted-foreground">
            Guías paso a paso, hechas para quien administra un comité y no
            tiene tiempo que perder.
          </p>
        </div>
        <AyudaBuscador />
      </main>
    </AyudaLayout>
  );
}
