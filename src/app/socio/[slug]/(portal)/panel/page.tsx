import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays, CheckCircle2, Download, Droplets, FileText } from "lucide-react";
import { requireSocio } from "@/lib/socio-session";
import { saldo, formatearPeriodo } from "@/lib/boletas";
import { basePortal } from "@/lib/portal-socio";
import { boletasDelPortal, pagosDelPortal } from "@/lib/portal-socio-datos";
import { pagoEnLineaActivo } from "@/lib/mercadopago-pagos";
import { cortadosActuales, ordenesDeSocios } from "@/lib/ordenes-datos";
import { listarComunicados } from "@/lib/comunicados";
import { InstalarApp } from "@/components/socio/instalar-app";
import { AvisosSocio, type AvisoSocio } from "@/components/socio/avisos-socio";
import { BotonPagarPortal } from "@/components/socio/boton-pagar-portal";
import { clp, estaPorPagar } from "@/components/socio/boletas-ui";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Mi cuenta" };

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.07)]";
const GRIS = "text-[#5B5970]";
const DIA = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" });
const FECHA_LARGA = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Santiago" });
const dm = (d: Date) => {
  const s = DIA.format(d);
  return `${s.slice(8, 10)}-${s.slice(5, 7)}`;
};
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** El instante actual. La página se arma en el servidor en cada visita, así que leer el reloj aquí es lo correcto. */
const instante = () => Date.now();
const mesDe = (periodo: string) => formatearPeriodo(periodo).split(" ")[0].toLowerCase();
const corto = (periodo: string) => mayus(mesDe(periodo)).slice(0, 3);

