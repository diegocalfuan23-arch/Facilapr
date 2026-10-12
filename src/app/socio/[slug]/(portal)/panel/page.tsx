import type { Metadata } from "next";
import Link from "next/link";
import { requireSocio } from "@/lib/socio-session";
import { saldo, formatearPeriodo } from "@/lib/boletas";
import { basePortal } from "@/lib/portal-socio";
import { boletasDelPortal } from "@/lib/portal-socio-datos";
import { cortadosActuales, ordenesDeSocios } from "@/lib/ordenes-datos";
import { InstalarApp } from "@/components/socio/instalar-app";
import {
  clp,
  estaPorPagar,
  fecha,
  ListaBoletas,
  SinDatos,
  TituloPantalla,
} from "@/components/socio/boletas-ui";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function ResumenSocioPage({ params }: Props) {
  const { slug } = await params;
  const { socio } = await requireSocio(slug);
  const base = await basePortal(slug);
  const { cuentas, lista } = await boletasDelPortal(socio);
  const cortados = cortadosActuales(await ordenesDeSocios(cuentas.map((c) => c.id)));

  const porPagar = lista.filter(estaPorPagar);
  const pendiente = porPagar[0];
  const deudaTotal = porPagar.reduce(
    (acc, b) => acc + saldo(b.montoTotal, b.montoPagado),
    0
  );
  const totalPagado = lista
    .filter((b) => b.estado !== "ANULADA")
    .reduce((acc, b) => acc + b.montoPagado, 0);
  // Las boletas vienen de la más nueva a la más antigua.
  const ultimoConsumo = lista.find((b) => b.consumoM3 !== null)?.consumoM3 ?? null;

  return (
    <>
      <TituloPantalla titulo={`Hola, ${socio.nombre.split(" ")[0]}`} />

      {cortados.length > 0 && (
        <section className="mb-4 rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
          <h2 className="font-semibold text-destructive">
            {cortados.length === 1 ? "Tu servicio está cortado" : "Tienes servicios cortados"}
          </h2>
          <p className="mt-1 text-[0.88rem] text-muted-foreground">
            Cuando regularices tu situación, pide que te lo repongan desde{" "}
            <Link href={`${base}/solicitudes`} className="font-medium text-primary hover:underline">
              Solicitudes
            </Link>
            .
          </p>
        </section>
      )}

      <InstalarApp />

      <section
        className={`rounded-2xl border p-6 ${
          deudaTotal > 0
            ? "border-destructive/25 bg-destructive/5"
            : "border-forest/25 bg-forest/5"
        }`}
      >
        <span className="text-[0.85rem] text-muted-foreground">
          {deudaTotal > 0 ? "Debes" : "Estás al día"}
        </span>
        <div className="mt-1 text-[2rem] font-semibold tabular-nums">
          {clp.format(deudaTotal)}
        </div>
        {pendiente && (
          <p className="mt-1 text-[0.88rem] text-muted-foreground">
            Boleta de {formatearPeriodo(pendiente.periodo)}, vence el{" "}
            {fecha.format(pendiente.fechaVencimiento)}
          </p>
        )}
      </section>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { etiqueta: "Pendientes", valor: String(porPagar.length) },
          { etiqueta: "Total pagado", valor: clp.format(totalPagado) },
          {
            etiqueta: "Último consumo",
            valor: ultimoConsumo !== null ? `${ultimoConsumo} m³` : "—",
          },
        ].map((d) => (
          <div
            key={d.etiqueta}
            className="min-w-0 rounded-xl border border-border/60 bg-card px-3.5 py-3"
          >
            <div className="truncate text-[0.74rem] text-muted-foreground">
              {d.etiqueta}
            </div>
            <div className="mt-0.5 truncate text-[1.05rem] font-semibold tabular-nums">
              {d.valor}
            </div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-[1.05rem] font-semibold">Últimas boletas</h2>
          {lista.length > 3 && (
            <Link
              href={`${base}/boletas`}
              className="text-[0.85rem] font-medium text-primary hover:underline"
            >
              Ver todas
            </Link>
          )}
        </div>
        {lista.length === 0 ? (
          <SinDatos>Todavía no tienes boletas emitidas.</SinDatos>
        ) : (
          <ListaBoletas
            boletas={lista.slice(0, 3)}
            base={base}
            variasCuentas={cuentas.length > 1}
          />
        )}
      </section>
    </>
  );
}
