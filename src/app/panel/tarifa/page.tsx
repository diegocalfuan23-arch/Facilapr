import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireFinanzas } from "@/lib/apr-session";
import { puede, type Plan } from "@/lib/planes";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { datosTarifa } from "@/lib/tarifa";
import { anioPedido, aniosDisponibles } from "@/lib/tarifa-comun";
import { TarifaVista } from "@/components/panel/tarifa-vista";

export const metadata: Metadata = {
  title: "Datos tarifarios",
};

export default async function TarifaPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { apr, user } = await requireFinanzas();
  const plan = apr.plan as Plan;
  if (!puede(plan, "finanzas")) redirect("/panel");

  const hoy = hoyEnChile();
  const anio = anioPedido((await searchParams).anio, hoy);
  const datos = await datosTarifa(apr.id, anio, hoy, { activos: false });

  return (
    <TarifaVista
      // Al cambiar de año, los campos parten con lo de ese año.
      key={anio}
      anio={anio}
      limites={aniosDisponibles(hoy)}
      datos={datos}
      tarifa={{
        cargoFijo: apr.tarifaCargoFijo,
        valorM3: apr.tarifaMetroCubico,
        cargoFijoComercial: apr.tarifaCargoFijoComercial,
        valorM3Comercial: apr.tarifaMetroCubicoComercial,
      }}
      // La configuración es solo del administrador.
      puedeCambiarTarifa={user.rol === "ADMIN"}
    />
  );
}
