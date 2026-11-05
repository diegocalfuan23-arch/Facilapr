import type { Metadata } from "next";
import { requireFinanzas } from "@/lib/apr-session";
import { AyudaRecorridos } from "@/components/panel/ayuda-recorridos";

export const metadata: Metadata = {
  title: "Ayuda",
};

export default async function AyudaPanelPage() {
  await requireFinanzas();
  return <AyudaRecorridos />;
}
