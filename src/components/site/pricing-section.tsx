"use client";

import { useState } from "react";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MESES_GRATIS, PLANES_COMERCIALES as planes, UNIDAD, formatoPrecio as formato, precioPlan } from "@/lib/planes-comerciales";

const TITULO = "font-semibold tracking-[-0.035em] [text-wrap:balance]";
const GRIS = "text-[#5B5970]";
const SOMBRA = "shadow-[0_1px_2px_rgba(21,19,43,0.04),0_16px_40px_rgba(58,12,227,0.08)]";

export function PricingSection() {
  const [anual, setAnual] = useState(false);

  return (
    <section id="planes" className="scroll-mt-20 px-4 pb-16 sm:px-8 md:pb-24">
      <div className="mx-auto max-w-[1180px]">
        <h2 className={`${TITULO} text-4xl leading-[1.08] md:text-[52px]`}>Un precio que crece con tu comité</h2>
        <p className={`mt-3 max-w-[640px] text-lg ${GRIS}`}>Según la cantidad de socios activos que administra tu APR o SSR. Pagando por mes no hay permanencia mínima.</p>

        <div role="group" aria-label="Período de pago" className="mt-8 inline-flex items-center rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(21,19,43,0.06)]">
          {[
            { valor: false, texto: "Mensual" },
            { valor: true, texto: "Anual" },
          ].map((o) => (
            <button
              key={o.texto}
              type="button"
              aria-pressed={anual === o.valor}
              onClick={() => setAnual(o.valor)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full px-5 text-[0.9rem] font-semibold transition-colors",
                anual === o.valor ? "bg-[#3A0CE3] text-white" : "text-[#5B5970] hover:text-[#15132B]"
              )}
            >
              {o.texto}
              {o.valor && (
                <span className={cn("rounded-full px-2 py-0.5 text-[0.68rem] font-semibold", anual ? "bg-white/20 text-white" : "bg-[#DFF4EB] text-[#075A3C]")}>
                  {MESES_GRATIS === 1 ? "1 mes gratis" : `${MESES_GRATIS} meses gratis`}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-3">
          {planes.map((plan) => {
            const aMedida = plan.mensual === null;
            const precio = precioPlan(plan.mensual, anual, plan.desde);
            const precioAnual = precioPlan(plan.mensual, true, plan.desde);
            const d = plan.destacado;

            return (
              <article
                key={plan.nombre}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-[28px] p-7 transition-transform duration-200 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                  d ? "bg-[#0B0A1F] text-white shadow-[0_24px_60px_rgba(58,12,227,0.35)]" : `bg-white ${SOMBRA}`
                )}
              >
                {d && <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_80%_0%,rgba(70,90,255,0.55),transparent_70%)]" />}
                <div className="relative flex flex-1 flex-col">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-xl font-semibold tracking-tight">{plan.nombre}</h3>
                    {d && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Más elegido</span>}
                  </div>
                  <p className={`text-[15px] ${d ? "text-white/80" : GRIS}`}>{plan.descripcion}</p>

                  <p className="mt-6 text-[44px] leading-none font-semibold tracking-[-0.04em]">
                    {precio === null ? (
                      "A medida"
                    ) : (
                      <>
                        {aMedida && <span className={`mr-2 text-base font-medium tracking-normal ${d ? "text-white/80" : GRIS}`}>Desde</span>}
                        {formato.format(precio)} {UNIDAD}
                        <span className={`ml-2 text-base font-normal tracking-normal ${d ? "text-white/80" : GRIS}`}>{anual ? "/año" : "/mes"}</span>
                      </>
                    )}
                  </p>
                  {precio !== null && (
                    <p className={`mt-2 text-sm ${d ? "text-white/80" : GRIS}`}>
                      + IVA{aMedida && " · según tus socios y sedes"}
                      {anual && precioAnual !== null && (
                        <>
                          {" · "}
                          <span className={`font-medium ${d ? "text-[#8DF0C4]" : "text-[#075A3C]"}`}>
                            equivale a {formato.format(precioAnual / 12)} {UNIDAD}/mes
                          </span>
                        </>
                      )}
                    </p>
                  )}

                  <a
                    href="#contacto"
                    className={cn(
                      "mt-6 inline-flex min-h-12 items-center justify-center rounded-full text-[15px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#9D85FF] focus-visible:ring-offset-2 focus-visible:outline-none",
                      d ? "bg-white text-[#15132B] hover:bg-[#ECE8FD]" : "bg-[#F1EEFD] text-[#2A07A8] hover:bg-[#E4DFFC]"
                    )}
                  >
                    {plan.cta}
                  </a>

                  <div className={`mt-6 border-t pt-5 ${d ? "border-white/15" : "border-[#ECE9F5]"}`}>
                    {plan.incluye && <p className="mb-3 text-sm font-semibold">{plan.incluye}</p>}
                    <ul className="flex flex-col gap-3">
                      {plan.lista.map((item) => {
                        const texto = typeof item === "string" ? item : item.texto;
                        const pronto = typeof item !== "string" && item.pronto;
                        return (
                          <li key={texto} className={`flex gap-2 text-[15px] leading-snug ${d ? "text-white/90" : "text-[#3B394F]"}`}>
                            {pronto ? (
                              <Clock className={`mt-0.5 size-[18px] shrink-0 ${d ? "text-[#FFC38A]" : "text-[#B85A00]"}`} aria-hidden />
                            ) : (
                              <Check className={`mt-0.5 size-[18px] shrink-0 ${d ? "text-[#8DF0C4]" : "text-[#3A0CE3]"}`} aria-hidden />
                            )}
                            <span>
                              {texto}
                              {pronto && <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${d ? "bg-white/15" : "bg-[#FFEEDC] text-[#8F4400]"}`}>Próximamente</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <p className={`mt-4 text-sm ${GRIS}`}>{anual ? "El plan anual se paga una sola vez por el año completo." : "Los precios no incluyen IVA."}</p>
      </div>
    </section>
  );
}