export default async function ResumenSocioPage({ params }: Props) {
  const { slug } = await params;
  const { socio } = await requireSocio(slug);
  const base = await basePortal(slug);
  const { cuentas, lista } = await boletasDelPortal(socio);
  const cortados = cortadosActuales(await ordenesDeSocios(cuentas.map((c) => c.id)));
  const pagos = await pagosDelPortal(lista);
  const comunicados = await listarComunicados(socio.aprId, 10, 45);
  const pagoEnLinea = await pagoEnLineaActivo(socio.apr);

  const ahora = instante();
  const hoy = DIA.format(new Date(ahora));
  const anio = hoy.slice(0, 4);
  const variasCuentas = cuentas.length > 1;

  // Lo que debe: todas sus boletas impagas. La que se muestra es la que vence primero.
  const porPagar = lista.filter((b) => estaPorPagar(b) && saldo(b.montoTotal, b.montoPagado) > 0).sort((a, b) => a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime());
  const deuda = porPagar.reduce((s, b) => s + saldo(b.montoTotal, b.montoPagado), 0);
  const pendiente = porPagar[0];
  const dias = pendiente ? Math.ceil((pendiente.fechaVencimiento.getTime() - ahora) / 86_400_000) : 0;
  const cuando = dias > 1 ? `vence en ${dias} días` : dias === 1 ? "vence mañana" : dias === 0 ? "vence hoy" : `venció hace ${-dias} ${dias === -1 ? "día" : "días"}`;

  const pagadoAnio = pagos.filter((p) => DIA.format(p.fecha).startsWith(anio)).reduce((s, p) => s + p.monto, 0);
  const ultimoPago = pagos[0];

  // El consumo de los últimos 6 meses con lectura, sumando sus arranques.
  const porPeriodo = new Map<string, number>();
  for (const b of lista) if (b.estado !== "ANULADA" && b.consumoM3 !== null) porPeriodo.set(b.periodo, (porPeriodo.get(b.periodo) ?? 0) + b.consumoM3);
  const serie = [...porPeriodo.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([periodo, v]) => ({ periodo, m: corto(periodo), v }));
  const actual = serie.at(-1);
  const anteriores = serie.slice(0, -1);
  const promedio = anteriores.length ? Math.round(anteriores.reduce((s, c) => s + c.v, 0) / anteriores.length) : null;
  const max = Math.max(1, ...serie.map((c) => c.v));

  const avisos: AvisoSocio[] = comunicados.map((c) => {
    const d = DIA.format(c.createdAt);
    return {
      id: c.id,
      titulo: c.titulo,
      mensaje: c.mensaje,
      cuando: d === hoy ? "Hoy" : d === DIA.format(new Date(ahora - 86_400_000)) ? "Ayer" : dm(c.createdAt),
      nuevo: ahora - c.createdAt.getTime() < 3 * 86_400_000,
    };
  });
  const hayNuevos = avisos.some((a) => a.nuevo);

  const nombre = socio.nombre.trim().split(/\s+/)[0] ?? socio.nombre;
  const primerNombre = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
  const arranque = variasCuentas ? `${cuentas.length} arranques` : socio.numeroCliente ? `Arranque N° ${socio.numeroCliente}` : null;
  const recientes = lista.filter((b) => b.estado !== "ANULADA").slice(0, 4);
  const fechaPago = (b: (typeof lista)[number]) => {
    const p = pagos.find((x) => x.periodo === b.periodo && x.socioNombre === b.socio.nombre);
    return p ? `Pagada el ${dm(p.fecha)}` : "Pagada";
  };

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={cn("text-[13px] font-medium", GRIS)}>
            {mayus(FECHA_LARGA.format(new Date(ahora)).replace(",", ""))}
            {arranque && <span className="hidden sm:inline"> · {arranque}</span>}
          </p>
          <h1 className="mt-0.5 text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">Hola, {primerNombre}</h1>
        </div>
        <Link href="#avisos" aria-label="Avisos del comité" className="relative hidden size-10 items-center justify-center rounded-xl border border-[#E4E1F0] bg-white hover:bg-[#F8F7FC] lg:inline-flex">
          <Bell className="size-[18px]" />
          {hayNuevos && <span aria-label="Hay avisos nuevos" className="absolute top-2 right-2 size-2 rounded-full bg-[#E5484D] ring-2 ring-white" />}
        </Link>
      </div>

      <InstalarApp />

      {cortados.length > 0 && (
        <section className="mt-4 rounded-2xl border border-[#F2C8C6] bg-[#FDF3F3] p-5">
          <h2 className="font-semibold text-[#A32020]">{cortados.length === 1 ? "Tu servicio está cortado" : "Tienes servicios cortados"}</h2>
          <p className="mt-1 text-[0.88rem] text-[#5B5970]">
            Cuando regularices tu situación, pide que te lo repongan desde{" "}
            <Link href={`${base}/solicitudes`} className="font-medium text-[#2A07A8] hover:underline">
              Solicitudes
            </Link>
            .
          </p>
        </section>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Saldo */}
        <section data-tour="soc-saldo" className="relative overflow-hidden rounded-2xl bg-[#2A0FB0] p-6 text-white shadow-[0_16px_40px_rgba(42,15,176,0.28)] sm:p-7">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_80%_90%_at_100%_0%,#5B3CF0_0%,transparent_60%),radial-gradient(ellipse_60%_70%_at_0%_100%,#1C0A86_0%,transparent_70%)]" />
          <div aria-hidden className="absolute -top-14 -right-14 size-56 rounded-full border border-white/10" />
          <div aria-hidden className="absolute top-12 -right-2 size-36 rounded-full border border-white/10" />
          <div className="relative">
            {deuda > 0 && pendiente ? (
              <>
                <p className="text-sm text-white/75">Saldo a pagar</p>
                <p className="mt-2 text-[44px] leading-none font-semibold tracking-tight tabular-nums">{clp.format(deuda)}</p>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium ring-1 ring-white/20 ring-inset">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Boleta de {mesDe(pendiente.periodo)} · {cuando} ({dm(pendiente.fechaVencimiento)})
                </p>
                {porPagar.length > 1 && <p className="mt-2 text-xs text-white/70">Tienes {porPagar.length} boletas por pagar.</p>}
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {pagoEnLinea && <BotonPagarPortal slug={slug} boletaId={pendiente.id} monto={clp.format(saldo(pendiente.montoTotal, pendiente.montoPagado))} variante="hero" />}
                  <Link href={`${base}/recibo/${pendiente.id}`} className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white hover:bg-white/10">
                    <FileText className="size-4" />
                    Ver boleta
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm text-white/75">
                  <CheckCircle2 className="size-4 text-[#7CF0C4]" aria-hidden />
                  Estás al día
                </p>
                <p className="mt-2 text-[44px] leading-none font-semibold tracking-tight">$0</p>
                <p className="mt-3 text-sm text-white/75">No tienes boletas pendientes. Te avisaremos cuando llegue la próxima.</p>
              </>
            )}
          </div>
          <dl className="relative mt-6 grid grid-cols-2 divide-x divide-white/15 rounded-xl bg-white/[0.08] py-3 ring-1 ring-white/10 ring-inset">
            <div className="px-4">
              <dt className="text-xs text-white/65">Pagado en {anio}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{clp.format(pagadoAnio)}</dd>
            </div>
            <div className="px-4">
              <dt className="text-xs text-white/65">Último pago</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{ultimoPago ? `${dm(ultimoPago.fecha)} · ${clp.format(ultimoPago.monto)}` : "Sin pagos aún"}</dd>
            </div>
          </dl>
        </section>

        {/* Consumo */}
        <section data-tour="soc-consumo" className={cn("flex flex-col rounded-2xl bg-card p-6", SOMBRA)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold">Tu consumo</p>
              <p className={cn("text-[13px]", GRIS)}>Últimos 6 meses</p>
            </div>
            <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-[#E3F3FD] text-[#0B6FB0]">
              <Droplets className="size-[18px]" />
            </span>
          </div>
          {actual ? (
            <>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-[32px] leading-none font-semibold tabular-nums">{actual.v} m³</span>
                <span className={cn("text-sm", GRIS)}>en {mesDe(actual.periodo)}</span>
              </p>
              {promedio !== null && (
                <p className={cn("mt-1.5 text-xs", GRIS)}>
                  {actual.v === promedio ? (
                    <span className="font-semibold text-[#075A3C]">Igual</span>
                  ) : actual.v > promedio ? (
                    <span className="font-semibold text-[#8A4B00]">{actual.v - promedio} m³ más</span>
                  ) : (
                    <span className="font-semibold text-[#075A3C]">{promedio - actual.v} m³ menos</span>
                  )}{" "}
                  que tu promedio ({promedio} m³)
                </p>
              )}
              <div className="mt-auto pt-5">
                <ul className="flex h-[96px] items-end gap-2" role="img" aria-label={serie.map((c) => `${c.m} ${c.v} m³`).join(", ")}>
                  {serie.map((c, i) => (
                    <li key={c.periodo} className="group relative flex h-full flex-1 flex-col justify-end">
                      <span className={cn("block rounded-t-md", i === serie.length - 1 ? "bg-gradient-to-t from-[#0B6FB0] to-[#2BA8EE]" : "bg-[#CDE9FA]")} style={{ height: `${Math.max((c.v / max) * 100, 4)}%` }} />
                      <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded-md bg-[#15132B] px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white group-hover:block">{c.v} m³</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  {serie.map((c, i) => (
                    <span key={c.periodo} className={cn("flex-1 text-center text-[11px]", i === serie.length - 1 ? "font-semibold text-[#15132B]" : GRIS)}>
                      {c.m}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-6 rounded-xl bg-[#F8F7FC] p-4 text-sm text-[#5B5970]">Aún no hay consumo registrado. Aparecerá aquí cuando el comité tome la primera lectura.</p>
          )}
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Boletas */}
        <section data-tour="soc-boletas" className={cn("overflow-hidden rounded-2xl bg-card", SOMBRA)}>
          <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
            <p className="text-[15px] font-semibold">Tus boletas</p>
            <Link href={`${base}/boletas`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2A07A8] hover:underline">
              Ver todas
            </Link>
          </div>
          {recientes.length ? (
            <ul className="divide-y divide-[#F3F1F8] border-t border-[#F3F1F8]">
              {recientes.map((b) => {
                const pend = estaPorPagar(b) && saldo(b.montoTotal, b.montoPagado) > 0;
                const abono = b.montoPagado > 0 && b.montoPagado < b.montoTotal;
                return (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
                    <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", pend ? "bg-[#FFF3E0] text-[#B86400]" : "bg-[#F1EEFD] text-[#3A0CE3]")}>
                      <FileText className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {formatearPeriodo(b.periodo)}
                        {variasCuentas && <span className={cn("font-normal", GRIS)}> · {b.socio.nombre}</span>}
                      </p>
                      <p className={cn("truncate text-xs", pend ? "font-medium text-[#8A4B00]" : GRIS)}>
                        {b.consumoM3 !== null ? `${b.consumoM3} m³ · ` : ""}
                        {pend ? (abono ? `Abonaste ${clp.format(b.montoPagado)} · quedan ${clp.format(saldo(b.montoTotal, b.montoPagado))}` : b.fechaVencimiento.getTime() < ahora ? `Venció el ${dm(b.fechaVencimiento)}` : `Vence el ${dm(b.fechaVencimiento)}`) : fechaPago(b)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{clp.format(b.montoTotal)}</p>
                      <p className={cn("text-xs font-semibold", pend ? (b.estado === "VENCIDA" ? "text-[#A32020]" : "text-[#8A4B00]") : "text-[#075A3C]")}>{pend ? (b.estado === "VENCIDA" ? "Vencida" : "Pendiente") : "Pagada"}</p>
                    </div>
                    {pend && pagoEnLinea ? (
                      <BotonPagarPortal slug={slug} boletaId={b.id} monto={clp.format(saldo(b.montoTotal, b.montoPagado))} variante="fila" />
                    ) : null}
                    <Link href={`${base}/recibo/${b.id}`} aria-label={`Ver el recibo de ${formatearPeriodo(b.periodo)}`} title="Ver recibo" className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]", pend && pagoEnLinea && "sm:hidden")}>
                      <Download className="size-4" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="border-t border-[#F3F1F8] px-6 py-12 text-center">
              <FileText className="mx-auto size-8 text-[#B4B2C4]" aria-hidden />
              <p className="mt-2 font-semibold">Todavía no tienes boletas</p>
              <p className={cn("mt-1 text-sm", GRIS)}>Aparecerán aquí apenas el comité emita la primera.</p>
            </div>
          )}
        </section>

        <AvisosSocio avisos={avisos} />
      </div>
    </>
  );
}
