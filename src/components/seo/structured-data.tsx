import { PREGUNTAS } from "@/lib/faq";
const SITE_URL = "https://facilapr.cl";

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Facilapr",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "Software de gestión para comités de Agua Potable Rural (APR) y Servicios Sanitarios Rurales (SSR) en Chile. Administra socios, boletas, pagos, lecturas de medidor y morosidad, con un panel donde cada socio ve su propia deuda al instante.",
  inLanguage: "es-CL",
  areaServed: { "@type": "Country", name: "Chile" },
  offers: [
    {
      "@type": "Offer",
      name: "Comité Pequeño",
      description: "Para APR con hasta 200 socios.",
      price: "0.7",
      priceCurrency: "CLF",
      availability: "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      name: "Comité Estándar",
      description: "Para APR con hasta 800 socios.",
      price: "1.5",
      priceCurrency: "CLF",
      availability: "https://schema.org/InStock",
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: PREGUNTAS.map((p) => ({
    "@type": "Question",
    name: p.pregunta,
    acceptedAnswer: { "@type": "Answer", text: p.respuesta },
  })),
};

export function StructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}
