"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Plus, Trash2 } from "lucide-react";
import { eliminarMovimiento } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import { NuevoMovimientoDialog } from "@/components/panel/nuevo-movimiento-dialog";
import { textoCategoria, textoMedioLinea, type LineaLibro, type ResumenMes, type TipoMovimiento } from "@/lib/finanzas";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

function textoCategoriaLinea(l: LineaLibro) {
  if (l.categoria === "BOLETAS") return "Boletas de agua";
  if (l.categoria === "COBROS") return "Cobros a socios";
  return textoCategoria(l.categoria);
}

/** Planilla con punto y coma, la que abre bien el Excel en español. */
function descargarCsv(lineas: LineaLibro[], mes: string) {
  const celda = (t: string | number | null) => `"${String(t ?? "").replace(/"/g, '""')}"`;
  const filas = [
    ["fecha", "tipo", "categoria", "concepto", "contraparte", "medio", "referencia", "ingreso", "egreso"],
    ...[...lineas]
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map((l) => [
        l.fecha,
        l.tipo === "INGRESO" ? "Ingreso" : "Egreso",
        textoCategoriaLinea(l),
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
  a.download = `finanzas-${mes}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Finanzas del mes: lo principal es el resultado (ingresos menos egresos); debajo,
 * de dónde viene y a dónde fue la plata, y el detalle línea por línea.
 */
export function FinanzasVista({
  mes,
  nombreMes,
  mesAnterior,
  mesSiguiente,
  lineas,
  resumen,
}: {
  mes: string;
  nombreMes: string;
  mesAnterior: string;
  mesSiguiente: string;
  lineas: LineaLibro[];
  resumen: ResumenMes;
}) {
  const [anotando, setAnotando] = useState<TipoMovimiento | null>(null);
  const [borrando, iniciar] = useTransition();
  const cerrar = useCallback(() => setAnotando(null), []);

  function borrar(l: LineaLibro) {
    if (!window.confirm(`¿Borrar «${l.concepto}»? No se puede deshacer.`)) return;
    iniciar(async () => {
      const r = await eliminarMovimiento(l.id.replace("mov:", ""));
      if (r.ok) toast.success("Movimiento borrado");
      else toast.error(r.error);
    });
  }

  const ingresos = resumen.porCategoria.filter((c) => c.tipo === "INGRESO");
  const egresos = resumen.porCategoria.filter((c) => c.tipo === "EGRESO");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight">Finanzas</h1>
          <p className="mt-0.5 text-[0.9rem] text-muted-foreground">Lo que entra y sale de plata del comité, mes a mes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => descargarCsv(lineas, mes)} disabled={lineas.length === 0}>
            <Download />
            Descargar
          </Button>
          <Button variant="outline" onClick={() => setAnotando("INGRESO")}>
            <Plus />
            Ingreso
          </Button>
          <Button onClick={() => setAnotando("EGRESO")}>
            <Plus />
            Egreso
          </Button>
        </div>
      </div>

      <nav aria-label="Mes" className="flex items-center gap-2">
        <Link href={`/panel/finanzas?mes=${mesAnterior}`} aria-label="Mes anterior" className="rounded-lg border p-2 text-muted-foreground hover:bg-muted">
          <ChevronLeft className="size-4" />
        </Link>
        <span className="min-w-36 text-center text-[0.95rem] font-medium capitalize">{nombreMes}</span>
        <Link href={`/panel/finanzas?mes=${mesSiguiente}`} aria-label="Mes siguiente" className="rounded-lg border p-2 text-muted-foreground hover:bg-muted">
          <ChevronRight className="size-4" />
        </Link>
      </nav>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 sm:col-span-1">
          <div className="text-[0.8rem] text-muted-foreground">Resultado del mes</div>
          <div className={cn("mt-1 text-[2.5rem] leading-none font-bold tabular-nums", resumen.resultado < 0 && "text-destructive")}>
            {clp.format(resumen.resultado)}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[0.8rem] text-muted-foreground">Ingresos</div>
          <div className="mt-1 text-[1.35rem] font-semibold tabular-nums">{clp.format(resumen.ingresos)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[0.8rem] text-muted-foreground">Egresos</div>
          <div className="mt-1 text-[1.35rem] font-semibold tabular-nums">{clp.format(resumen.egresos)}</div>
        </div>
      </section>

      {(ingresos.length > 0 || egresos.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {[
            { titulo: "De dónde vino", filas: ingresos },
            { titulo: "A dónde fue", filas: egresos },
          ].map((bloque) => (
            <div key={bloque.titulo} className="rounded-xl border bg-card p-4">
              <h2 className="text-[0.8rem] font-medium text-muted-foreground">{bloque.titulo}</h2>
              {bloque.filas.length === 0 ? (
                <p className="mt-2 text-[0.85rem] text-muted-foreground">Nada este mes.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {bloque.filas.map((c) => (
                    <li key={`${c.tipo}${c.categoria}`} className="flex items-baseline justify-between gap-4 text-[0.9rem]">
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

      <section className="overflow-hidden rounded-xl border bg-card">
        {lineas.length === 0 ? (
          <p className="p-8 text-center text-[0.9rem] text-muted-foreground">
            No hay movimientos en {nombreMes}. Anota un egreso o un ingreso con los botones de arriba.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[0.875rem]">
              <thead>
                <tr className="border-b text-left text-[0.75rem] text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Qué fue</th>
                  <th className="px-4 py-2 font-medium">Categoría</th>
                  <th className="px-4 py-2 font-medium">Medio</th>
                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lineas.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground tabular-nums">{fechaCorta(l.fecha)}</td>
                    <td className="px-4 py-2">
                      <div>{l.concepto}</div>
                      {(l.contraparte || l.referencia) && (
                        <div className="text-[0.78rem] text-muted-foreground">
                          {[l.contraparte, l.referencia ? `N.° ${l.referencia}` : null].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{textoCategoriaLinea(l)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{textoMedioLinea(l.medio)}</td>
                    <td className={cn("px-4 py-2 text-right whitespace-nowrap tabular-nums", l.tipo === "EGRESO" && "text-muted-foreground")}>
                      {l.tipo === "EGRESO" ? "−" : ""}
                      {clp.format(l.monto)}
                    </td>
                    <td className="px-2 py-2">
                      {!l.automatico && (
                        <Button variant="ghost" size="icon-sm" aria-label="Borrar movimiento" disabled={borrando} onClick={() => borrar(l)}>
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

      <p className="text-[0.8rem] text-muted-foreground">
        Los pagos de socios entran solos desde Pagos. Esto es un registro de ingresos y egresos para llevar el orden del comité;
        no reemplaza la contabilidad ni la rendición de cuentas formal.
      </p>

      {anotando && <NuevoMovimientoDialog tipoInicial={anotando} onCerrar={cerrar} />}
    </>
  );
}
