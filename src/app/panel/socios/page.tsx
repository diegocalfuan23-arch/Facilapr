import type { Metadata } from "next";
import { requireAdmin } from "@/lib/apr-session";
import { datosSocios } from "@/lib/socios-datos";
import { SociosTabla } from "@/components/panel/socios-tabla";
import { ConsultasProvider } from "@/components/panel/consultas-provider";

export const metadata: Metadata = {
  title: "Socios",
};

export default async function SociosPage() {
  const { apr } = await requireAdmin();

  const dominio = process.env.NEXT_PUBLIC_DOMINIO_RAIZ ?? "facilapr.cl";

  return (
    <ConsultasProvider>
      <SociosTabla
        socios={await datosSocios(apr)}
        comite={{ nombre: apr.nombre, slug: apr.slug }}
        urlSolicitud={apr.slug ? `https://${dominio}/${apr.slug}/cuenta/solicitar` : null}
      />
    </ConsultasProvider>
  );
}
