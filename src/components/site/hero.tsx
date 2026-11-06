import { ArrowRight } from "lucide-react";
import { BoletaDemo } from "@/components/site/boleta-demo";
import { Paisaje } from "@/components/site/ilustraciones";
import { PLANES_COMERCIALES, UNIDAD, formatoPrecio } from "@/lib/planes-comerciales";

const TITULO = "font-semibold tracking-[-0.035em] [text-wrap:balance]";

export function Hero() {
  const menor = PLANES_COMERCIALES[0].mensual;
  return (
    <div id="inicio" className="relative overflow-hidden bg-[#0B0A1F] text-white">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_78%_35%,rgba(70,90,255,0.55),transparent_70%),radial-gradient(ellipse_50%_50%_at_10%_90%,rgba(58,12,227,0.35),transparent_70%)]"
      />
      <div className="relative px-4 pt-28 sm:px-8 md:pt-36">
        <div className="mx-auto grid max-w-[1180px] items-center gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <h1 className={`${TITULO} text-[46px] leading-[1.02] md:text-[76px]`}>Cobra el agua de tu comité sin planillas</h1>
            <p className="mt-5 max-w-[540px] text-lg leading-relaxed text-white/80 md:text-xl">
              Software para APR y SSR: socios, lecturas, boletas, pagos y caja de tu comité en un solo lugar. Cada socio ve lo que debe desde su celular.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <a
                href="#contacto"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-[#15132B] transition-all hover:-translate-y-px hover:bg-[#ECE8FD] focus-visible:ring-2 focus-visible:ring-[#9D85FF] focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Solicitar una demo
                <ArrowRight className="size-4" aria-hidden />
              </a>
              {menor !== null && (
                <p className="text-[15px] text-white/75">
                  Desde {formatoPrecio.format(menor)} {UNIDAD} al mes + IVA
                </p>
              )}
            </div>
          </div>
          <BoletaDemo />
        </div>
      </div>
      <Paisaje />
    </div>
  );
}
