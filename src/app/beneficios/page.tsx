import type { Metadata } from "next";
import Link from "next/link";
import { Check, Gauge, MessageCircle, ReceiptText, Smartphone, Sparkles, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/marca/logo";
import { MensajesWhatsapp } from "@/components/site/mensajes-whatsapp";
import { SITE_URL } from "@/lib/site-url";

const TITULO = "Beneficios de Facilapr para comités de agua potable rural (APR)";
const DESCRIPCION =
  "Boletas y comprobantes que llegan solos por WhatsApp, lecturas desde el celular, cobros al día y una cuenta en línea para cada socio. Conoce lo que Facilapr hace por tu comité.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/beneficios" },
  openGraph: {
    type: "website",
    siteName: "Facilapr",
    locale: "es_CL",
    url: "/beneficios",
    title: TITULO,
    description: DESCRIPCION,
  },
};

const WHATSAPP: string[] = [
  "Tus socios reciben la boleta del mes y su comprobante de pago sin que escribas uno por uno.",
  "Salen desde el número de WhatsApp de tu comité.",
  "Solo les llega a quienes aceptaron recibir WhatsApp.",
  "Meta cobra los mensajes directo a la cuenta de tu comité.",
];

const OTROS: { icono: LucideIcon; titulo: string; texto: string }[] = [
  { icono: ReceiptText, titulo: "Boletas y pagos", texto: "Boletas con PDF, pagos con comprobante y saldo de cada socio al día." },
  { icono: Gauge, titulo: "Lecturas desde el celular", texto: "El operador anota cada medidor en terreno y el consumo se calcula solo." },
  { icono: Smartphone, titulo: "Cuenta en línea del socio", texto: "Cada socio ve sus boletas y pagos desde su celular, con un QR en el recibo." },
  { icono: Sparkles, titulo: "Asistente en el chat", texto: "Responde a tus socios con los datos de su cuenta y te avisa cuando hace falta una persona." },
];

export default function BeneficiosPage() {
  const datos = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: TITULO,
    description: DESCRIPCION,
    url: `${SITE_URL}/beneficios`,
    publisher: { "@type": "Organization", name: "Facilapr", url: SITE_URL },
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datos) }} />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo className="size-6" />
            Facilapr
          </Link>
          <Link href="/registro" className="rounded-lg bg-primary px-4 py-2 text-[0.88rem] font-medium text-primary-foreground hover:bg-primary/90">
            Crear mi cuenta
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-6 py-12 sm:py-16">
        <h1 className="max-w-[640px] text-[clamp(1.8rem,3.4vw,2.5rem)] leading-tight font-semibold tracking-tight">
          Lo que Facilapr hace por tu comité
        </h1>
        <p className="mt-3 max-w-[560px] text-[1rem] text-muted-foreground">
          Menos tiempo cobrando y avisando, más socios al día.
        </p>

        <section className="mt-14 grid items-center gap-10 md:grid-cols-[1fr_340px] md:gap-16">
          <div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
              <MessageCircle className="size-4" aria-hidden />
              WhatsApp
            </span>
            <h2 className="mt-3 text-[1.5rem] leading-tight font-semibold tracking-tight">
              Boletas y comprobantes que llegan solos
            </h2>
            <ul className="mt-5 flex flex-col gap-3">
              {WHATSAPP.map((t) => (
                <li key={t} className="flex gap-3 text-[0.97rem] leading-relaxed">
                  <Check className="mt-1 size-4.5 shrink-0 text-primary" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[0.85rem] text-muted-foreground">
              Conectar tu propio número está disponible desde el plan Estándar.
            </p>
          </div>
          <MensajesWhatsapp />
        </section>

        <section className="mt-20">
          <h2 className="text-[1.3rem] font-semibold tracking-tight">Y además</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {OTROS.map(({ icono: Icono, titulo, texto }) => (
              <div key={titulo} className="rounded-2xl border border-border p-5">
                <span aria-hidden className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icono className="size-5" />
                </span>
                <h3 className="mt-3 text-[1rem] font-semibold">{titulo}</h3>
                <p className="mt-1 text-[0.9rem] leading-relaxed text-muted-foreground">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-16 rounded-2xl border border-primary/25 bg-primary/5 p-6 sm:p-8">
          <h2 className="text-[1.15rem] font-semibold">Pruébalo con tu comité</h2>
          <p className="mt-1.5 text-[0.92rem] text-muted-foreground">Crea la cuenta y carga tus socios con tu propia planilla.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/registro" className="inline-block rounded-lg bg-primary px-4 py-2 text-[0.9rem] font-medium text-primary-foreground hover:bg-primary/90">
              Crear la cuenta de mi comité
            </Link>
            <Link href="/ayuda" className="inline-block rounded-lg border border-border px-4 py-2 text-[0.9rem] font-medium hover:bg-muted">
              Centro de ayuda
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
