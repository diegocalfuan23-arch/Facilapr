import { Smartphone, Building2, Gauge, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const caracteristicas = [
  {
    icon: Smartphone,
    titulo: "Panel para cada socio",
    detalle:
      "Cada socio entra con su RUT y clave a ver su propia deuda, boletas y consumo. Sin llamar, sin esperar respuesta.",
    tono: "bg-muted text-foreground",
  },
  {
    icon: Building2,
    titulo: "Menos filas en oficina",
    detalle:
      'Las preguntas de "cuánto debo" que hoy ocupan a tu personal, se resuelven solas antes de que el socio llegue a la puerta.',
    tono: "bg-muted text-foreground",
  },
  {
    icon: Gauge,
    titulo: "Lectura de medidor sin planilla",
    detalle:
      "Registra la lectura anterior y actual de cada socio; Facilapr calcula el consumo y arma la boleta con esos mismos datos.",
    tono: "bg-muted text-foreground",
  },
  {
    icon: Globe,
    titulo: "Sitio web y avisos de corte",
    detalle:
      "Tu APR tiene su propio sitio público (subdominio, o dominio propio en el plan grande) donde publicas avisos de corte, tarifas y datos de contacto.",
    tono: "bg-muted text-foreground",
  },
];

export function FeaturesSection() {
  return (
    <section id="caracteristicas" className="py-24">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-12 max-w-[640px]">
          <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.4rem)] font-semibold text-balance">
            Pensado para la realidad de un comité rural
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {caracteristicas.map(({ icon: Icon, titulo, detalle, tono }) => (
            <div
              key={titulo}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div
                className={cn(
                  "mb-4 flex size-10 items-center justify-center rounded-[10px]",
                  tono
                )}
              >
                <Icon className="size-5" />
              </div>
              <h3 className="mb-2 text-[1.05rem] font-semibold">{titulo}</h3>
              <p className="text-[0.91rem] leading-relaxed text-muted-foreground">
                {detalle}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
