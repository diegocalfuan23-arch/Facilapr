import type { Metadata } from "next";
import { requireApr } from "@/lib/apr-session";
import { datosTerreno } from "@/lib/terreno";
import { LecturaForm } from "@/components/panel/lectura-form";

export const metadata: Metadata = {
  title: "Modo terreno",
};

/**
 * La pantalla de cargar lecturas, para quien sale a terreno: el operador y
 * también la directiva (p. ej. el presidente que toma las lecturas él mismo)
 * con su propia cuenta, sin necesitar un segundo usuario. Se instala como app y
 * guarda las lecturas sin señal, igual que la del operador.
 */
export default async function TerrenoPage() {
  const { user, apr } = await requireApr();
  return (
    <LecturaForm
      {...await datosTerreno(user.id, apr.id, user.rol ?? "OPERADOR")}
      puedeCargarSocios={user.rol === "ADMIN"}
    />
  );
}
