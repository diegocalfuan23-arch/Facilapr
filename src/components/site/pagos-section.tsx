import Link from "next/link";
import { ArrowRight, Check, CreditCard } from "lucide-react";

const puntos = [
  {
    titulo: "El socio paga desde su cuenta",
    detalle:
      "En su portal ve la boleta con lo que debe hoy y la paga con Mercado Pago, sin ir a la oficina ni mandar comprobantes.",
  },
  {
    titulo: "El dinero llega a la cuenta de tu comité",
    detalle:
      "Cada comité conecta su propia cuenta de Mercado Pago. Facilapr no recibe tu plata ni cobra comisión por esto.",
  },
  {
    titulo: "El pago queda registrado solo",
    detalle:
      "Cuando Mercado Pago confirma el pago, la boleta pasa a pagada y el socio tiene su comprobante. Tú no anotas nada.",
  },
  {
    titulo: "También puedes mandar un link de pago",
    detalle:
      "Desde el panel generas el link de una boleta y se lo mandas al socio por WhatsApp.",
  },
];

export function PagosSection() {
  return (
    <section id="pagos-en-linea" className="py-23">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="max-w-[700px]">
          <span className="inline-flex items-center gap-2 font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
            <CreditCard className="size-4" />
            Pagos en línea
            <span className="rounded-full bg-tertiary/20 px-2 py-0.5 text-[0.64rem] text-tertiary-foreground">Beta</span>
          </span>
          <h2 className="mt-3 text-[clamp(1.7rem,2.8vw,2.2rem)] font-semibold text-balance">
            Tus socios pagan con Mercado Pago y la boleta se marca sola.
          </h2>
          <p className="mt-4 text-[0.97rem] text-muted-foreground">
            Menos efectivo y menos comprobantes por WhatsApp. Se aplican las comisiones normales de Mercado Pago por cada
            pago. Estamos abriéndolo de a poco: si tu comité quiere probarlo, escríbenos.
          </p>
        </div>

        <ul className="mt-9 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {puntos.map(({ titulo, detalle }) => (
            <li key={titulo} className="flex gap-3">
              <Check className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <strong className="mb-0.5 block">{titulo}</strong>
                <span className="text-[0.9rem] text-muted-foreground">{detalle}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-primary/25 bg-primary/5 p-6">
          <div className="flex-1">
            <strong className="block">¿Eres socio de un comité?</strong>
            <span className="text-[0.9rem] text-muted-foreground">
              Busca tu comité, entra a tu cuenta y paga tu boleta en línea.
            </span>
          </div>
          <Link
            href="/socios"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[0.9rem] font-medium text-primary-foreground hover:bg-primary/90"
          >
            Encontrar mi comité
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
