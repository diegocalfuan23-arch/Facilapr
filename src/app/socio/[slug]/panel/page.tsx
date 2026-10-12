import type { Metadata } from "next";
import Link from "next/link";
import { Droplets } from "lucide-react";
import { desc, inArray } from "drizzle-orm";
import { cuentasDelSocio, requireSocio } from "@/lib/socio-session";
import { db } from "@/lib/db";
import { boletas } from "@/lib/db/schema";
import { saldo, formatearPeriodo } from "@/lib/boletas";
import { SignOutSocioButton } from "@/components/socio/sign-out-button";
import { AsistenteSocio } from "@/components/socio/asistente-socio";
import { ChatComite } from "@/components/socio/chat-comite";
import { PortalNav } from "@/components/socio/portal-nav";
import { InstalarApp } from "@/components/socio/instalar-app";
import { basePortal } from "@/lib/portal-socio";
import { puede, type Plan } from "@/lib/planes";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Mi cuenta" };

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const fecha = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
});

const ESTADO_ESTILO = {
  PENDIENTE: "bg-tertiary/15 text-tertiary-foreground",
  PAGADA: "bg-forest/15 text-forest",
  VENCIDA: "bg-destructive/15 text-destructive",
  ANULADA: "bg-muted text-muted-foreground",
} as const;

const ESTADO_TEXTO = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  VENCIDA: "Vencida",
  ANULADA: "Anulada",
} as const;

export default async function PanelSocioPage({ params }: Props) {
  const { slug } = await params;
  const { socio } = await requireSocio(slug);
  const base = await basePortal(slug);

  // Una persona con varios arranques ve las boletas de todos ellos.
  const cuentas = await cuentasDelSocio(socio);
  const listaBoletas = await db.query.boletas.findMany({
    where: inArray(
      boletas.socioId,
      cuentas.map((c) => c.id)
    ),
    orderBy: [desc(boletas.fechaEmision)],
    limit: 12 * cuentas.length,
    with: { socio: { columns: { nombre: true } } },
  });

  const pendiente = listaBoletas.find(
    (b) => b.estado === "PENDIENTE" || b.estado === "VENCIDA"
  );
  const deudaTotal = listaBoletas
    .filter((b) => b.estado === "PENDIENTE" || b.estado === "VENCIDA")
    .reduce((acc, b) => acc + saldo(b.montoTotal, b.montoPagado), 0);

  // Pagos y abonos: toda boleta de la que ya se pagó algo.
  const pagos = listaBoletas.filter(
    (b) => b.estado !== "ANULADA" && b.montoPagado > 0
  );
  const totalPagado = pagos.reduce((acc, b) => acc + b.montoPagado, 0);
  const cantidadPendientes = listaBoletas.filter(
    (b) => b.estado === "PENDIENTE" || b.estado === "VENCIDA"
  ).length;
  // Las boletas vienen de la más nueva a la más antigua.
  const ultimoConsumo = listaBoletas.find((b) => b.consumoM3 !== null)?.consumoM3 ?? null;

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      {/* Escritorio: menú fijo a la izquierda. En el celular se mantiene el encabezado de arriba. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Droplets className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold">{socio.apr.nombre}</div>
            <div className="text-[0.78rem] text-muted-foreground">Portal del socio</div>
          </div>
        </div>

        <PortalNav />

        <div className="mt-auto flex flex-col gap-3 border-t border-border p-4">
          <div className="min-w-0">
            <div className="truncate text-[0.9rem] font-medium">{socio.nombre}</div>
            {cuentas.length > 1 && (
              <div className="text-[0.78rem] text-muted-foreground">
                {cuentas.length} arranques
              </div>
            )}
          </div>
          <SignOutSocioButton base={base} />
        </div>
      </aside>

      <header className="border-b border-border lg:hidden">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-6 py-4">
          <div>
            <div className="font-semibold">{socio.nombre}</div>
            <div className="text-[0.82rem] text-muted-foreground">
              {socio.apr.nombre}
            </div>
          </div>
          <SignOutSocioButton base={base} />
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-6 py-10 pb-40 lg:max-w-[840px] lg:py-12">
        <h1 className="mb-6 hidden text-[1.5rem] font-semibold tracking-tight lg:block">
          Hola, {socio.nombre.split(" ")[0]}
        </h1>

        <InstalarApp />

        <section
          id="resumen"
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
            { etiqueta: "Pendientes", valor: String(cantidadPendientes) },
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

        <section id="boletas" className="mt-10 scroll-mt-6">
          <h2 className="text-[1.05rem] font-semibold">Tus boletas</h2>

          {listaBoletas.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-[0.9rem] text-muted-foreground">
              Todavía no tienes boletas emitidas.
            </p>
          ) : (
            <div className="mt-4 flex flex-col divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
              {listaBoletas.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div>
                    <div className="font-medium">
                      {formatearPeriodo(b.periodo)}
                      {cuentas.length > 1 && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {b.socio.nombre}
                        </span>
                      )}
                    </div>
                    <div className="text-[0.82rem] text-muted-foreground">
                      Vence el {fecha.format(b.fechaVencimiento)}
                      {b.consumoM3 !== null && ` · ${b.consumoM3} m³`}
                    </div>
                    {b.estado !== "ANULADA" &&
                      b.montoPagado > 0 &&
                      b.montoPagado < b.montoTotal && (
                        <div className="text-[0.82rem] text-forest">
                          Abonaste {clp.format(b.montoPagado)} · te quedan{" "}
                          {clp.format(saldo(b.montoTotal, b.montoPagado))}
                        </div>
                      )}
                    {b.estado !== "ANULADA" && (
                      <Link
                        href={`${base}/recibo/${b.id}`}
                        className="text-[0.82rem] font-medium text-primary hover:underline"
                      >
                        Ver recibo
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[0.95rem] font-semibold tabular-nums">
                      {clp.format(b.montoTotal)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${ESTADO_ESTILO[b.estado]}`}
                    >
                      {ESTADO_TEXTO[b.estado]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="pagos" className="mt-10 scroll-mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[1.05rem] font-semibold">Tus pagos</h2>
            {pagos.length > 0 && (
              <span className="text-[0.85rem] text-muted-foreground">
                Total pagado{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {clp.format(totalPagado)}
                </span>
              </span>
            )}
          </div>

          {pagos.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-[0.9rem] text-muted-foreground">
              Todavía no hay pagos registrados.
            </p>
          ) : (
            <div className="mt-4 flex flex-col divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
              {pagos.map((b) => {
                const completo = b.montoPagado >= b.montoTotal;
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <div className="font-medium">
                        {completo ? "Pago" : "Abono"} de{" "}
                        {formatearPeriodo(b.periodo)}
                        {cuentas.length > 1 && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {b.socio.nombre}
                          </span>
                        )}
                      </div>
                      <div className="text-[0.82rem] text-muted-foreground">
                        {completo
                          ? "Boleta pagada completa"
                          : `De ${clp.format(b.montoTotal)} · faltan ${clp.format(saldo(b.montoTotal, b.montoPagado))}`}
                      </div>
                    </div>
                    <span className="font-mono text-[0.95rem] font-semibold text-forest tabular-nums">
                      {clp.format(b.montoPagado)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <AsistenteSocio nombreApr={socio.apr.nombre} slug={slug} />
      {puede(socio.apr.plan as Plan, "chat") && (
        <ChatComite socioId={socio.id} slug={slug} nombreApr={socio.apr.nombre} />
      )}
    </div>
  );
}
