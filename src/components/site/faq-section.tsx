import { ChevronDown } from "lucide-react";
import { PREGUNTAS } from "@/lib/faq";

export function FaqSection() {
  return (
    <section id="preguntas" className="py-24">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mx-auto mb-12 max-w-[640px] text-center">
          <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.4rem)] font-semibold text-balance">
            Lo que suele preguntar una directiva antes de partir
          </h2>
        </div>

        <div className="mx-auto flex max-w-[760px] flex-col gap-2.5">
          {PREGUNTAS.map(({ pregunta, respuesta }, i) => (
            <details
              key={pregunta}
              open={i === 0}
              className="group rounded-2xl border border-border bg-card px-5.5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[0.98rem] font-semibold [&::-webkit-details-marker]:hidden">
                <span>{pregunta}</span>
                <ChevronDown className="size-4.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 group-open:text-primary" />
              </summary>
              <p className="mt-[-4px] mb-4 max-w-[62ch] text-[0.93rem] leading-relaxed text-muted-foreground">
                {respuesta}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
