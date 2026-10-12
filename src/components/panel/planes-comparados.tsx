"use client";

import { useState } from "react";
import { Check, Clock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatoPrecio,
  MESES_GRATIS,
  PLANES_COMERCIALES,
  precioPlan,
  UNIDAD,
} from "@/lib/planes-comerciales";
import type { Plan } from "@/lib/planes";

/**
 * Los tres planes lado a lado, igual que en la landing, con el del comité
 * marcado. Cambiar de plan por ahora se pide por correo.
 */
export function PlanesComparados({ planActual }: { planActual: Plan }) {
  const [anual, setAnual] = useState(false);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1.05rem] font-semibold">Planes</h2>
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
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-[0.85rem] font-medium transition-colors",
                anual === o.valor
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.texto}
              {o.valor && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.66rem] font-semibold",
                    anual ? "bg-white/20 text-primary-foreground" : "bg-forest/15 text-forest"
                  )}
                >
                  {MESES_GRATIS === 1 ? "1 mes gratis" : `${MESES_GRATIS} meses gratis`}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-3">
        {PLANES_COMERCIALES.map((plan) => {
          const esActual = plan.clave === planActual;
          const precio = precioPlan(plan.mensual, anual, plan.desde);
          const aMedida = plan.mensual === null;

          return (
            <div
              key={plan.nombre}
              className={cn(
                "relative flex flex-col rounded-2xl border border-border bg-card p-6",
                esActual && "border-primary shadow-[0_0_0_1px_var(--primary)]"
              )}
            >
              {esActual && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[0.72rem] font-bold tracking-[0.03em] text-primary-foreground">
                  Tu plan
                </span>
              )}

              <span className="text-[1.1rem] font-semibold">{plan.nombre}</span>
              <p className="mt-1 mb-4 text-[0.85rem] text-muted-foreground">{plan.descripcion}</p>

              <div className="flex items-baseline gap-1.5 text-[1.8rem] font-semibold">
                {precio === null ? (
                  "A medida"
                ) : (
                  <>
                    {aMedida && (
                      <span className="text-[0.85rem] font-medium text-muted-foreground">Desde</span>
                    )}
                    {formatoPrecio.format(precio)} {UNIDAD}
                    <span className="text-[0.85rem] font-medium text-muted-foreground">
                      {anual ? "/año" : "/mes"}
                    </span>
                  </>
                )}
              </div>
              {precio === null ? (
                <div className="mb-4" />
              ) : (
                <p className="mb-4 text-[0.78rem] text-muted-foreground">
                  + IVA{aMedida && " · según tus socios y sedes"}
                  {anual && (
                    <>
                      {" · "}
                      <span className="font-medium text-forest">
                        equivale a {formatoPrecio.format(precio / 12)} {UNIDAD}/mes
                      </span>
                    </>
                  )}
                </p>
              )}

              {plan.incluye && (
                <p className="mb-2.5 text-[0.8rem] font-medium text-foreground">{plan.incluye}</p>
              )}
              <ul className="mb-6 flex flex-1 flex-col gap-2.5">
                {plan.lista.map((item) => {
                  const texto = typeof item === "string" ? item : item.texto;
                  const pronto = typeof item !== "string" && item.pronto;
                  return (
                    <li key={texto} className="flex items-start gap-2.5 text-[0.86rem] text-muted-foreground">
                      {pronto ? (
                        <Clock className="mt-0.5 size-3.5 shrink-0 text-tertiary" />
                      ) : (
                        <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      )}
                      <span>
                        {texto}
                        {pronto && (
                          <span className="ml-1.5 rounded-full bg-tertiary/15 px-1.5 py-0.5 text-[0.62rem] font-semibold text-tertiary-foreground">
                            Próximamente
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {esActual ? (
                <span
                  className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none w-full opacity-60")}
                >
                  Tu plan actual
                </span>
              ) : (
                <a
                  href={`mailto:hola@facilapr.cl?subject=${encodeURIComponent(`Quiero cambiarme al ${plan.nombre}`)}`}
                  className={cn(buttonVariants({ variant: plan.clave === "ESTANDAR" ? "default" : "outline" }), "w-full")}
                >
                  {plan.mensual === null ? "Conversemos" : "Cambiarme a este plan"}
                </a>
              )}
            </div>
          );
        })}
      </div>

      {anual && (
        <p className="text-center text-[0.8rem] text-muted-foreground">
          El plan anual se paga una sola vez por el año completo.
        </p>
      )}
    </section>
  );
}
