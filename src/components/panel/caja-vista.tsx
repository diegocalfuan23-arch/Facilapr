"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Lock, Plus, Trash2 } from "lucide-react";
import { eliminarMovimiento } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CerrarCajaDialog } from "@/components/panel/cerrar-caja-dialog";
import { NuevoMovimientoDialog } from "@/components/panel/nuevo-movimiento-dialog";
import { SaldoInicialDialog } from "@/components/panel/saldo-inicial-dialog";
import {
  textoCategoria,
  textoMedioLinea,
  type LineaLibro,
  type ResumenMes,
  type ResumenPeriodo,
} from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

function categoriaDe(l: LineaLibro) {
  if (l.categoria === "BOLETAS") return "Boletas de agua";
  if (l.categoria === "COBROS") return "Cobros a socios";
  return textoCategoria(l.categoria);
}

/** Planilla con punto y coma, la que abre bien el Excel en español. */
function descargarCsv(lineas: LineaLibro[], nombre: string) {
  const celda = (t: string | number | null) => `"${String(t ?? "").replace(/"/g, '""')}"`;
  const filas = [
    ["fecha", "tipo", "categoria", "concepto", "contraparte", "medio", "referencia", "ingreso", "egreso"],
    ...[...lineas]
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map((l) => [
        l.fecha,
        l.tipo === "INGRESO" ? "Ingreso" : "Egreso",
        categoriaDe(l),
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

type Props = {
  modo: "dia" | "mes";
  /** El primer día del período (AAAA-MM-DD). */
  desde: string;
  /** "Noviembre 2026" en el mes; la fecha en el día. */
  etiqueta: string;
  hrefAnterior: string;
  hrefSiguiente: string;
  hrefDia: string;
  hrefMes: string;
  resumen: ResumenPeriodo;
  lineas: LineaLibro[];
  /** Cuánto fue a cada categoría; se muestra en el mes. */
  porCategoria: ResumenMes["porCategoria"];
  saldoInicial: { monto: number; fecha: string } | null;
};

/**
 * La Caja del comité, por día o por mes: lo importante es cuánta plata hay (un solo
 * número grande); lo demás —de dónde vino y a dónde fue— va debajo, más tranquilo.
 * Los pagos de socios entran solos; el resto se anota a mano.
 */
export function CajaVista({
  modo,
  desde,
  etiqueta,
  hrefAnterior,
  hrefSiguiente,
  hrefDia,
  hrefMes,
  resumen,
  lineas,
  porCategoria,
  saldoInicial,
}: Props) {
  const router = useRouter();
  const [, navegar] = useTransition();
  const [borrando, iniciar] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "INGRESO" | "EGRESO">("todos");
  const [registrando, setRegistrando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [definiendoSaldo, setDefiniendoSaldo] = useState(false);
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
    if (filtro !== "todos" && l.tipo !== filtro) return false;
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

  return (
    <div className="flex flex-col gap-8">
      {/* Arriba: dónde estoy (día o mes) y qué puedo hacer. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex rounded-lg bg-muted p-1 text-[0.85rem]" role="tablist" aria-label="Período">
            {[
              { href: hrefDia, texto: "Día", activo: esDia },
              { href: hrefMes, texto: "Mes", activo: !esDia },
            ].map((t) => (
              <Link
                key={t.texto}
                href={t.href}
                role="tab"
                aria-selected={t.activo}
                className={cn(
                  "rounded-md px-4 py-1 transition-colors",
                  t.activo ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.texto}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link href={hrefAnterior} aria-label="Anterior" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronLeft className="size-4" />
            </Link>
            {esDia ? (
              <Input
                type="date"
                value={desde}
                onChange={(e) => e.target.value && navegar(() => router.push(`/panel/caja?vista=dia&dia=${e.target.value}`))}
                className="w-auto"
                aria-label="Día"
              />
            ) : (
              <span className="min-w-36 text-center text-[0.95rem] font-medium capitalize">{etiqueta}</span>
            )}
            <Link href={hrefSiguiente} aria-label="Siguiente" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => descargarCsv(lineas, desde)} disabled={lineas.length === 0}>
            <Download />
            Descargar
          </Button>
          {esDia && (
            <Button variant="outline" onClick={() => setCerrando(true)}>
              <Lock />
              {cerrada ? "Caja cerrada" : "Cerrar caja"}
            </Button>
          )}
          <Button onClick={() => setRegistrando(true)}>
            <Plus />
            Movimiento
          </Button>
        </div>
      </div>

      {/* Lo principal: cuánta plata hay. Debajo, cómo se llega a ese número. */}
      <section aria-label="Disponible" className="flex flex-col gap-2">
        <p className="text-[0.9rem] text-muted-foreground">
          {esDia ? "Disponible al cierre del día" : `Disponible al cierre de ${etiqueta}`}
          {cerrada && resumen.cierre?.cerradoPor ? ` · cerrada por ${resumen.cierre.cerradoPor}` : ""}
        </p>
        <p className="text-[2.5rem] leading-none font-bold tracking-tight tabular-nums">
          {resumen.disponible === null ? "—" : clp.format(resumen.disponible)}
        </p>

        {resumen.disponibleAnterior === null ? (
          <p className="mt-2 text-[0.9rem] text-muted-foreground">
            {saldoInicial ? (
              <>El saldo inicial es del {fechaCorta(saldoInicial.fecha)}: de ese día en adelante se ve la plata disponible.</>
            ) : (
              <>
                Define con cuánta plata partes para ver el disponible.{" "}
                <button type="button" onClick={() => setDefiniendoSaldo(true)} className="text-primary hover:underline">
                  Definir saldo inicial
                </button>
              </>
            )}
          </p>
        ) : (
          <p className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[0.9rem] text-muted-foreground">
            <span>
              Anterior <span className="text-foreground tabular-nums">{clp.format(resumen.disponibleAnterior)}</span>
            </span>
            <span>
              Ingresos <span className="text-foreground tabular-nums">+{clp.format(resumen.ingresos)}</span>
            </span>
            <span>
              Egresos <span className="text-foreground tabular-nums">−{clp.format(resumen.egresos)}</span>
            </span>
            <button type="button" onClick={() => setDefiniendoSaldo(true)} className="hover:text-foreground hover:underline">
              Cambiar saldo inicial
            </button>
          </p>
        )}
      </section>

      {/* En el mes, de dónde vino y a dónde fue la plata. */}
      {!esDia && (ingresos.length > 0 || egresos.length > 0) && (
        <section className="grid gap-8 sm:grid-cols-2">
          {[
            { titulo: "De dónde vino", filas: ingresos },
            { titulo: "A dónde fue", filas: egresos },
          ].map((bloque) => (
            <div key={bloque.titulo} className="flex flex-col gap-2">
              <h2 className="text-[0.85rem] font-medium text-muted-foreground">{bloque.titulo}</h2>
              {bloque.filas.length === 0 ? (
                <p className="text-[0.9rem] text-muted-foreground">Nada este mes.</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {bloque.filas.map((c) => (
                    <li key={`${c.tipo}${c.categoria}`} className="flex items-baseline justify-between gap-4 py-2 text-[0.9rem]">
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

      {/* El detalle, línea por línea. */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex gap-1 text-[0.85rem]" role="group" aria-label="Filtrar por tipo">
            {(
              [
                ["todos", "Todos"],
                ["INGRESO", "Ingresos"],
                ["EGRESO", "Egresos"],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={filtro === valor}
                onClick={() => setFiltro(valor)}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  filtro === valor ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {texto}
              </button>
            ))}
          </div>
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            className="sm:w-64"
            aria-label="Buscar movimientos"
          />
        </div>

        {filtradas.length === 0 ? (
          <p className="py-16 text-center text-[0.9rem] text-muted-foreground">
            {lineas.length === 0
              ? "Sin movimientos en este período. Los pagos de socios aparecen solos; los demás se anotan con «Movimiento»."
              : "Ningún movimiento coincide con la búsqueda."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-136 text-[0.9rem]">
              <tbody className="divide-y">
                {filtradas.map((l) => (
                  <tr key={l.id} className="group">
                    {!esDia && (
                      <td className="w-24 py-4 pr-4 align-top whitespace-nowrap text-muted-foreground tabular-nums">
                        {fechaCorta(l.fecha).slice(0, 5)}
                      </td>
                    )}
                    <td className="py-4 pr-4">
                      <div>{l.concepto}</div>
                      <div className="text-[0.8rem] text-muted-foreground">
                        {[
                          l.contraparte,
                          l.automatico ? null : "Anotado a mano",
                          textoMedioLinea(l.medio),
                          l.referencia ? `N.° ${l.referencia}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="hidden py-4 pr-4 align-top text-muted-foreground sm:table-cell">{categoriaDe(l)}</td>
                    <td className="py-4 text-right align-top font-medium whitespace-nowrap tabular-nums">
                      {l.tipo === "INGRESO" ? "+" : "−"}
                      {clp.format(l.monto)}
                    </td>
                    <td className="w-10 py-3 pl-2 align-top">
                      {!l.automatico && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Borrar movimiento"
                          disabled={borrando}
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
      </section>

      {registrando && (
        <NuevoMovimientoDialog tipoInicial="EGRESO" fecha={esDia ? desde : undefined} onCerrar={cerrarRegistro} />
      )}
      {cerrando && <CerrarCajaDialog resumen={resumen} movimientos={lineas.length} onCerrar={cerrarCierre} />}
      {definiendoSaldo && <SaldoInicialDialog actual={saldoInicial} onCerrar={cerrarSaldo} />}
    </div>
  );
}
