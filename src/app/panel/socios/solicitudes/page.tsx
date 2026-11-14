import type { Metadata } from "next";
import { requireAdmin } from "@/lib/apr-session";
import { SolicitudesTabla } from "@/components/panel/solicitudes-tabla";
import { ConsultasProvider } from "@/components/panel/consultas-provider";
import { listarSolicitudes } from "@/lib/solicitudes-socios";

export const metadata: Metadata = {
  title: "Solicitudes de acceso",
};

export default async function SolicitudesPage() {
  const { apr } = await requireAdmin();

  const datos = await listarSolicitudes(apr);

  return (
    <ConsultasProvider>
      <SolicitudesTabla inicial={datos} comite={{ nombre: apr.nombre }} />
    </ConsultasProvider>
  );
}
