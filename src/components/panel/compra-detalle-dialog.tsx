"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { anotarEgresoCompra, anularCompra, marcarPagada } from "@/app/panel/compras/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MEDIOS_MOVIMIENTO } from "@/lib/finanzas-comun";
import { TEXTO_ESTADO_COMPRA, TEXTO_ORIGEN_ITEM, type CompraFila } from "@/lib/compras-comun";
import { cn } from "@/lib/utils";
import { useConfirmar } from "@/components/ui/confirmar";
import { avisarCambio } from "@/lib/avisos-datos";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const cantidadFmt = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

export const COLOR_ESTADO_COMPRA: Record<string, string> = {
  PENDIENTE: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  PAGADA: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  ANULADA: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
};

/** El detalle de una compra: sus líneas y totales, y desde aquí se paga o se anula. */
export function CompraDetalleDialog({ compra, onCerrar }: { compra: CompraFila; onCerrar: () => void }) {
  const { confirmar, dialogo } = useConfirmar();
  const [medio, setMedio] = useState("TRANSFERENCIA");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function pagar() {
    setError(null);
    iniciar(async () => {
      const r = await marcarPagada(compra.id, medio);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success("Compra pagada: el egreso quedó en Caja");
      avisarCambio("caja");
      onCerrar();
    });
  }

  function anotarEgreso() {
    setError(null);
    iniciar(async () => {
      const r = await anotarEgresoCompra(compra.id, medio);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success("Egreso anotado en Caja");
      avisarCambio("caja");
      onCerrar();
    });
  }

  async function anular() {
    const aviso = compra.estado === "PAGADA" ? " Se borra también su egreso de Caja." : "";
    if (!(await confirmar({ titulo: `¿Anular la compra C-${compra.numero}?`, descripcion: `El stock que sumó vuelve a lo que era.${aviso}`, boton: "Anular compra" }))) return;
    setError(null);
    iniciar(async () => {
      const r = await anularCompra(compra.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success("Compra anulada");
      avisarCambio("caja");
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-2xl sm:p-8">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3 text-lg font-medium">
            Compra C-{compra.numero}
            <span className={cn("rounded-full px-3 py-1 text-[0.8rem] font-medium", COLOR_ESTADO_COMPRA[compra.estado])}>
              {TEXTO_ESTADO_COMPRA[compra.estado]}
            </span>
          </DialogTitle>
          <DialogDescription className="text-[0.9rem]">
            {[
              compra.proveedor ?? "Sin proveedor",
              fechaCorta(compra.fecha),
              compra.folio ? `Factura ${compra.folio}` : null,
              compra.vencimiento && compra.estado === "PENDIENTE" ? `Vence el ${fechaCorta(compra.vencimiento)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-120 border-collapse text-[0.9rem]">
            <thead>
              <tr className="border-b border-border bg-card">
                {["Descripción", "Cantidad", "Costo", "Subtotal"].map((c, i) => (
                  <th key={c} className={cn("px-4 py-3 font-medium text-muted-foreground", i === 0 ? "text-left" : "text-right")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compra.items.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div>{i.descripcion}</div>
                    <div className="text-[0.75rem] text-muted-foreground">{TEXTO_ORIGEN_ITEM[i.origen]}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{cantidadFmt.format(i.cantidad)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{clp.format(i.costoUnitario)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{clp.format(Math.round(i.cantidad * i.costoUnitario))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto flex w-full max-w-xs flex-col text-[0.9rem]">
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{clp.format(compra.subtotal)}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">IVA</dt>
            <dd className="tabular-nums">{clp.format(compra.impuesto)}</dd>
          </div>
          <div className="flex justify-between border-t border-border py-2 text-[1rem] font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{clp.format(compra.total)}</dd>
          </div>
        </dl>

        {compra.notas && <p className="rounded-lg bg-muted px-4 py-3 text-[0.9rem] text-muted-foreground">{compra.notas}</p>}

        {/* Dónde quedó la plata en Caja: así se ve de inmediato si una compra pagada no dejó su egreso. */}
        {compra.estado === "PAGADA" &&
          (compra.fechaPago ? (
            <p className="rounded-lg bg-muted px-4 py-3 text-[0.9rem]">
              Egreso anotado en Caja el <strong className="font-semibold">{fechaCorta(compra.fechaPago)}</strong>.{" "}
              <Link
                href={`/panel/caja?vista=dia&dia=${compra.fechaPago}`}
                className="text-primary hover:underline"
              >
                Ver ese día en Caja
              </Link>
            </p>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[0.9rem] text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              <p>
                <strong className="font-semibold">Esta compra figura como pagada, pero no tiene su egreso en Caja.</strong> Puedes
                anotarlo ahora: quedará con la fecha de la compra ({fechaCorta(compra.fecha)}).
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={medio}
                  onChange={(e) => setMedio(e.target.value)}
                  aria-label="Medio de pago del egreso"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-[0.95rem] text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {MEDIOS_MOVIMIENTO.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.texto}
                    </option>
                  ))}
                </select>
                <Button className="h-10 rounded-full px-5 text-[0.95rem]" onClick={anotarEgreso} disabled={pendiente}>
                  {pendiente && <Loader2 className="animate-spin" />}
                  Anotar el egreso en Caja
                </Button>
              </div>
            </div>
          ))}

        {error && (
          <p className="text-[0.8rem] text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {compra.estado !== "ANULADA" ? (
            <Button variant="ghost" className="h-10 px-4 text-[0.95rem] text-destructive" onClick={anular} disabled={pendiente}>
              Anular compra
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {compra.estado === "PENDIENTE" && (
              <>
                <select
                  value={medio}
                  onChange={(e) => setMedio(e.target.value)}
                  aria-label="Medio de pago"
                  className="h-10 rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {MEDIOS_MOVIMIENTO.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.texto}
                    </option>
                  ))}
                </select>
                <Button className="h-10 rounded-full px-5 text-[0.95rem]" onClick={pagar} disabled={pendiente}>
                  {pendiente && <Loader2 className="animate-spin" />}
                  Marcar como pagada
                </Button>
              </>
            )}
            <Button variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
              Cerrar
            </Button>
          </div>
        </div>
        {dialogo}
      </DialogContent>
    </Dialog>
  );
}
