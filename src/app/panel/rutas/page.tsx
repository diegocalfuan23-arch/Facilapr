import type { Metadata } from "next";
import { requireAdmin } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { sociosConAnterior } from "@/lib/terreno";
import { arranquesParaRutas, laboresPorRuta, rutasDelComite } from "@/lib/rutas";
import { listarLabores } from "@/lib/labores";
import { listarInsumos } from "@/lib/inventario";
import { RutasPagina } from "@/components/panel/rutas-pagina";

export const metadata: Metadata = {
  title: "Rutas",
};

export default async function RutasPage() {
  const { user, apr } = await requireAdmin();
  // Las labores usan el inventario: van con el mismo plan.
  const conLabores = puede(apr.plan as Plan, "inventario");
  const [{ listaSocios }, rutas, arranques, labores, insumos, porRuta] = await Promise.all([
    sociosConAnterior(apr.id),
    rutasDelComite(apr.id, user.id, "ADMIN"),
    arranquesParaRutas(apr.id),
    conLabores ? listarLabores(apr.id) : Promise.resolve([]),
    conLabores ? listarInsumos(apr.id) : Promise.resolve([]),
    conLabores ? laboresPorRuta(apr.id) : Promise.resolve({}),
  ]);

  return (
    <>
      <RutasPagina
        socios={listaSocios.map((s) => ({ id: s.id, nombre: s.nombre, numeroCliente: s.numeroCliente, lat: s.lat, lng: s.lng }))}
        rutas={rutas}
        arranques={arranques}
        laboresPorRuta={porRuta}
        laboresAsignables={labores.map((l) => ({ id: l.id, numero: l.numero, titulo: l.titulo, tipo: l.tipo, fecha: l.fecha, estado: l.estado }))}
        insumos={insumos}
        conLabores={conLabores}
      />
    </>
  );
}
