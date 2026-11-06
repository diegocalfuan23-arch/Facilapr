import type { Metadata } from "next";
import { Header } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { CambiaSection } from "@/components/site/cambia-section";
import { ProductoSection } from "@/components/site/producto-section";
import { PricingSection } from "@/components/site/pricing-section";
import { FaqSection } from "@/components/site/faq-section";
import { ContactSection } from "@/components/site/contact-section";
import { Footer } from "@/components/site/footer";
import { StructuredData } from "@/components/seo/structured-data";
import { AssistantWidget } from "@/components/site/assistant-widget";

/** El canonical es de cada página: antes lo heredaban todas desde el layout y apuntaban a la portada. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    // Colores fijos: la portada tiene su propio diseño, claro y oscuro a la vez.
    <div className="flex flex-1 flex-col bg-[#F6F6FB] text-[#15132B]">
      <StructuredData />
      <Header />
      <main>
        <Hero />
        <CambiaSection />
        <ProductoSection />
        <PricingSection />
        <FaqSection />
        <ContactSection />
      </main>
      <Footer />
      <AssistantWidget />
    </div>
  );
}
