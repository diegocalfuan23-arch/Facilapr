import type { Metadata } from "next";
import { requireFinanzas } from "@/lib/apr-session";
import type { Plan } from "@/lib/planes";
import { AyudaRecorridos } from "@/components/panel/ayuda-recorridos";

export const metadata: Metadata = {
  title: "Ayuda",
};

export default async function AyudaPanelPage() {
  const { apr } = await requireFinanzas();
  return <AyudaRecorridos plan={apr.plan as Plan} />;
}
