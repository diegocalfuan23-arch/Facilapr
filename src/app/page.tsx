import { Header } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { PanelSection } from "@/components/site/panel-section";
import { ProblemSection } from "@/components/site/problem-section";
import { HowItWorksSection } from "@/components/site/how-it-works-section";
import { FeaturesSection } from "@/components/site/features-section";
import { InvoiceSection } from "@/components/site/invoice-section";
import { ChatSection } from "@/components/site/chat-section";
import { PricingSection } from "@/components/site/pricing-section";
import { FaqSection } from "@/components/site/faq-section";
import { CtaSection } from "@/components/site/cta-section";
import { ContactSection } from "@/components/site/contact-section";
import { Footer } from "@/components/site/footer";
import { StructuredData } from "@/components/seo/structured-data";
import { AssistantWidget } from "@/components/site/assistant-widget";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData />
      <Header />
      <main>
        <Hero />
        <PanelSection />
        <ProblemSection />
        <HowItWorksSection />
        <FeaturesSection />
        <InvoiceSection />
        <ChatSection />
        <PricingSection />
        <FaqSection />
        <CtaSection />
        <ContactSection />
      </main>
      <Footer />
      <AssistantWidget />
    </div>
  );
}
