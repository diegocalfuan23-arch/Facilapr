import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatearPeriodo } from "@/lib/boletas";
import type { DatosTarifa } from "@/lib/tarifa";
import { mesCortoDe, metros, promedio } from "@/lib/tarifa-comun";
import { cn } from "@/lib/utils";

const TARJETA = "gap-4 rounded-2xl border-0 p-4 shadow-[0_8px_24px_rgba(58,12,227,0.08)] sm:p-6";
const GRIS = "text-[#5B5970]";

const clp = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("es-CL")}`;

export type TarifaVigente = {
  cargoFijo: number | null;
  valorM3: number | null;
  cargoFijoComercial: number | null;
  valorM3Comercial: number | null;
};

/** Lo mismo que trae el PDF del año, para verlo sin descargarlo. */
export function TarifaResumen({
  datos,
  tarifa,
  puedeCambiar,
}: {
  datos: Pick<DatosTarifa, "meses" | "consumo" | "ingresos" | "egresos" | "totalIngresos" | "totalEgresos">;
  tarifa: TarifaVigente;
  puedeCambiar: boolean;
}) {
  const maximo = Math.max(1, ...datos.meses.map((m) => Math.max(m.producido ?? 0, m.facturado)));
  const hayAgua = datos.meses.some((m) => m.producido || m.facturado > 0);
  const hayComercial = tarifa.cargoFijoComercial !== null && tarifa.valorM3Comercial !== null;
  const valor = (n: number | null) => (n === null ? "—" : clp(n));
  const tarifas = [
    { nombre: hayComercial ? "Residencial" : null, cargo: tarifa.cargoFijo, m3: tarifa.valorM3 },
    ...(hayComercial ? [{ nombre: "Comercial", cargo: tarifa.cargoFijoComercial, m3: tarifa.valorM3Comercial }] : []),
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className={cn(TARJETA, "md:col-span-2")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Agua por mes (m³)</h2>
          <p className={cn("flex items-center gap-4 text-xs", GRIS)}>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-[#C9C0FF]" aria-hidden />
              Producida
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-[#3A0CE3]" aria-hidden />
              Facturada
            </span>
          </p>
        </div>
        {hayAgua ? (
          <ul className="flex items-end gap-1 sm:gap-2">
            {datos.meses.map((m) => (
              <li
                key={m.mes}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                title={`${formatearPeriodo(m.mes)}: producida ${m.producido === null ? "sin anotar" : `${metros(m.producido)} m³`}, facturada ${metros(m.facturado)} m³`}
              >
                <span className="flex h-32 w-full max-w-12 items-end justify-center gap-px">
                  {[
                    { v: m.producido ?? 0, color: "bg-[#C9C0FF]" },
                    { v: m.facturado, color: "bg-[#3A0CE3]" },
                  ].map((b) => (
                    <span key={b.color} className={cn("w-1/2 rounded-t", b.color)} style={{ height: b.v > 0 ? `${Math.max((b.v / maximo) * 100, 2)}%` : 0 }} />
                  ))}
                </span>
                <span className={cn("text-[11px]", GRIS)}>{mesCortoDe(m.mes)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn("py-8 text-center text-sm", GRIS)}>Sin datos este año</p>
        )}
      </Card>

      <Card className={TARJETA}>
        <div>
          <h2 className="font-semibold">Consumo por arranque</h2>
          {datos.consumo && <p className={cn("text-xs", GRIS)}>{formatearPeriodo(datos.consumo.mes)}</p>}
        </div>
        {datos.consumo ? (
          <>
            <ul className="flex flex-col gap-2">
              {datos.consumo.rangos.map((r) => (
                <li key={r.nombre} className="grid grid-cols-[88px_1fr_32px] items-center gap-2 text-sm">
                  <span>{r.nombre}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[#F0EEF6]">
                    <span className="block h-full rounded-full bg-[#3A0CE3]" style={{ width: `${(r.arranques / Math.max(1, datos.consumo!.arranques)) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{r.arranques}</span>
                </li>
              ))}
            </ul>
            <p className={cn("text-sm", GRIS)}>
              Promedio <strong className="text-foreground tabular-nums">{promedio(datos.consumo.m3 / Math.max(1, datos.consumo.arranques))} m³</strong> en{" "}
              {datos.consumo.arranques} {datos.consumo.arranques === 1 ? "arranque" : "arranques"}
            </p>
          </>
        ) : (
          <p className={cn("py-8 text-center text-sm", GRIS)}>Sin boletas con consumo</p>
        )}
      </Card>

      <Card className={TARJETA}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Tarifa vigente</h2>
          {puedeCambiar && (
            <Link href="/panel/configuracion?seccion=facturacion" className="text-sm font-medium text-[#3A0CE3] hover:underline">
              Cambiar
            </Link>
          )}
        </div>
        {tarifas.map((t) => (
          <div key={t.nombre ?? "general"}>
            {t.nombre && <p className="mb-1 text-sm font-medium">{t.nombre}</p>}
            <dl className="grid grid-cols-2 gap-2">
              {[
                ["Cargo fijo", t.cargo],
                ["Valor del m³", t.m3],
              ].map(([nombre, n]) => (
                <div key={nombre} className="rounded-xl bg-[#F7F6FB] p-4">
                  <dt className={cn("text-xs", GRIS)}>{nombre}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{valor(n as number | null)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </Card>

      <Dinero titulo="Ingresos" lineas={datos.ingresos} total={datos.totalIngresos} />
      <Dinero titulo="Gastos" lineas={datos.egresos} total={datos.totalEgresos} />
    </div>
  );
}

function Dinero({ titulo, lineas, total }: { titulo: string; lineas: { nombre: string; monto: number }[]; total: number }) {
  return (
    <Card className={TARJETA}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        <p className="text-xl font-semibold tabular-nums">{clp(total)}</p>
      </div>
      {lineas.length === 0 ? (
        <p className={cn("py-4 text-center text-sm", GRIS)}>Sin registros</p>
      ) : (
        <ul className="divide-y divide-[#F0EEF6]">
          {lineas.map((l) => (
            <li key={l.nombre} className="flex items-baseline justify-between gap-4 py-2 text-sm">
              <span className="min-w-0 break-words">{l.nombre}</span>
              <span className="shrink-0 tabular-nums">{clp(l.monto)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
