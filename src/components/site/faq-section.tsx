import { ChevronDown } from "lucide-react";
import { Medidor } from "@/components/site/ilustraciones";
import { PREGUNTAS } from "@/lib/faq";

const TITULO = "font-semibold tracking-[-0.035em] [text-wrap:balance]";
const GRIS = "text-[#5B5970]";
const SOMBRA = "shadow-[0_1px_2px_rgba(21,19,43,0.04),0_16px_40px_rgba(58,12,227,0.08)]";

export function FaqSection() {
  return (
    <section id="preguntas" className="scroll-mt-20 px-4 pb-16 sm:px-8 md:pb-24">
      <div className="mx-auto grid max-w-[1180px] gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <h2 className={`${TITULO} text-4xl leading-[1.08] md:text-[52px]`}>Lo que suele preguntar una directiva antes de partir</h2>
          <Medidor />
        </div>
        <div className="flex flex-col gap-2">
          {PREGUNTAS.map(({ pregunta, respuesta }, i) => (
            <details key={pregunta} open={i === 0} className={`group rounded-2xl bg-white px-5 ${SOMBRA}`}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-2 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                {pregunta}
                <ChevronDown className="size-5 shrink-0 text-[#3A0CE3] transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className={`pb-4 text-[15px] leading-relaxed ${GRIS}`}>{respuesta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
