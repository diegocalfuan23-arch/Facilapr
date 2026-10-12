"use client";

import { useState } from "react";
import { Check, Clock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Los precios están en una unidad de reajuste (hoy UF). Se cambian aquí: la
 * unidad y los montos, sin tocar el resto. El plan anual cobra 11 meses y da 12
 * («1 mes gratis»).
 */
const UNIDAD = "UF";
const MESES_GRATIS = 1;

type Item = string | { texto: string; pronto?: boolean };

const planes: {
  nombre: string;
  descripcion: string;
  /** Precio mensual en `UNIDAD`; null = a medida. */
  mensual: number | null;
  /** Lo que incluye además del plan anterior. */
  incluye?: string;
  lista: Item[];
  cta: string;
  destacado: boolean;
}[] = [
  {
    nombre: "Comité Pequeño",
    descripcion: "Para APR con hasta 200 socios.",
    mensual: 0.7,
    lista: [
      "Boletas, lecturas y recibo en PDF por WhatsApp",
      "Portal para cada socio, con asistente de IA",
      "Hasta 200 socios cargados",
      "1 técnico en terreno",
      "Soporte por correo",
    ],
    cta: "Elegir plan",
    destacado: false,
  },
  {
    nombre: "Comité Estándar",
    descripcion: "Para APR con hasta 800 socios.",
    mensual: 1.5,
    incluye: "Todo lo del Pequeño, más:",
    lista: [
      "Chat en tiempo real con tus socios",
      { texto: "IA en el chat: responde a tus socios en segundos (unas 1.500 respuestas al mes)", pronto: true },
      "Hasta 800 socios cargados",
      "Hasta 3 técnicos en terreno",
      "Sitio público con avisos de corte",
      "Te cargamos tu padrón y dejamos todo configurado",
      "Soporte prioritario",
    ],
    cta: "Elegir plan",
    destacado: true,
  },
  {
    nombre: "APR Grande",
    descripcion: "Más de 800 socios o varias sedes.",
    mensual: null,
    incluye: "Todo lo del Estándar, más:",
    lista: [
      "Socios y técnicos sin tope",
      { texto: "IA del chat con más capacidad (unas 5.000 respuestas al mes) y packs adicionales", pronto: true },
      "Dominio propio y varios administradores con roles",
      { texto: "Conciliación de pagos con la cartola del banco", pronto: true },
      "Múltiples sedes o comités",
      "Acompañamiento en la puesta en marcha",
    ],
    cta: "Conversemos",
    destacado: false,
  },
];

const formato = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

export function PricingSection() {
  const [anual, setAnual] = useState(false);

  return (
    <section id="planes" className="py-23">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mx-auto mb-10 max-w-[640px] text-center">
          <span className="font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
            Planes
          </span>
          <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.4rem)] font-semibold text-balance">
            Un precio que crece con tu comité
          </h2>
          <p className="mt-3.5 text-[1.05rem] leading-relaxed text-muted-foreground">
            Según la cantidad de socios activos que administra tu APR o SSR.
            Pagando por mes no hay permanencia mínima.
          </p>
        </div>

        <div className="mb-10 flex justify-center">
          <div
            role="group"
            aria-label="Período de pago"
            className="inline-flex items-center rounded-full border border-border bg-muted/50 p-1"
          >
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
                  "flex items-center gap-2 rounded-full px-5 py-2 text-[0.9rem] font-medium transition-colors",
                  anual === o.valor
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {o.texto}
                {o.valor && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.68rem] font-semibold",
                      anual
                        ? "bg-white/20 text-primary-foreground"
                        : "bg-forest/15 text-forest"
                    )}
                  >
                    {MESES_GRATIS === 1 ? "1 mes gratis" : `${MESES_GRATIS} meses gratis`}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid items-stretch gap-5.5 sm:grid-cols-3">
          {planes.map((plan) => {
            const aMedida = plan.mensual === null;
            const precioAnual = aMedida ? 0 : plan.mensual! * (12 - MESES_GRATIS);
            const precio = aMedida ? null : anual ? precioAnual : plan.mensual!;

            return (
              <div
                key={plan.nombre}
                className={cn(
                  "relative flex flex-col rounded-2xl border border-border bg-card p-7.5",
                  plan.destacado && "border-primary shadow-[0_0_0_1px_var(--primary)]"
                )}
              >
                {plan.destacado && (
                  <span className="absolute -top-3.25 left-6.5 rounded-full bg-primary px-3 py-1.25 text-[0.72rem] font-bold tracking-[0.03em] text-primary-foreground">
                    Más elegido
                  </span>
                )}

                <span className="text-[1.15rem] font-semibold">{plan.nombre}</span>
                <p className="mt-1.5 mb-5 text-[0.88rem] text-muted-foreground">
                  {plan.descripcion}
                </p>

                <div className="flex items-baseline gap-1.5 text-[2rem] font-semibold">
                  {precio === null ? (
                    "A medida"
                  ) : (
                    <>
                      {formato.format(precio)} {UNIDAD}
                      <span className="font-sans text-[0.9rem] font-medium text-muted-foreground">
                        {anual ? "/año" : "/mes"}
                      </span>
                    </>
                  )}
                </div>
                {precio === null ? (
                  <div className="mb-5" />
                ) : (
                  <p className="mb-5 text-[0.8rem] text-muted-foreground">
                    + IVA
                    {anual && (
                      <>
                        {" · "}
                        <span className="font-medium text-forest">
                          equivale a {formato.format(precioAnual / 12)} {UNIDAD}/mes
                        </span>
                      </>
                    )}
                  </p>
                )}

                {plan.incluye && (
                  <p className="mb-3 text-[0.82rem] font-medium text-foreground">
                    {plan.incluye}
                  </p>
                )}
                <ul className="mb-6.5 flex flex-1 flex-col gap-3">
                  {plan.lista.map((item) => {
                    const texto = typeof item === "string" ? item : item.texto;
                    const pronto = typeof item !== "string" && item.pronto;
                    return (
                      <li
                        key={texto}
                        className="flex items-start gap-2.5 text-[0.9rem] text-muted-foreground"
                      >
                        {pronto ? (
                          <Clock className="mt-0.5 size-3.5 shrink-0 text-tertiary" />
                        ) : (
                          <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        )}
                        <span>
                          {texto}
                          {pronto && (
                            <span className="ml-1.5 rounded-full bg-tertiary/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-tertiary-foreground">
                              Próximamente
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <a
                  href="#contacto"
                  className={cn(
                    buttonVariants({
                      variant: plan.destacado ? "default" : "outline",
                    }),
                    "w-full"
                  )}
                >
                  {plan.cta}
                </a>
              </div>
            );
          })}
        </div>

        {anual && (
          <p className="mt-6 text-center text-[0.82rem] text-muted-foreground">
            El plan anual se paga una sola vez por el año completo.
          </p>
        )}
      </div>
    </section>
  );
}
