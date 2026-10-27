import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CtaSection() {
  return (
    <section id="cta" className="py-24 text-center">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="relative overflow-hidden rounded-[22px] bg-primary px-10 py-16 text-primary-foreground">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_-20%,rgba(255,255,255,0.14),transparent_55%)]" />

          <span className="relative font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary-foreground/80 uppercase">
            Para directivas de APR y SSR
          </span>
          <h2 className="relative mt-3 text-[clamp(1.8rem,3.4vw,2.5rem)] font-semibold text-balance text-primary-foreground">
            Prueba cómo tu comité respondería solo, hoy mismo.
          </h2>
          <p className="relative mx-auto mt-4 mb-7.5 max-w-[46ch] text-[1.05rem] text-primary-foreground/90">
            Sin instalar software, sin migrar tus planillas de golpe. Partimos
            con las consultas de deuda y crecemos desde ahí.
          </p>
          <a
            href="#contacto"
            className={cn(
              buttonVariants({ size: "lg" }),
              "relative h-11 rounded-full bg-background px-6 text-foreground hover:bg-background/90"
            )}
          >
            Conversar con el equipo de Facilapr
          </a>
        </div>
      </div>
    </section>
  );
}
