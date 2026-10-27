import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const problemas = [
  {
    titulo: "Filas para una pregunta simple",
    detalle:
      'La mayoría de las visitas a la oficina son solo para preguntar "cuánto debo" — tiempo del socio y del equipo que se va en algo que no necesita una persona.',
    destacada: false,
  },
  {
    titulo: "Planillas que solo entiende una persona",
    detalle:
      "Boletas y deudas viven en un Excel que arma el tesorero. Si esa persona no está, nadie más puede responder una consulta.",
    destacada: true,
  },
  {
    titulo: "Socios que se enteran tarde",
    detalle:
      "Sin un canal directo, muchos socios solo descubren que deben cuando ya está por cortarse el suministro.",
    destacada: false,
  },
];

export function ProblemSection() {
  return (
    <section id="problema" className="py-24">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-11 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[640px]">
            <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.4rem)] font-semibold text-balance">
              Lo mismo de siempre, en toda oficina de APR
            </h2>
            <p className="mt-3.5 text-[1.05rem] leading-relaxed text-muted-foreground">
              Consultas repetidas, planillas que solo entiende una persona,
              socios que no saben cuánto deben hasta que aparecen en la
              oficina.
            </p>
          </div>
          <a
            href="#como-funciona"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "shrink-0 rounded-full"
            )}
          >
            Cómo lo resolvemos
            <ArrowUpRight />
          </a>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {problemas.map(({ titulo, detalle, destacada }) => (
            <div
              key={titulo}
              className={cn(
                "rounded-2xl border p-6",
                destacada
                  ? "border-transparent bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg -translate-y-2"
                  : "border-border bg-card"
              )}
            >
              <span
                className={cn(
                  "mb-5 flex size-8.5 items-center justify-center rounded-full",
                  destacada
                    ? "bg-white/18 text-white"
                    : "bg-primary/10 text-primary"
                )}
              >
                <ArrowUpRight className="size-4.5" />
              </span>
              <h3 className="mb-2 text-[1.05rem] font-semibold">{titulo}</h3>
              <p
                className={cn(
                  "text-[0.91rem] leading-relaxed",
                  destacada ? "text-primary-foreground/90" : "text-muted-foreground"
                )}
              >
                {detalle}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
