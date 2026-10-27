import type { Metadata } from "next";
import Link from "next/link";
import { Check, Download } from "lucide-react";
import { AyudaLayout } from "@/components/ayuda/ayuda-layout";
import { SITE_URL } from "@/lib/site-url";

const ARCHIVO = "/descargas/planilla-cobro-agua-potable-rural-apr.xlsx";

export const metadata: Metadata = {
  title: "Planilla gratis en Excel para cobrar el agua potable rural (APR)",
  description:
    "Descarga gratis una planilla de Excel para llevar las lecturas, las boletas y los pagos de tu comité de agua potable rural: calcula sola el consumo, el total, el saldo y quién está moroso.",
  alternates: { canonical: "/planilla-cobro-agua-potable-rural" },
  openGraph: {
    type: "website",
    siteName: "Facilapr",
    locale: "es_CL",
    url: "/planilla-cobro-agua-potable-rural",
    title: "Planilla gratis en Excel para cobrar el agua potable rural (APR)",
    description:
      "Lecturas, boletas y pagos de tu APR en una planilla que calcula sola. Gratis, sin registro.",
  },
};

const incluye = [
  "Cargo fijo y valor del metro cúbico, que cambias en un solo lugar.",
  "Lectura anterior y actual de cada medidor: la planilla calcula el consumo en m³.",
  "Total del consumo y total a pagar de cada socio, con el cargo fijo incluido.",
  "Columna de pagos y saldo: si un socio abona una parte, el saldo se ajusta solo.",
  "Estado de cada arranque: pagado, pendiente o moroso (con la fecha de vencimiento).",
  "Un resumen del mes: cuánto cobraste, cuánto se pagó, cuánto falta y cuántos socios deben.",
  "Capacidad para 300 arranques, con nombre, RUT, teléfono y dirección.",
];

const pasos = [
  "Descarga la planilla y ábrela en Excel o en tu programa de planillas.",
  "En la hoja Configuración escribe tu cargo fijo, el valor del m³ y la fecha de vencimiento.",
  "En Cobro del mes anota a cada arranque y sus lecturas. Borra las filas de ejemplo.",
  "Cuando un socio pague, escribe el monto en la columna Pagado.",
  "Mira la hoja Resumen para saber cómo va el mes. El mes siguiente, la lectura actual pasa a ser la anterior.",
];

export default function PlanillaPage() {
  const datos = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Planilla gratis en Excel para cobrar el agua potable rural (APR)",
    description:
      "Planilla de Excel gratuita para llevar las lecturas, boletas y pagos de un comité de agua potable rural.",
    url: `${SITE_URL}/planilla-cobro-agua-potable-rural`,
    publisher: { "@type": "Organization", name: "Facilapr", url: SITE_URL },
  };

  return (
    <AyudaLayout>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datos) }} />
      <main className="mx-auto max-w-[760px] px-7 py-12">
        <span className="font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
          Recurso gratis para comités APR
        </span>
        <h1 className="mt-3 text-[clamp(1.7rem,3vw,2.2rem)] leading-tight font-semibold tracking-tight">
          Planilla gratis en Excel para cobrar el agua potable rural (APR)
        </h1>
        <p className="mt-3 text-[1rem] text-muted-foreground">
          Una planilla lista para llevar las lecturas de los medidores, calcular cada boleta y saber quién pagó y quién
          debe. Sin registro, sin costo.
        </p>

        <a
          href={ARCHIVO}
          download
          className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-[0.95rem] font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Download className="size-4.5" />
          Descargar la planilla (Excel)
        </a>

        <h2 className="mt-12 text-[1.2rem] font-semibold">Qué incluye</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {incluye.map((t) => (
            <li key={t} className="flex gap-3 text-[0.95rem] leading-relaxed">
              <Check className="mt-1 size-4.5 shrink-0 text-primary" />
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 text-[1.2rem] font-semibold">Cómo usarla</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {pasos.map((t, i) => (
            <li key={t} className="flex gap-4 text-[0.95rem] leading-relaxed">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[0.8rem] font-semibold text-primary-foreground"
              >
                {i + 1}
              </span>
              <span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>

        <div className="mt-12 rounded-2xl border border-primary/25 bg-primary/5 p-6">
          <h2 className="text-[1.05rem] font-semibold">¿Muchos socios y poco tiempo?</h2>
          <p className="mt-1.5 text-[0.92rem] text-muted-foreground">
            Una planilla sirve para empezar. Cuando el comité crece, Facilapr hace lo mismo en línea: lecturas desde el
            celular, boletas, pagos con comprobante y una cuenta para cada socio. Esta misma planilla se puede importar
            directo.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/registro"
              className="inline-block rounded-lg bg-primary px-4 py-2 text-[0.9rem] font-medium text-primary-foreground hover:bg-primary/90"
            >
              Crear la cuenta de mi comité
            </Link>
            <Link
              href="/ayuda/cobrar-agua-apr-sin-excel"
              className="inline-block rounded-lg border border-border px-4 py-2 text-[0.9rem] font-medium hover:bg-muted"
            >
              Cómo cobrar el agua sin Excel
            </Link>
          </div>
        </div>
      </main>
    </AyudaLayout>
  );
}
