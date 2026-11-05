"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, Download, FileText, PiggyBank, Tag, Trash2 } from "lucide-react";
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

/** Los controles de la Caja son más grandes que los del resto del panel (40 px), como en MecánicoApp. */
const alto = "h-10";
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";

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
    <div className="relative sm:w-52">
      <select
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        aria-label={etiqueta}
        className={cn(
          alto,
          "w-full appearance-none rounded-lg border border-input bg-transparent pr-10 pl-4 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
  saldoInicial: { monto: number; fecha: string } | null;
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
  const cerrarCategorias = useCallback(() => setGestionandoCategorias(false), []);
  const cerrarRegistro = useCallback(() => setRegistrando(false), []);
  const cerrarCierre = useCallback(() => setCerrando(false), []);
  const cerrarSaldo = useCallback(() => setDefiniendoSaldo(false), []);

  function borrar(l: LineaLibro) {
    if (!window.confirm(`¿Borrar «${l.concepto}»? No se puede deshacer.`)) return;
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
  const botonNavegar = cn(alto, "flex w-10 items-center justify-center rounded-xl border border-border hover:bg-muted");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={hrefAnterior} aria-label="Anterior" className={botonNavegar}>
            <ChevronLeft className="size-4" />
          </Link>
          {esDia ? (
            <Input
              type="date"
              value={desde}
              onChange={(e) => e.target.value && navegar(() => router.push(`/panel/caja?vista=dia&dia=${e.target.value}`))}
              className={cn(alto, "w-auto rounded-full px-4 text-[0.95rem]")}
              aria-label="Día"
            />
          ) : (
            <span className={cn(alto, "flex min-w-44 items-center justify-center rounded-lg border border-border px-4 text-[0.95rem] capitalize")}>
              {etiqueta}
            </span>
          )}
          <Link href={hrefSiguiente} aria-label="Siguiente" className={botonNavegar}>
            <ChevronRight className="size-4" />
          </Link>
          <Link href={hrefOtraVista} className="px-3 text-[0.85rem] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {esDia ? "Ver el mes" : "Ver por día"}
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className={cn(alto, "rounded-xl px-3 text-[0.9rem]", !saldoInicial && "border-dashed")}
            onClick={() => setDefiniendoSaldo(true)}
            title={saldoInicial ? "Ver o cambiar el saldo inicial" : "Definir con cuánta plata partes"}
          >
            <PiggyBank />
            {saldoInicial ? (
              <>
                <span className="hidden sm:inline">Saldo inicial</span>
                <span className="font-semibold tabular-nums">{clp.format(saldoInicial.monto)}</span>
              </>
            ) : (
              "Definir saldo inicial"
            )}
          </Button>
          {esDia && (
            <Button variant="outline" className={cn(alto, "px-4 text-[0.95rem]")} onClick={() => setCerrando(true)}>
              {cerrada ? "Caja cerrada" : "Cerrar caja"}
            </Button>
          )}
          <Button
            className={cn(alto, "rounded-full px-5 text-[0.95rem]")}
            onClick={() => setRegistrando(true)}
            disabled={esDia && cerrada}
            title={esDia && cerrada ? "La caja de este día está cerrada. Reábrela para anotar movimientos." : undefined}
          >
            + Registrar movimiento
          </Button>
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

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Disponible anterior</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">
            {resumen.disponibleAnterior === null ? <span className="text-muted-foreground/50">—</span> : clp.format(resumen.disponibleAnterior)}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 p-5">
          <p className={cn(etiquetaKpi, "text-emerald-700 dark:text-emerald-400")}>Total ingresos</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{clp.format(resumen.ingresos)}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 p-5">
          <p className={cn(etiquetaKpi, "text-red-600 dark:text-red-400")}>Total egresos</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums text-red-600 dark:text-red-400">{clp.format(resumen.egresos)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>{esDia ? "Disponible del día" : "Disponible al cierre"}</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">
            {resumen.disponible === null ? <span className="text-muted-foreground/50">—</span> : clp.format(resumen.disponible)}
          </p>
          {cerrada && resumen.cierre && (
            <p className="mt-2 text-[0.8rem] text-muted-foreground">
              Cerrada{resumen.cierre.cerradoPor ? ` por ${resumen.cierre.cerradoPor}` : ""}
            </p>
          )}
          {/* Si después de cerrar entró algo (un pago de socio), el cierre y el total ya no coinciden. */}
          {cerrada && resumen.cierre && resumen.disponible !== null && resumen.disponible !== resumen.cierre.disponible && (
            <button
              type="button"
              onClick={() => setCerrando(true)}
              className="mt-1 text-left text-[0.8rem] font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Cambió desde el cierre ({clp.format(resumen.cierre.disponible)}). Ver
            </button>
          )}
        </div>
      </section>

      {!esDia && (ingresos.length > 0 || egresos.length > 0) && (
        <section className="grid gap-6 sm:grid-cols-2">
          {[
            { titulo: "De dónde vino", filas: ingresos },
            { titulo: "A dónde fue", filas: egresos },
          ].map((bloque) => (
            <div key={bloque.titulo} className="rounded-xl border border-border bg-card p-5">
              <h2 className={cn(etiquetaKpi, "text-muted-foreground")}>{bloque.titulo}</h2>
              {bloque.filas.length === 0 ? (
                <p className="mt-3 text-[0.9rem] text-muted-foreground">Nada este mes.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por descripción o referencia…"
          className={cn(alto, "rounded-full px-5 text-[0.95rem] sm:w-80")}
          aria-label="Buscar movimientos"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
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
          <Button
            variant="outline"
            className={cn(alto, "rounded-xl px-4 text-[0.95rem]")}
            onClick={() => setGestionandoCategorias(true)}
          >
            <Tag />
            Categorías
          </Button>
          {hrefInforme && (
            <Link
              href={hrefInforme}
              target="_blank"
              className={cn(buttonVariants({ variant: "outline" }), alto, "rounded-xl px-4 text-[0.95rem]")}
            >
              <FileText />
              Informe
            </Link>
          )}
          <Button
            variant="outline"
            size="icon"
            className={cn(alto, "w-10 rounded-xl")}
            onClick={() => descargarCsv(lineas, desde, categoriasPropias)}
            disabled={lineas.length === 0}
            aria-label="Descargar en Excel"
            title="Descargar en Excel"
          >
            <Download />
          </Button>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-xl border border-border border-dashed py-20 text-center">
          <p className="text-[1.05rem] font-medium">Sin movimientos de caja</p>
          <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
            {lineas.length === 0
              ? "Los pagos de socios aparecerán aquí al registrarlos, y los ingresos y egresos manuales al anotarlos."
              : "Ningún movimiento coincide con la búsqueda o los filtros."}
          </p>
          <Button
            className={cn(alto, "mt-5 rounded-full px-5 text-[0.95rem]")}
            onClick={() => setRegistrando(true)}
            disabled={esDia && cerrada}
          >
            + Registrar movimiento
          </Button>
        </div>
      ) : (
        <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-160 border-collapse text-[0.95rem]">
            <thead>
              <tr className="border-b border-border bg-card">
                {[...(esDia ? [] : ["Fecha"]), "Descripción", "Tipo", "Origen", "Medio", "Monto"].map((c) => (
                  <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                    {c}
                  </th>
                ))}
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-card/50">
                  {!esDia && (
                    <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">
                      {fechaCorta(l.fecha).slice(0, 5)}
                    </td>
                  )}
                  <td className="px-5 py-4">
                    <div className="font-medium">{l.concepto}</div>
                    {(l.contraparte || l.referencia) && (
                      <div className="text-[0.8rem] text-muted-foreground">
                        {[l.contraparte, l.referencia ? `N.° ${l.referencia}` : null].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[0.8rem] font-medium",
                        l.tipo === "INGRESO" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                      )}
                    >
                      {l.tipo === "INGRESO" ? "Ingreso" : "Egreso"}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">
                    {l.automatico ? "Pago de socio" : (moduloDe(l) ?? "Manual")}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{textoMedioLinea(l.medio)}</td>
                  <td
                    className={cn(
                      "px-5 py-4 font-medium whitespace-nowrap tabular-nums",
                      l.tipo === "INGRESO" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {l.tipo === "INGRESO" ? "+" : "-"}
                    {clp.format(l.monto)}
                  </td>
                  <td className="px-2 py-4">
                    {!l.automatico && !deCompra(l) && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Borrar movimiento"
                        disabled={borrando || (esDia && cerrada)}
                        onClick={() => borrar(l)}
                        className="text-muted-foreground"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {registrando && (
        <NuevoMovimientoDialog
          tipoInicial="EGRESO"
          fecha={esDia ? desde : undefined}
          categoriasPropias={categoriasPropias}
          onCerrar={cerrarRegistro}
        />
      )}
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
