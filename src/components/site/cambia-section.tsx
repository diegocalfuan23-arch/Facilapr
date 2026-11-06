import { Check } from "lucide-react";

const TITULO = "font-semibold tracking-[-0.035em] [text-wrap:balance]";
const GRIS = "text-[#5B5970]";
const SOMBRA = "shadow-[0_1px_2px_rgba(21,19,43,0.04),0_16px_40px_rgba(58,12,227,0.08)]";

const COMPARA: [string, string][] = [
  ["Socios que van a la oficina a preguntar cuánto deben", "Cada socio lo ve en su celular"],
  ["Deudas en un Excel que solo entiende el tesorero", "Boletas y morosidad para toda la directiva"],
  ["Lecturas en papel, traspasadas a mano", "El operador las sube en terreno"],
  ["Socios que se enteran justo antes del corte", "Revisan su cuenta y pagan en línea"],
];

/** Antes y después: lo que cambia en la oficina de un APR. */
export function CambiaSection() {
  return (
    <section id="como-funciona" className="scroll-mt-20 px-4 pt-10 pb-16 sm:px-8 md:pt-12 md:pb-24">
      <div className="mx-auto max-w-[1180px]">
        <h2 className={`${TITULO} max-w-[760px] text-4xl leading-[1.08] md:text-[52px]`}>Lo que cambia en la oficina</h2>
        <div className={`mt-10 overflow-hidden rounded-[28px] bg-white ${SOMBRA}`}>
          <div className="hidden grid-cols-2 md:grid">
            <p className={`px-8 pt-6 pb-2 text-sm font-semibold ${GRIS}`}>Hoy</p>
            <p className="bg-gradient-to-r from-[#3A0CE3] to-[#4D3BEF] px-8 pt-6 pb-2 text-sm font-semibold text-white/85">Con Facilapr</p>
          </div>
          {COMPARA.map(([a, b], i) => (
            <div key={a} className="grid md:grid-cols-2">
              <p className={`px-6 py-4 text-[17px] leading-snug md:px-8 ${GRIS} ${i > 0 ? "md:border-t md:border-[#F0EEF6]" : ""}`}>{a}</p>
              <p className={`flex gap-2 bg-gradient-to-r from-[#3A0CE3] to-[#4D3BEF] px-6 py-4 text-[17px] leading-snug font-medium text-white md:px-8 ${i > 0 ? "md:border-t md:border-white/10" : ""}`}>
                <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
                {b}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
