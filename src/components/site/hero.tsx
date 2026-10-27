import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PhoneMockup } from "./phone-mockup";

export function Hero() {
  return (
    <section className="pt-16 pb-10 text-center">
      <div className="mx-auto flex max-w-[720px] flex-col items-center px-7">
        <h1 className="mb-4 text-[clamp(2.6rem,5.2vw,4.1rem)] leading-[1.05] font-semibold text-balance">
          El software para tu APR que además
          <br />
          responde solo, a cada socio.
        </h1>
        <p className="mb-8 max-w-[48ch] text-[1.16rem] leading-relaxed text-muted-foreground">
          Administra los socios, boletas y pagos de tu comité de Agua Potable
          Rural desde un solo panel — y deja que cada socio entre a su propio
          panel y sepa cuánto debe, a cualquier hora.
        </p>
        <div className="mb-2 flex flex-wrap justify-center gap-4">
          <a
            href="#contacto"
            className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-full px-6")}
          >
            Solicitar una demo
          </a>
          <a
            href="#como-funciona"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 rounded-full px-6")}
          >
            Ver cómo funciona
          </a>
        </div>
      </div>

      <div className="relative mx-auto max-w-[1180px] px-7 pt-14">
        <PhoneMockup />
      </div>
    </section>
  );
}
