import { cn } from "@/lib/utils";

const pasos = [
  {
    numero: "01",
    titulo: "El socio entra a su panel",
    detalle:
      "Con su RUT y una clave propia, desde el sitio de tu APR — en cualquier momento, desde el navegador o instalado en su celular como una app.",
  },
  {
    numero: "02",
    titulo: "Ve su cuenta al instante",
    detalle:
      "Deuda, historial de boletas y consumo, calculados desde tu propio registro. También puede preguntarle al asistente.",
  },
  {
    numero: "03",
    titulo: "Tu oficina descansa",
    detalle:
      "Las consultas repetitivas de deuda quedan resueltas solas; tu equipo se enfoca en lo que sí necesita una persona.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-24">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mx-auto mb-12 max-w-[640px] text-center">
          <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.4rem)] font-semibold text-balance">
            Tres pasos, ningún trámite para el socio
          </h2>
        </div>

        <div className="grid overflow-hidden rounded-2xl border border-border sm:grid-cols-3">
          {pasos.map(({ numero, titulo, detalle }, i) => (
            <div
              key={numero}
              className={cn(
                "bg-card p-8 sm:p-7",
                i > 0 && "border-t border-border sm:border-t-0 sm:border-l"
              )}
            >
              <span className="mb-4 block font-mono text-[0.78rem] font-bold text-primary">
                {numero}
              </span>
              <h3 className="mb-2.5 text-[1.14rem] font-semibold">{titulo}</h3>
              <p className="text-[0.93rem] leading-relaxed text-muted-foreground">
                {detalle}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

