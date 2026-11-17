import type { Metadata } from "next";
import { requireAdmin } from "@/lib/apr-session";
import { sociosConAnterior } from "@/lib/terreno";
import { arranquesParaRutas, rutasDelComite } from "@/lib/rutas";
import { RutasPanel } from "@/components/panel/rutas-panel";

export const metadata: Metadata = {
  title: "Rutas",
};

export default async function RutasPage() {
  const { user, apr } = await requireAdmin();
  const [{ listaSocios }, rutas, arranques] = await Promise.all([sociosConAnterior(apr.id), rutasDelComite(apr.id, user.id, "ADMIN"), arranquesParaRutas(apr.id)]);

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Rutas</h1>
        <p className="mt-0.5 text-sm text-[#5B5970]">El recorrido de los socios en terreno. Las usa quien toma las lecturas, también sin señal.</p>
      </div>
      <RutasPanel enPagina socios={listaSocios.map((s) => ({ id: s.id, nombre: s.nombre, numeroCliente: s.numeroCliente }))} rutas={rutas} arranques={arranques} esAdmin />
    </div>
  );
}
