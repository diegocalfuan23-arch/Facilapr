"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Landmark, Trash2 } from "lucide-react";
import { eliminarMovimiento } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import { useConfirmar } from "@/components/ui/confirmar";
import { TraspasoDialog } from "@/components/panel/traspaso-dialog";
import { TIPO_DEPOSITO, TIPO_GIRO, textoTraspaso, type Bolsillos, type TraspasoFila } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");

/**
 * Los giros (sacar plata del banco a efectivo) y los depósitos (llevar efectivo al banco): cuánta plata hay
 * hoy en cada lugar y el historial. Ninguno cuenta como ingreso ni egreso en la Caja: la plata solo cambia de lugar.
 */
export function GirosVista({ bolsillos, haySaldoInicial, traspasos }: { bolsillos: Bolsillos | null; haySaldoInicial: boolean; traspasos: TraspasoFila[] }) {
  const { confirmar, dialogo } = useConfirmar();
  const [creando, setCreando] = useState<typeof TIPO_GIRO | typeof TIPO_DEPOSITO | null>(null);
  const [borrando, iniciar] = useTransition();
  const cerrar = useCallback(() => setCreando(null), []);

  async function borrar(t: TraspasoFila) {
    const que = t.tipo === TIPO_GIRO ? "giro" : "depósito";
    if (!(await confirmar({ titulo: `¿Borrar este ${que} de ${clp.format(t.monto)}?`, descripcion: "La plata vuelve al lugar de donde salió.", boton: "Borrar" }))) return;
    iniciar(async () => {
      const r = await eliminarMovimiento(t.id);
      if (r.ok) toast.success("Borrado");
      else toast.error(r.error);
    });
  }

  const totalGirado = traspasos.filter((t) => t.tipo === TIPO_GIRO).reduce((s, t) => s + t.monto, 0);
  const totalDepositado = traspasos.filter((t) => t.tipo === TIPO_DEPOSITO).reduce((s, t) => s + t.monto, 0);

  return (
    <div className="flex flex-col gap-6">
      {!bolsillos ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="text-[1rem] font-medium">Primero define el saldo inicial</p>
          <p className="mx-auto mt-2 max-w-md text-[0.9rem] text-muted-foreground">
            Para saber cuánta plata hay en efectivo y cuánta en el banco, indica con cuánto partes y cuánto de eso estaba en la cuenta.
          </p>
          <Link href="/panel/caja" className="mt-4 inline-flex h-10 items-center rounded-full bg-primary px-5 text-[0.9rem] font-medium text-primary-foreground hover:bg-primary/90">
            Ir a Caja
          </Link>
          {haySaldoInicial && <p className="mt-3 text-[0.8rem] text-muted-foreground">Tu saldo inicial es posterior a hoy.</p>}
        </div>
      ) : (
        <section aria-label="Efectivo y banco" className="grid gap-4 sm:grid-cols-3">
          {[
            { titulo: "En efectivo", icono: Banknote, valor: bolsillos.efectivo },
            { titulo: "En el banco", icono: Landmark, valor: bolsillos.banco },
          ].map((b) => (
            <div key={b.titulo} className="flex items-center gap-4 rounded-xl border border-border bg-card px-6 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <b.icono className="size-5" />
              </span>
              <div>
                <p className="text-[0.8rem] text-muted-foreground">{b.titulo}</p>
                <p className={cn("text-[1.5rem] leading-none font-bold tabular-nums", b.valor < 0 && "text-red-600 dark:text-red-400")}>{clp.format(b.valor)}</p>
              </div>
            </div>
          ))}
          <div className="flex flex-col justify-center rounded-xl border border-border bg-card px-6 py-4">
            <p className="text-[0.8rem] text-muted-foreground">Total</p>
            <p className="text-[1.5rem] leading-none font-bold tabular-nums">{clp.format(bolsillos.efectivo + bolsillos.banco)}</p>
          </div>
        </section>
      )}

      {bolsillos && (bolsillos.efectivo < 0 || bolsillos.banco < 0) && (
        <p className="text-[0.85rem] text-amber-700 dark:text-amber-300">
          Uno de los dos saldos sale negativo: se pagó más en ese lugar de lo que había. Anota el giro o depósito que falta.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.85rem] text-muted-foreground">
          {traspasos.length === 0
            ? "Aún no hay giros ni depósitos."
            : `${traspasos.length} movimiento${traspasos.length === 1 ? "" : "s"} · girado ${clp.format(totalGirado)} · depositado ${clp.format(totalDepositado)}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 rounded-full px-4 text-[0.9rem]" onClick={() => setCreando(TIPO_DEPOSITO)} disabled={!bolsillos}>
            <ArrowDownToLine />
            Depósito
          </Button>
          <Button className="h-10 rounded-full px-4 text-[0.9rem]" onClick={() => setCreando(TIPO_GIRO)} disabled={!bolsillos}>
            <ArrowUpFromLine />
            Giro
          </Button>
        </div>
      </div>

      {traspasos.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full border-collapse text-[0.92rem]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Movimiento</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">N.º de operación</th>
                <th className="px-5 py-3 text-right font-medium">Monto</th>
                <th className="w-12 px-3 py-3">
                  <span className="sr-only">Borrar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {traspasos.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 whitespace-nowrap tabular-nums">{fechaCorta(t.fecha)}</td>
                  <td className="px-5 py-3">{textoTraspaso(t.tipo)}</td>
                  <td className="hidden px-5 py-3 text-muted-foreground sm:table-cell">{t.referencia ?? "—"}</td>
                  <td className="px-5 py-3 text-right font-medium whitespace-nowrap tabular-nums">{clp.format(t.monto)}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Borrar ${t.tipo === TIPO_GIRO ? "giro" : "depósito"} del ${fechaCorta(t.fecha)}`}
                      title="Borrar"
                      disabled={borrando}
                      onClick={() => void borrar(t)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogo}
      {creando && <TraspasoDialog tipoInicial={creando} bolsillos={bolsillos} onCerrar={cerrar} />}
    </div>
  );
}
