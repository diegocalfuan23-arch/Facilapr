"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  CalendarCheck2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Equal,
  FileText,
  Landmark,
  Lock,
  Minus,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { eliminarMovimiento } from "@/app/panel/finanzas/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoriasCajaDialog } from "@/components/panel/categorias-caja-dialog";
import { CerrarCajaDialog } from "@/components/panel/cerrar-caja-dialog";
import { NuevoMovimientoDialog } from "@/components/panel/nuevo-movimiento-dialog";
import { SaldoInicialDialog } from "@/components/panel/saldo-inicial-dialog";
import {
  textoCategoria,
  textoMedioLinea,
  type CategoriaMovimientoPropia,
  type LineaLibro,
  type ResumenMes,
  type ResumenPeriodo,
} from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";
import { useConfirmar } from "@/components/ui/confirmar";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

/** Planilla con punto y coma, la que abre bien el Excel en español. */
function descargarCsv(lineas: LineaLibro[], nombre: string, propias: CategoriaMovimientoPropia[]) {
  const celda = (t: string | number | null) => `"${String(t ?? "").replace(/"/g, '""')}"`;
  const filas = [
    ["fecha", "tipo", "categoria", "concepto", "contraparte", "medio", "referencia", "ingreso", "egreso"],
    ...[...lineas]
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map((l) => [
        l.fecha,
        l.tipo === "INGRESO" ? "Ingreso" : "Egreso",
        textoCategoria(l.categoria, propias),
        l.concepto,
        l.contraparte,
        textoMedioLinea(l.medio),
        l.referencia,
        l.tipo === "INGRESO" ? l.monto : "",
        l.tipo === "EGRESO" ? l.monto : "",
      ]),
  ];
  const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `caja-${nombre}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Los controles de la Caja son más grandes que los del resto del panel (44 px). */
const alto = "h-11";

function Kpi({
  label,
  valor,
  icono: Icono,
  tono,
  fondo,
  texto,
  nota,
}: {
  label: string;
  valor: React.ReactNode;
  icono: LucideIcon;
  tono: string;
  fondo?: string;
  texto?: string;
  nota?: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-4 rounded-2xl border p-4 shadow-[0_8px_24px_rgba(58,12,227,0.1)]", fondo ?? "border-border bg-card")}>
      <span aria-hidden className={cn("hidden size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm xl:flex", tono)}>
        <Icono className="size-5" />
      </span>
      <div className="min-w-0">
        <p className={cn("text-[0.8rem] leading-tight font-medium", texto ?? "text-muted-foreground")}>{label}</p>
        <p className={cn("mt-1 text-xl leading-tight font-bold tracking-tight tabular-nums sm:text-2xl", texto)}>{valor}</p>
        {nota}
      </div>
    </div>
  );
}

/** El signo entre dos números del resumen (+, −, =): solo en pantallas anchas. */
function Operador({ icono: Icono }: { icono: LucideIcon }) {
  return (
    <span aria-hidden className="hidden size-8 items-center justify-center self-center rounded-full bg-card text-primary shadow-sm lg:flex">
      <Icono className="size-4" />
    </span>
  );
}

function InsigniaTipo({ tipo }: { tipo: "INGRESO" | "EGRESO" }) {
  const egreso = tipo === "EGRESO";
  const Icono = egreso ? ArrowUpRight : ArrowDownLeft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.8rem] font-semibold",
        egreso ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
      )}
    >
      <Icono className="size-3.5" aria-hidden />
      {egreso ? "Egreso" : "Ingreso"}
    </span>
  );
}

/** Un selector con la flecha a la derecha. */
function Selector({
  valor,
  onCambiar,
  etiqueta,
  children,
}: {
  valor: string;
  onCambiar: (v: string) => void;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative sm:w-48">
      <select
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        aria-label={etiqueta}
        className={cn(
          alto,
          "w-full appearance-none rounded-full border border-input bg-transparent pr-10 pl-4 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

type Props = {
  modo: "dia" | "mes";
  /** El primer día del período (AAAA-MM-DD). */
  desde: string;
  /** "Noviembre 2026" en el mes. */
  etiqueta: string;
  hrefAnterior: string;
  hrefSiguiente: string;
  /** A dónde lleva el botón que cambia entre día y mes. */
  hrefOtraVista: string;
  /** El informe imprimible del mes, para la asamblea. Solo existe en la vista mensual. */
  hrefInforme: string | null;
  resumen: ResumenPeriodo;
  lineas: LineaLibro[];
  /** Cuánto fue a cada categoría; se muestra en el mes. */
  porCategoria: ResumenMes["porCategoria"];
  /** Las categorías que creó el comité, de ingresos y de egresos. */
  categoriasPropias: CategoriaMovimientoPropia[];
  saldoInicial: { monto: number; fecha: string; banco: number } | null;
};

/**
 * La Caja del comité, igual que la de MecánicoApp: navegador de día, cierre de caja,
 * cuatro números (disponible anterior, ingresos, egresos y disponible), búsqueda con
 * filtros y la tabla. Además se puede pasar a ver el mes entero. Los pagos de socios
 * entran solos; el resto se anota a mano.
 */
/** Un egreso que nació en otro módulo (Compras, Personal, Incidentes): se maneja desde ahí, no se borra desde la Caja. */
function moduloDe(l: { automatico: boolean; categoria: string; concepto: string }): string | null {
  if (l.automatico) return null;
  if (l.categoria === "COMPRAS" && /^Compra C-\d+/.test(l.concepto)) return "Compra";
  if (l.categoria === "REMUNERACIONES" && l.concepto.startsWith("Remuneración · ")) return "Remuneración";
  if (l.categoria === "REPARACIONES" && l.concepto.startsWith("Incidente I-")) return "Incidente";
  if (l.categoria === "ACTIVOS" && l.concepto.startsWith("Activo fijo · ")) return "Activo fijo";
  if (l.categoria === "REMUNERACIONES" && /^(Anticipo|Préstamo) · /.test(l.concepto)) return "Préstamo";
  return null;
}
const deCompra = (l: { automatico: boolean; categoria: string; concepto: string }) => moduloDe(l) !== null;

export function CajaVista({
  modo,
  desde,
  etiqueta,
  hrefAnterior,
  hrefSiguiente,
  hrefOtraVista,
  hrefInforme,
  resumen,
  lineas,
  porCategoria,
  categoriasPropias,
  saldoInicial,
}: Props) {
  const { confirmar, dialogo } = useConfirmar();
  const router = useRouter();
  const [, navegar] = useTransition();
  const [borrando, iniciar] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroOrigen, setFiltroOrigen] = useState("todos");
  const [registrando, setRegistrando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [definiendoSaldo, setDefiniendoSaldo] = useState(false);
  const [gestionandoCategorias, setGestionandoCategorias] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const cerrarCategorias = useCallback(() => setGestionandoCategorias(false), []);
  const cerrarRegistro = useCallback(() => setRegistrando(false), []);
  const cerrarCierre = useCallback(() => setCerrando(false), []);
  const cerrarSaldo = useCallback(() => setDefiniendoSaldo(false), []);

  async function borrar(l: LineaLibro) {
    if (!(await confirmar({ titulo: `¿Borrar «${l.concepto}»?`, descripcion: "No se puede deshacer.", boton: "Borrar" }))) return;
    iniciar(async () => {
      const r = await eliminarMovimiento(l.id.replace("mov:", ""));
      if (r.ok) toast.success("Movimiento borrado");
      else toast.error(r.error);
    });
  }

  const q = busqueda.trim().toLowerCase();
  const filtradas = lineas.filter((l) => {
    if (filtroTipo !== "todos" && l.tipo !== filtroTipo) return false;
    if (filtroOrigen === "pago" && !l.automatico) return false;
    if (filtroOrigen === "manual" && (l.automatico || deCompra(l))) return false;
    if (filtroOrigen === "compra" && moduloDe(l) !== "Compra") return false;
    if (
      q &&
      !l.concepto.toLowerCase().includes(q) &&
      !l.referencia?.toLowerCase().includes(q) &&
      !l.contraparte?.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  const esDia = modo === "dia";
  const cerrada = resumen.cierre !== null;
  const ingresos = porCategoria.filter((c) => c.tipo === "INGRESO");
  const egresos = porCategoria.filter((c) => c.tipo === "EGRESO");
  const botonNavegar = "flex size-9 items-center justify-center rounded-full hover:bg-muted";
  const filtrosActivos = (filtroTipo !== "todos" ? 1 : 0) + (filtroOrigen !== "todos" ? 1 : 0);
  const puedeBorrar = (l: LineaLibro) => !l.automatico && !deCompra(l);
  const firmado = (l: LineaLibro) => (l.tipo === "INGRESO" ? l.monto : -l.monto);
  const totalVisible = filtradas.reduce((t, l) => t + firmado(l), 0);
  const botonBorrar = (l: LineaLibro) =>
    puedeBorrar(l) && (
      <Button variant="ghost" size="icon-sm" aria-label="Borrar movimiento" disabled={borrando || (esDia && cerrada)} onClick={() => borrar(l)} className="text-muted-foreground">
        <Trash2 />
      </Button>
    );
  const botonRegistrar = (extra: string) => (
    <Button
      className={cn(alto, "rounded-full px-5 text-[0.95rem] font-semibold shadow-md shadow-primary/30", extra)}
      onClick={() => setRegistrando(true)}
      disabled={esDia && cerrada}
      title={esDia && cerrada ? "La caja de este día está cerrada. Reábrela para anotar movimientos." : undefined}
    >
      <Plus aria-hidden />
      Registrar movimiento
    </Button>
  );
  const textoSaldo = saldoInicial ? clp.format(saldoInicial.monto) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center rounded-full border border-border bg-card p-1">
            <Link href={hrefAnterior} aria-label="Anterior" className={botonNavegar}>
              <ChevronLeft className="size-4" />
            </Link>
            {esDia ? (
              <Input
                type="date"
                value={desde}
                onChange={(e) => e.target.value && navegar(() => router.push(`/panel/caja?vista=dia&dia=${e.target.value}`))}
                className="h-9 w-40 border-0 bg-transparent px-2 text-[0.95rem] font-semibold shadow-none focus-visible:ring-0"
                aria-label="Día"
              />
            ) : (
              <span className="flex h-9 min-w-40 items-center justify-center px-2 text-[0.95rem] font-semibold capitalize">{etiqueta}</span>
            )}
            <Link href={hrefSiguiente} aria-label="Siguiente" className={botonNavegar}>
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <Link href={hrefOtraVista} className="flex items-center gap-2 text-[0.9rem] font-semibold text-primary underline-offset-4 hover:underline">
            <CalendarCheck2 className="size-4" aria-hidden />
            {esDia ? "Ver el mes" : "Ver por día"}
          </Link>
        </div>

        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <Button
            variant="outline"
            className={cn(alto, "rounded-full px-4 text-[0.9rem] font-semibold", !saldoInicial && "border-dashed")}
            onClick={() => setDefiniendoSaldo(true)}
            title={saldoInicial ? "Ver o cambiar el saldo inicial" : "Definir con cuánta plata partes"}
          >
            <PiggyBank />
            {textoSaldo ? (
              <>
                Saldo inicial <span className="font-bold tabular-nums">{textoSaldo}</span>
              </>
            ) : (
              "Definir saldo inicial"
            )}
          </Button>
          {resumen.bolsillos && (
            <Link
              href="/panel/giros"
              className={cn(buttonVariants({ variant: "outline" }), alto, "rounded-full px-4 text-[0.9rem] font-semibold")}
              title="Sacar plata del banco o depositar efectivo"
            >
              <ArrowLeftRight />
              Giros
            </Link>
          )}
          {esDia && (
            <Button variant="outline" className={cn(alto, "rounded-full px-4 text-[0.9rem] font-semibold")} onClick={() => setCerrando(true)}>
              <Lock />
              {cerrada ? "Caja cerrada" : "Cerrar caja"}
            </Button>
          )}
          {botonRegistrar("")}
        </div>

        <div className="sm:hidden">
          <div className="flex items-center gap-2">
            {botonRegistrar("h-12 flex-1")}
            <Button
              variant="outline"
              size="icon"
              aria-label="Más acciones"
              aria-expanded={masAbierto}
              onClick={() => setMasAbierto((v) => !v)}
              className="size-12 shrink-0 rounded-full bg-card"
            >
              <MoreHorizontal />
            </Button>
          </div>
          {masAbierto && (
            <div className="mt-2 overflow-hidden rounded-2xl bg-card shadow-[0_8px_24px_rgba(58,12,227,0.1)]">
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-4 px-4 text-left text-sm font-semibold"
                onClick={() => {
                  setMasAbierto(false);
                  setDefiniendoSaldo(true);
                }}
              >
                <PiggyBank className="size-4" aria-hidden />
                {textoSaldo ? "Saldo inicial" : "Definir saldo inicial"}
                {textoSaldo && <span className="ml-auto font-bold tabular-nums">{textoSaldo}</span>}
              </button>
              {resumen.bolsillos && (
                <Link href="/panel/giros" className="flex min-h-12 w-full items-center gap-4 border-t border-border px-4 text-left text-sm font-semibold">
                  <ArrowLeftRight className="size-4" aria-hidden />
                  Giros
                </Link>
              )}
              {esDia && (
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center gap-4 border-t border-border px-4 text-left text-sm font-semibold"
                  onClick={() => {
                    setMasAbierto(false);
                    setCerrando(true);
                  }}
                >
                  <Lock className="size-4" aria-hidden />
                  {cerrada ? "Caja cerrada" : "Cerrar caja"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* El saldo inicial se ve y se cambia en un solo lugar: el botón de arriba. Aquí solo se explica el guion. */}
      {resumen.disponibleAnterior === null && (
        <p className="text-[0.85rem] text-muted-foreground">
          {saldoInicial
            ? `Antes del ${fechaCorta(saldoInicial.fecha)} (la fecha de tu saldo inicial) no se sabe con cuánta plata partías, así que no hay disponible.`
            : "Define el saldo inicial para ver el disponible."}
        </p>
      )}

      <section aria-label="Resumen" className="grid grid-cols-2 items-stretch gap-2 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Kpi
          label="Disponible anterior"
          valor={resumen.disponibleAnterior === null ? <span className="text-muted-foreground/50">—</span> : clp.format(resumen.disponibleAnterior)}
          icono={Wallet}
          tono="from-[#3A0CE3] to-[#6B46F5]"
        />
        <Operador icono={Plus} />
        <Kpi
          label="Total ingresos"
          valor={clp.format(resumen.ingresos)}
          icono={ArrowDownLeft}
          tono="from-emerald-500 to-emerald-700"
          fondo="border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
          texto="text-emerald-700 dark:text-emerald-400"
        />
        <Operador icono={Minus} />
        <Kpi
          label="Total egresos"
          valor={clp.format(resumen.egresos)}
          icono={ArrowUpRight}
          tono="from-red-500 to-red-700"
          fondo="border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
          texto="text-red-700 dark:text-red-400"
        />
        <Operador icono={Equal} />
        <Kpi
          label={esDia ? "Disponible del día" : "Disponible al cierre"}
          valor={resumen.disponible === null ? <span className="text-muted-foreground/50">—</span> : clp.format(resumen.disponible)}
          icono={Landmark}
          tono="from-sky-500 to-sky-700"
          texto="text-primary"
          nota={
            <>
              {cerrada && resumen.cierre && (
                <p className="mt-1 text-[0.8rem] text-muted-foreground">
                  Cerrada{resumen.cierre.cerradoPor ? ` por ${resumen.cierre.cerradoPor}` : ""}
                </p>
              )}
              {/* Si después de cerrar entró algo (un pago de socio), el cierre y el total ya no coinciden. */}
              {cerrada && resumen.cierre && resumen.disponible !== null && resumen.disponible !== resumen.cierre.disponible && (
                <button type="button" onClick={() => setCerrando(true)} className="mt-1 text-left text-[0.8rem] font-medium text-red-600 hover:underline dark:text-red-400">
                  Cambió desde el cierre ({clp.format(resumen.cierre.disponible)}). Ver
                </button>
              )}
            </>
          }
        />
      </section>

      {/* Dónde está la plata: en efectivo o en el banco. Los giros y depósitos la mueven de uno a otro. */}
      {resumen.bolsillos && (
        <section aria-label="Efectivo y banco" className="grid gap-2 sm:gap-4 md:grid-cols-2">
          {[
            { titulo: "En efectivo", icono: Banknote, valor: resumen.bolsillos.efectivo, antes: resumen.bolsillosAnterior?.efectivo ?? null, icono_c: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", barra: "bg-amber-500" },
            { titulo: "En el banco", icono: Landmark, valor: resumen.bolsillos.banco, antes: resumen.bolsillosAnterior?.banco ?? null, icono_c: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", barra: "bg-sky-500" },
          ].map((b) => {
            const cambio = b.antes === null ? 0 : b.valor - b.antes;
            const pct = resumen.disponible && resumen.disponible > 0 ? Math.max(0, Math.min(100, Math.round((b.valor / resumen.disponible) * 100))) : null;
            return (
              <div key={b.titulo} className="rounded-2xl bg-card p-4 shadow-[0_8px_24px_rgba(58,12,227,0.1)]">
                <div className="flex items-center gap-4">
                  <span aria-hidden className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", b.icono_c)}>
                    <b.icono className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8rem] font-medium text-muted-foreground">{b.titulo}</p>
                    <p className="text-2xl leading-tight font-bold tracking-tight tabular-nums">{clp.format(b.valor)}</p>
                  </div>
                  {b.antes !== null && b.antes !== b.valor && (
                    <div className="shrink-0 text-right">
                      <p className={cn("text-sm font-bold tabular-nums", cambio < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
                        {cambio > 0 ? "+" : ""}
                        {clp.format(cambio)}
                      </p>
                      <p className="text-[0.75rem] text-muted-foreground tabular-nums">Antes {clp.format(b.antes)}</p>
                    </div>
                  )}
                </div>
                {pct !== null && (
                  <div role="img" aria-label={`${pct}% del disponible`} className="mt-4 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", b.barra)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right text-[0.75rem] font-bold text-muted-foreground tabular-nums">{pct}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {resumen.bolsillos && (resumen.bolsillos.efectivo < 0 || resumen.bolsillos.banco < 0) && (
        <p className="-mt-2 text-[0.8rem] text-amber-700 dark:text-amber-300">
          Uno de los dos saldos sale negativo: se pagó más en ese lugar de lo que había. Anota el giro o depósito que falta en Giros, o indica en «Saldo inicial» cuánto estaba en el banco.
        </p>
      )}

      {!esDia && (ingresos.length > 0 || egresos.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {[
            { titulo: "De dónde vino", filas: ingresos },
            { titulo: "A dónde fue", filas: egresos },
          ].map((bloque) => (
            <div key={bloque.titulo} className="rounded-2xl bg-card p-5 shadow-[0_8px_24px_rgba(58,12,227,0.1)]">
              <h2 className="text-[0.8rem] font-medium tracking-wide text-muted-foreground uppercase">{bloque.titulo}</h2>
              {bloque.filas.length === 0 ? (
                <p className="mt-4 text-[0.9rem] text-muted-foreground">Nada este mes.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {bloque.filas.map((c) => (
                    <li key={`${c.tipo}${c.categoria}`} className="flex items-baseline justify-between gap-4 text-[0.95rem]">
                      <span>{c.texto}</span>
                      <span className="tabular-nums">{clp.format(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 lg:w-full lg:max-w-md">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por descripción o referencia"
              className={cn(alto, "rounded-full pr-4 pl-11 text-[0.95rem]")}
              aria-label="Buscar movimientos"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label={filtrosActivos ? `Filtros, ${filtrosActivos} activos` : "Filtros"}
            aria-expanded={filtrosAbiertos}
            onClick={() => setFiltrosAbiertos((v) => !v)}
            className="relative size-11 shrink-0 rounded-full bg-card md:hidden"
          >
            <SlidersHorizontal />
            {filtrosActivos > 0 && (
              <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[0.7rem] font-bold text-primary-foreground">{filtrosActivos}</span>
            )}
          </Button>
        </div>
        <div className={cn("flex-col gap-2 md:flex md:flex-row md:flex-wrap md:items-center", filtrosAbiertos ? "flex" : "hidden")}>
          <Selector valor={filtroTipo} onCambiar={setFiltroTipo} etiqueta="Tipo">
            <option value="todos">Todos los tipos</option>
            <option value="INGRESO">Ingresos</option>
            <option value="EGRESO">Egresos</option>
          </Selector>
          <Selector valor={filtroOrigen} onCambiar={setFiltroOrigen} etiqueta="Origen">
            <option value="todos">Todos los orígenes</option>
            <option value="pago">Pago de socio</option>
            <option value="manual">Manual</option>
            <option value="compra">Compras</option>
          </Selector>
          <div className="flex items-center gap-2">
            <Button variant="outline" className={cn(alto, "flex-1 rounded-full px-4 text-[0.95rem] font-semibold md:flex-none")} onClick={() => setGestionandoCategorias(true)}>
              <Tag />
              Categorías
            </Button>
            {hrefInforme && (
              <Link href={hrefInforme} target="_blank" className={cn(buttonVariants({ variant: "outline" }), alto, "rounded-full px-4 text-[0.95rem] font-semibold")}>
                <FileText />
                Informe
              </Link>
            )}
            <Button
              variant="outline"
              size="icon"
              className={cn(alto, "w-11 rounded-full")}
              onClick={() => descargarCsv(lineas, desde, categoriasPropias)}
              disabled={lineas.length === 0}
              aria-label="Descargar en Excel"
              title="Descargar en Excel"
            >
              <Download />
            </Button>
          </div>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">Sin movimientos de caja</p>
          <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
            {lineas.length === 0
              ? "Los pagos de socios aparecerán aquí al registrarlos, y los ingresos y egresos manuales al anotarlos."
              : "Ningún movimiento coincide con la búsqueda o los filtros."}
          </p>
          {botonRegistrar("mt-6")}
        </div>
      ) : (
        <>
          <div className="scroll-fino hidden overflow-x-auto rounded-2xl bg-card shadow-[0_10px_26px_rgba(58,12,227,0.14)] md:block">
            <table className="w-full min-w-160 border-collapse text-[0.95rem]">
              <thead>
                <tr className="bg-gradient-to-r from-[#3A0CE3] to-[#6B46F5] text-primary-foreground">
                  {[...(esDia ? [] : ["Fecha"]), "Descripción", "Tipo", "Origen", "Medio", "Monto"].map((c) => (
                    <th key={c} className={cn("px-5 py-3 text-left text-[0.85rem] font-semibold whitespace-nowrap", c === "Monto" && "text-right")}>
                      {c}
                    </th>
                  ))}
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => (
                  <tr key={l.id} className="border-b border-border transition-colors last:border-0 hover:bg-primary/5">
                    {!esDia && <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{fechaCorta(l.fecha).slice(0, 5)}</td>}
                    <td className="px-5 py-4">
                      <div className="font-semibold">{l.concepto}</div>
                      {(l.contraparte || l.referencia) && (
                        <div className="text-[0.8rem] text-muted-foreground">{[l.contraparte, l.referencia ? `N.° ${l.referencia}` : null].filter(Boolean).join(" · ")}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <InsigniaTipo tipo={l.tipo} />
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{l.automatico ? "Pago de socio" : (moduloDe(l) ?? "Manual")}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{textoMedioLinea(l.medio)}</td>
                    <td className={cn("px-5 py-4 text-right font-bold whitespace-nowrap tabular-nums", l.tipo === "INGRESO" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {l.tipo === "INGRESO" ? "+" : "-"}
                      {clp.format(l.monto)}
                    </td>
                    <td className="px-2 py-4">{botonBorrar(l)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/50">
                  <td colSpan={esDia ? 4 : 5} className="px-5 py-3 text-sm font-semibold text-muted-foreground">
                    {filtradas.length} movimiento{filtradas.length === 1 ? "" : "s"}
                  </td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums">{clp.format(totalVisible)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            {filtradas.map((l) => (
              <div key={l.id} className="rounded-2xl bg-card p-4 shadow-[0_8px_24px_rgba(58,12,227,0.1)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="leading-snug font-semibold">{l.concepto}</p>
                    {(l.contraparte || l.referencia) && (
                      <p className="text-[0.8rem] text-muted-foreground">{[l.contraparte, l.referencia ? `N.° ${l.referencia}` : null].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                  <p className={cn("shrink-0 font-bold tabular-nums", l.tipo === "INGRESO" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {l.tipo === "INGRESO" ? "+" : "-"}
                    {clp.format(l.monto)}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-muted-foreground">
                  <InsigniaTipo tipo={l.tipo} />
                  {!esDia && <span className="tabular-nums">{fechaCorta(l.fecha).slice(0, 5)}</span>}
                  <span>{l.automatico ? "Pago de socio" : (moduloDe(l) ?? "Manual")}</span>
                  <span>{textoMedioLinea(l.medio)}</span>
                  <span className="ml-auto">{botonBorrar(l)}</span>
                </div>
              </div>
            ))}
            <p className="flex justify-between px-1 pt-2 text-sm font-semibold">
              <span>
                {filtradas.length} movimiento{filtradas.length === 1 ? "" : "s"}
              </span>
              <span className="tabular-nums">{clp.format(totalVisible)}</span>
            </p>
          </div>
        </>
      )}

      {registrando && (
        <NuevoMovimientoDialog
          tipoInicial="EGRESO"
          fecha={esDia ? desde : undefined}
          categoriasPropias={categoriasPropias}
          onCerrar={cerrarRegistro}
        />
      )}
      {dialogo}
      {gestionandoCategorias && <CategoriasCajaDialog propias={categoriasPropias} onCerrar={cerrarCategorias} />}
      {cerrando && (
        <CerrarCajaDialog
          resumen={resumen}
          movimientos={lineas.length}
          saldoInicial={saldoInicial}
          onDefinirSaldo={() => {
            setCerrando(false);
            setDefiniendoSaldo(true);
          }}
          onCerrar={cerrarCierre}
        />
      )}
      {definiendoSaldo && <SaldoInicialDialog actual={saldoInicial} onCerrar={cerrarSaldo} />}
    </div>
  );
}
