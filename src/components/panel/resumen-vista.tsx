"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, Boxes, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, Droplets, FileText, FlaskConical, Gauge, Plus, Send, UserCheck, UserRoundX, Users, type LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComunicadoDialog } from "@/components/panel/comunicado-dialog";
import { Anillo, GraficoConsumo, GraficoRecaudacion, MiniSaldo } from "@/components/panel/resumen-graficos";
import type { DatosResumen } from "@/lib/resumen-comun";
import { cn } from "@/lib/utils";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const clp = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("es-CL");
const numero = (n: number) => n.toLocaleString("es-CL");
const iniciales = (s: string) =>
  s
    .split(" ")
    .filter((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

function Encabezado({ titulo, sub, accion }: { titulo: string; sub?: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {sub ? <p className={cn("mt-0.5 text-[13px]", GRIS)}>{sub}</p> : null}
      </div>
      {accion}
    </div>
  );
}

function Enlace({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-md text-[13px] font-semibold text-[#2A07A8] hover:underline">
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/** Los dos gráficos comparten lugar en el celular: este selector cambia de uno a otro. */
function Selector({ graf, setGraf }: { graf: string; setGraf: (g: "recaudacion" | "consumo") => void }) {
  return (
    <div role="tablist" aria-label="Gráfico" className="mb-4 -mt-1 grid grid-cols-2 gap-1 rounded-lg bg-[#F4F3F9] p-1 lg:hidden">
      {(
        [
          ["recaudacion", "Recaudación"],
          ["consumo", "Consumo"],
        ] as const
      ).map(([k, t]) => (
        <button key={k} type="button" role="tab" aria-selected={graf === k} onClick={() => setGraf(k)} className={cn("h-8 rounded-md text-[13px] font-semibold", graf === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}>
          {t}
        </button>
      ))}
    </div>
  );
}

/** El Resumen del panel: lo cobrado, la caja, los indicadores del padrón, lo que pide acción y la evolución de los últimos meses. */
export function ResumenVista({ d }: { d: DatosResumen }) {
  const router = useRouter();
  const [graf, setGraf] = useState<"recaudacion" | "consumo">("recaudacion");
  const [comunicando, setComunicando] = useState(false);
  const h = d.hero;
  const pendientes = d.atencion.filter((a) => a.n > 0);
  const alDia = d.atencion.filter((a) => a.n === 0);
  const mesDelPeriodo = d.periodo.opciones.find((o) => o.valor === d.periodo.valor)?.texto ?? "";

  const kpis: { icono: LucideIcon; titulo: string; valor: string; sub: React.ReactNode; tono: string; href: string }[] = [
    {
      icono: Users,
      titulo: "Socios",
      valor: numero(d.kpis.socios.total),
      sub: d.kpis.socios.nuevos > 0 ? (
        <>
          <span className="font-semibold text-[#075A3C]">+{d.kpis.socios.nuevos}</span> {d.kpis.socios.textoNuevos}
        </>
      ) : (
        "Sin socios nuevos"
      ),
      tono: "bg-[#ECE8FD] text-[#3A0CE3]",
      href: "/panel/socios",
    },
    {
      icono: UserRoundX,
      titulo: "Morosos",
      valor: numero(d.kpis.morosos.n),
      sub: (
        <>
          <span className={cn("font-semibold", d.kpis.morosos.n > 0 ? "text-[#A32020]" : "text-[#075A3C]")}>{d.kpis.morosos.pct}%</span> de los socios
        </>
      ),
      tono: d.kpis.morosos.n > 0 ? "bg-[#FDECEC] text-[#A32020]" : "bg-[#E6F6EF] text-[#0A7A52]",
      href: "/panel/boletas",
    },
    {
      icono: Droplets,
      titulo: d.kpis.consumo.titulo,
      valor: `${numero(d.kpis.consumo.m3)} m³`,
      sub: <>{d.kpis.consumo.porSocio.toLocaleString("es-CL")} m³ por socio</>,
      tono: "bg-[#E3F3FD] text-[#0B6FB0]",
      href: "/panel/lecturas",
    },
    {
      icono: Gauge,
      titulo: "Lecturas",
      valor: `${numero(d.kpis.lecturas.hechas)} de ${numero(d.kpis.lecturas.total)}`,
      sub: (
        <div role="img" aria-label={`${d.kpis.lecturas.hechas} de ${d.kpis.lecturas.total} lecturas`} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEEBF7]">
          <div className="h-full rounded-full bg-[#F0A23C]" style={{ width: `${d.kpis.lecturas.total > 0 ? Math.min(100, (d.kpis.lecturas.hechas / d.kpis.lecturas.total) * 100) : 0}%` }} />
        </div>
      ),
      tono: "bg-[#FFF3E0] text-[#B86400]",
      href: "/panel/lecturas",
    },
  ];

  return (
    <div>
      {d.demo && (
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-tertiary/40 bg-tertiary/10 px-4 py-3">
          <FlaskConical className="size-4 shrink-0 text-tertiary-texto" />
          <p className="flex-1 text-[0.88rem] leading-relaxed">
            <strong>Vista de demostración.</strong> Ninguna de estas cifras es de tu comité: son datos inventados para ver cómo se verá el panel.
          </p>
          <Link href="/panel" className="text-[0.85rem] font-medium text-primary hover:underline">
            Salir de la demo
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className={cn("text-[13px] font-medium", GRIS)}>{d.fecha}</p>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{d.saludo}</h1>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex">
          <Select value={d.periodo.valor} onValueChange={(v) => router.push(`/panel?mes=${v as string}${d.demo ? "&demo=1" : ""}`)}>
            <SelectTrigger aria-label="Período" data-tour="res-periodo" className="h-10 w-full rounded-lg border-[#E4E1F0] bg-white px-3 font-semibold sm:w-[190px]">
              <SelectValue>{() => mesDelPeriodo}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {d.periodo.opciones.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.texto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* En la demostración no se publica nada: los comunicados son de verdad y los verían los socios. */}
          {!d.demo && (
            <Button variant="outline" className="h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold" onClick={() => setComunicando(true)}>
              <Send className="size-4" />
              Comunicado
            </Button>
          )}
          <Link href={d.rutas.pagos} className={cn(buttonVariants(), "h-10 rounded-lg px-4 font-semibold")}>
            <Plus />
            Registrar pago
          </Link>
        </div>
      </div>

      {/* Fila 1: lo cobrado y la caja. */}
      <div className={cn("mt-5 grid grid-cols-1 gap-4", d.caja && "lg:grid-cols-[minmax(0,1fr)_400px]")}>
        <section data-tour="res-hero" className="relative overflow-hidden rounded-2xl bg-[#2A0FB0] p-5 text-white shadow-[0_16px_40px_rgba(42,15,176,0.28)] sm:p-7">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_80%_90%_at_100%_0%,#5B3CF0_0%,transparent_60%),radial-gradient(ellipse_60%_70%_at_0%_100%,#1C0A86_0%,transparent_70%)]" />
          <div aria-hidden className="absolute -top-16 -right-16 size-64 rounded-full border border-white/10" />
          <div aria-hidden className="absolute top-10 -right-4 size-40 rounded-full border border-white/10" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-white/75">{h.titulo}</p>
                {h.vencenEn !== null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/20 ring-inset">
                    <CalendarClock className="size-3" aria-hidden />
                    {h.vencenEn === 1 ? "Vencen mañana" : `Vencen en ${h.vencenEn} días`}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[34px] leading-none font-semibold tracking-tight tabular-nums sm:text-[44px]">{clp(h.recaudado)}</p>
              {h.facturado > 0 ? (
                <p className="mt-2 text-sm text-white/75">
                  de <b className="font-semibold text-white">{clp(h.facturado)}</b> facturado · {h.facturado - h.recaudado > 0 ? `faltan ${clp(h.facturado - h.recaudado)}` : "todo cobrado"}
                </p>
              ) : (
                <p className="mt-2 text-sm text-white/75">Aún no hay boletas emitidas en este período.</p>
              )}
              {h.variacion && h.variacion.pct !== 0 ? (
                <p className={cn("mt-1 hidden items-center gap-1 text-xs font-semibold sm:inline-flex", h.variacion.pct > 0 ? "text-[#9AF5D2]" : "text-[#FFC9C7]")}>
                  <ArrowUpRight className={cn("size-3.5", h.variacion.pct < 0 && "rotate-90")} aria-hidden />
                  {Math.abs(h.variacion.pct)}% {h.variacion.pct > 0 ? "más" : "menos"} que {h.variacion.contra}
                </p>
              ) : null}
            </div>
            <Anillo pct={h.pct} />
          </div>
          <dl className="relative mt-4 grid grid-cols-3 divide-x divide-white/15 rounded-xl bg-white/[0.08] py-2.5 ring-1 ring-white/10 ring-inset sm:mt-6 sm:py-3">
            {(
              [
                ["Pagadas", h.pagadas, "bg-[#7CF0C4]"],
                ["Pendientes", h.pendientes, "bg-[#FFC978]"],
                ["Vencidas", h.vencidas, "bg-[#FF9C9A]"],
              ] as const
            ).map(([t, n, c]) => (
              <div key={t} className="px-3 sm:px-5">
                <dt className="flex items-center gap-1.5 text-xs text-white/70">
                  <span aria-hidden className={cn("size-1.5 rounded-full", c)} />
                  {t}
                </dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                  {numero(n)} <span className="hidden text-xs font-normal text-white/60 sm:inline">{n === 1 ? "boleta" : "boletas"}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {d.caja && d.rutas.caja ? (
          <section className={cn("flex flex-col rounded-2xl bg-card p-5 sm:p-6", SOMBRA)}>
            <Encabezado titulo="Disponible en caja" accion={<Enlace href={d.rutas.caja}>Ver caja</Enlace>} />
            <p className="mt-2 text-[30px] leading-none font-semibold tabular-nums">{d.caja.disponible === null ? "—" : clp(d.caja.disponible)}</p>
            {d.caja.disponible === null ? (
              <p className={cn("mt-1.5 text-xs", GRIS)}>Falta el saldo inicial en Caja.</p>
            ) : (
              <p className={cn("mt-1.5 inline-flex items-center gap-1 text-xs font-semibold", d.caja.ingresos - d.caja.egresos >= 0 ? "text-[#075A3C]" : "text-[#A32020]")}>
                <ArrowUpRight className={cn("size-3.5", d.caja.ingresos - d.caja.egresos < 0 && "rotate-90")} aria-hidden />
                {d.caja.ingresos - d.caja.egresos >= 0 ? "+" : ""}
                {clp(d.caja.ingresos - d.caja.egresos)} {d.caja.etiquetaNeto}
              </p>
            )}
            <div className="mt-2 hidden sm:block">
              <MiniSaldo valores={d.caja.serie} />
            </div>
            <dl className="mt-auto grid grid-cols-2 gap-2 pt-3">
              <div className="rounded-xl bg-[#F3FBF7] px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-[11px] text-[#0A7A52]">
                  <ArrowDownLeft className="size-3.5" aria-hidden />
                  Ingresos
                </dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums">{clp(d.caja.ingresos)}</dd>
              </div>
              <div className="rounded-xl bg-[#FDF3F3] px-3 py-2.5">
                <dt className="flex items-center gap-1.5 text-[11px] text-[#A32020]">
                  <ArrowUpRight className="size-3.5" aria-hidden />
                  Egresos
                </dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums">{clp(d.caja.egresos)}</dd>
              </div>
            </dl>
          </section>
        ) : null}
      </div>

      {/* Fila 2: los indicadores del padrón. */}
      <div data-tour="res-kpis" className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const I = k.icono;
          return (
            <Link key={k.titulo} href={k.href} className={cn("rounded-2xl bg-card p-3.5 transition-shadow hover:shadow-[0_8px_24px_rgba(58,12,227,0.16)] sm:p-5", SOMBRA)}>
              <div className="flex items-center gap-2.5">
                <span aria-hidden className={cn("hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex", k.tono)}>
                  <I className="size-[18px]" />
                </span>
                <p className={cn("min-w-0 text-[13px] leading-tight", GRIS)}>{k.titulo}</p>
              </div>
              <p className="mt-1.5 text-[20px] leading-none font-semibold tabular-nums sm:mt-3 sm:text-[24px]">{k.valor}</p>
              <div className={cn("mt-1.5 truncate text-xs", GRIS)}>{k.sub}</div>
            </Link>
          );
        })}
      </div>

      {/* Fila 3: la evolución y lo que pide acción. */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className={cn("rounded-2xl bg-card p-5 sm:p-6", graf === "consumo" && "hidden lg:block", SOMBRA)}>
          <Selector graf={graf} setGraf={setGraf} />
          <Encabezado titulo="Recaudación por mes" sub={<span className="hidden sm:inline">Lo cobrado en boletas, últimos 8 meses</span>} accion={<Enlace href={d.rutas.pagos}>Ver pagos</Enlace>} />
          <GraficoRecaudacion meses={d.recaudacion.meses} valores={d.recaudacion.valores} actual={d.recaudacion.actual} />
        </section>

        <section data-tour="res-atencion" className={cn("order-first rounded-2xl bg-card p-5 sm:p-6 lg:order-none", SOMBRA)}>
          <Encabezado
            titulo="Por revisar"
            sub={<span className="hidden sm:inline">Lo que necesita tu acción</span>}
            accion={pendientes.length > 0 ? <span className="rounded-full bg-[#FFF3E0] px-2 py-0.5 text-xs font-bold text-[#8A4B00]">{pendientes.length}</span> : <CheckCircle2 className="size-4 text-[#2FB386]" aria-label="Todo al día" />}
          />
          <ul className="mt-3 -mx-2 flex flex-col">
            {d.atencion.map((a) => {
              const listo = a.n === 0;
              return (
                <li key={a.clave} className={listo ? "hidden sm:block" : ""}>
                  <Link href={a.href} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-[#F8F7FC]">
                    <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", listo ? "bg-[#F1F0F6] text-[#8A8799]" : a.tono === "alerta" ? "bg-[#FFF3E0] text-[#B86400]" : "bg-[#ECE8FD] text-[#3A0CE3]")}>
                      <IconoAtencion clave={a.clave} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm font-semibold", listo && GRIS)}>{a.titulo}</span>
                      <span className={cn("block truncate text-xs", GRIS)}>{listo ? "Nada pendiente" : a.detalle}</span>
                    </span>
                    {listo ? (
                      <CheckCircle2 className="size-4 text-[#2FB386]" aria-label="Al día" />
                    ) : (
                      <span className={cn("min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums", a.tono === "alerta" ? "bg-[#FFF3E0] text-[#8A4B00]" : "bg-[#ECE8FD] text-[#2A07A8]")}>{numero(a.n)}</span>
                    )}
                    <ChevronRight className="size-4 text-[#B4B2C4]" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          {alDia.length > 0 && pendientes.length > 0 ? (
            <p className={cn("mt-1 flex items-center gap-1.5 text-xs sm:hidden", GRIS)}>
              <CheckCircle2 className="size-3.5 text-[#2FB386]" aria-hidden />
              {alDia.map((a) => a.titulo.toLowerCase()).join(" y ")} al día
            </p>
          ) : null}
        </section>

        <section className={cn("rounded-2xl bg-card p-5 sm:p-6", graf === "recaudacion" && "hidden lg:block", SOMBRA)}>
          <Selector graf={graf} setGraf={setGraf} />
          <Encabezado titulo="Consumo de agua" sub={<span className="hidden sm:inline">Metros cúbicos según lecturas aprobadas</span>} accion={<Enlace href="/panel/lecturas">Ver lecturas</Enlace>} />
          <GraficoConsumo meses={d.consumo.meses} valores={d.consumo.valores} actual={d.consumo.actual} raro={d.consumo.raro} />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:border-t sm:border-[#F0EEF6] sm:pt-4">
            <div className="hidden gap-6 text-sm sm:flex">
              {(() => {
                const total = d.consumo.residencial + d.consumo.comercial;
                const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
                return (
                  <>
                    <div>
                      <p className={cn("text-xs", GRIS)}>Residencial</p>
                      <p className="mt-0.5 font-semibold tabular-nums">{pct(d.consumo.residencial)}%</p>
                    </div>
                    <div>
                      <p className={cn("text-xs", GRIS)}>Comercial</p>
                      <p className="mt-0.5 font-semibold tabular-nums">{pct(d.consumo.comercial)}%</p>
                    </div>
                  </>
                );
              })()}
              <div className="flex items-end gap-1.5">
                <span aria-hidden className="mb-1.5 h-[3px] w-5 bg-[repeating-linear-gradient(90deg,#CFCBE0_0_4px,transparent_4px_7px)]" />
                <span className={cn("text-xs", GRIS)}>Sin lecturas</span>
              </div>
            </div>
            {d.consumo.avisoRaro ? (
              <p className="flex items-start gap-2 rounded-lg bg-[#FFF6E8] px-3 py-2 text-xs text-[#7A4A00] sm:ml-auto sm:max-w-[330px]">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                {d.consumo.avisoRaro}
              </p>
            ) : null}
          </div>
        </section>

        <section className={cn("rounded-2xl bg-card p-5 sm:p-6", SOMBRA)}>
          <Encabezado titulo="Últimos pagos" accion={<Enlace href={d.rutas.pagos}>Ver todos</Enlace>} />
          {d.pagos.length === 0 ? (
            <p className={cn("mt-4 text-sm", GRIS)}>Todavía no hay pagos registrados.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3.5">
              {d.pagos.map((p, i) => (
                <li key={p.id} className={cn("flex items-center gap-3", i >= 2 && "max-sm:hidden")}>
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E6F6EF] text-xs font-bold text-[#075A3C]">
                    {iniciales(p.socio)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.socio}</span>
                    <span className={cn("block text-xs", GRIS)}>
                      {p.cuando} · {p.medio}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-[#075A3C] tabular-nums">+{clp(p.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Fila 4: la morosidad y quiénes pagaron en el mejor mes. */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={cn("rounded-2xl bg-card p-5 sm:p-6", SOMBRA)}>
          <Encabezado titulo="Tasa de morosidad" sub="Socios con boletas vencidas" accion={<Enlace href="/panel/boletas">Ver boletas</Enlace>} />
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className={cn("text-[30px] leading-none font-semibold tabular-nums", d.morosidad.socios > 0 && "text-[#A32020]")}>{d.morosidad.tasa.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p>
              <p className={cn("mt-1.5 text-xs", GRIS)}>
                {numero(d.morosidad.socios)} de {numero(d.morosidad.total)} socios
              </p>
            </div>
            <div className="w-36">
              <MiniSaldo valores={d.morosidad.serie} linea="#D6403D" relleno="#D6403D" />
              <p className={cn("text-center text-[11px]", GRIS)}>Boletas vencidas, 8 meses</p>
            </div>
          </div>
        </section>

        <section className={cn("rounded-2xl bg-card p-5 sm:p-6", SOMBRA)}>
          <Encabezado titulo="Quiénes pagaron" sub={d.mejorMes ? `En ${d.mejorMes.texto}, el mejor mes` : "Aún no hay pagos registrados"} />
          {d.mejorMes && d.mejorMes.pagadores.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-3">
              {d.mejorMes.pagadores.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E6F6EF] text-xs font-bold text-[#075A3C]">
                    {iniciales(s.nombre)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.nombre}</span>
                    <span className={cn("block text-xs", GRIS)}>
                      {s.boletas} {s.boletas === 1 ? "boleta" : "boletas"}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-[#075A3C] tabular-nums">{clp(s.pagado)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn("mt-4 text-sm", GRIS)}>Todavía nadie ha pagado.</p>
          )}
        </section>
      </div>

      {/* Fila 5: las boletas del período. */}
      <section className={cn("mt-4 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
        <div className="p-5 pb-4 sm:px-6 sm:pt-6">
          <Encabezado titulo="Boletas recientes" sub={d.subtituloBoletas} accion={<Enlace href="/panel/boletas">Ver todas</Enlace>} />
        </div>
        {d.boletas.length === 0 ? (
          <p className={cn("border-t border-[#F3F1F8] px-6 py-8 text-center text-sm", GRIS)}>Todavía no hay boletas emitidas en este período.</p>
        ) : (
          <>
            <div className={cn("hidden grid-cols-[minmax(0,1.6fr)_130px_100px_110px_120px_20px] gap-4 border-y border-[#F3F1F8] bg-[#FAFAFD] px-6 py-2.5 text-xs font-medium md:grid", GRIS)}>
              <span>Socio</span>
              <span>Período</span>
              <span className="text-right">Consumo</span>
              <span className="text-right">Monto</span>
              <span>Estado</span>
              <span />
            </div>
            <ul className="divide-y divide-[#F3F1F8] border-t border-[#F3F1F8] md:border-t-0">
              {d.boletas.map((b, i) => (
                <li key={b.id} className={i >= 3 ? "max-md:hidden" : ""}>
                  <Link href="/panel/boletas" className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 text-left hover:bg-[#FBFAFF] md:grid-cols-[minmax(0,1.6fr)_130px_100px_110px_120px_20px] md:px-6">
                    <span className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F1EEFD] text-xs font-bold text-[#2A07A8]">
                        {iniciales(b.socio)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{b.socio}</span>
                        <span className={cn("block text-xs md:hidden", GRIS)}>
                          {b.periodo}
                          {b.m3 !== null ? ` · ${b.m3} m³` : ""}
                        </span>
                      </span>
                    </span>
                    <span className={cn("hidden items-center gap-1.5 text-sm md:flex", GRIS)}>
                      <FileText className="size-3.5" aria-hidden />
                      {b.periodo}
                    </span>
                    <span className={cn("hidden text-right text-sm tabular-nums md:block", GRIS)}>{b.m3 !== null ? `${b.m3} m³` : "—"}</span>
                    <span className="flex flex-col items-end gap-1 md:contents">
                      <span className="text-right text-sm font-semibold tabular-nums">{clp(b.monto)}</span>
                      <span className="md:justify-self-start">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                            b.estado === "Pagada" ? "bg-[#E6F6EF] text-[#075A3C]" : b.estado === "Vencida" ? "bg-[#FDECEC] text-[#A32020]" : "bg-[#FFF3E0] text-[#8A4B00]"
                          )}
                        >
                          <span aria-hidden className={cn("size-1.5 rounded-full", b.estado === "Pagada" ? "bg-[#2FB386]" : b.estado === "Vencida" ? "bg-[#D6403D]" : "bg-[#F0A23C]")} />
                          {b.estado}
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="hidden size-4 text-[#B4B2C4] md:block" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {comunicando && <ComunicadoDialog comunicados={d.comunicados} onCerrar={() => setComunicando(false)} />}
    </div>
  );
}

/** El ícono de cada aviso de "Por revisar". */
function IconoAtencion({ clave }: { clave: string }) {
  const c = "size-[18px]";
  if (clave === "lecturas") return <ClipboardCheck className={c} />;
  if (clave === "sin-lectura") return <Droplets className={c} />;
  if (clave === "solicitudes") return <UserCheck className={c} />;
  return <Boxes className={c} />;
}
