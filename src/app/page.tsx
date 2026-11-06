import type { Metadata } from "next";
import { Landing } from "@/components/site/landing";
import { StructuredData } from "@/components/seo/structured-data";
import { AssistantWidget } from "@/components/site/assistant-widget";

/** El canonical es de cada página: antes lo heredaban todas desde el layout y apuntaban a la portada. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData />
      <Landing />
      <AssistantWidget />
    </div>
  );
}
