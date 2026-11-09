import type { Metadata } from "next";
import { requireApr } from "@/lib/apr-session";
import { datosTerreno } from "@/lib/terreno";
import { datosLecturas } from "@/lib/lecturas-datos";
import { LecturaForm } from "@/components/panel/lectura-form";
import { LecturasTabla } from "@/components/panel/lecturas-tabla";
import { ConsultasProvider } from "@/components/panel/consultas-provider";

export const metadata: Metadata = {
  title: "Lecturas",
};

export default async function LecturasPage() {
  const { user, apr } = await requireApr();

  // El operador solo ve la pantalla de cargar lecturas.
  if (user.rol === "OPERADOR") {
    return <LecturaForm {...await datosTerreno(user.id, apr.id)} />;
  }

  return (
    <ConsultasProvider>
      <LecturasTabla datos={await datosLecturas(apr.id)} />
    </ConsultasProvider>
  );
}
