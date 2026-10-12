"use client";

import { useMemo, useState } from "react";
import { formatearPeriodo, saldo } from "@/lib/boletas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PagoDialog, type BoletaParaPago } from "@/components/panel/pago-dialog";
import { SocioBuscador, type OpcionSocio } from "@/components/panel/socio-buscador";
import type { DatosComiteWhatsApp } from "@/lib/whatsapp";

export type BoletaPendiente = BoletaParaPago & { socioId: string };

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/**
 * Registrar un pago sin pasar por Boletas: se busca al socio, se elige cuál de
 * sus boletas con saldo está pagando y se sigue con el mismo formulario de pago.
 * Solo aparecen socios que tienen algo por pagar.
 */
export function NuevoPagoDialog({
  socios,
  boletas,
  comite,
  onCerrar,
}: {
  socios: OpcionSocio[];
  boletas: BoletaPendiente[];
  comite: DatosComiteWhatsApp;
  onCerrar: () => void;
}) {
  const [socioId, setSocioId] = useState<string | null>(null);
  // Se guarda la boleta misma: al registrar un pago la lista se recarga y, si quedó
  // pagada completa, ya no estaría en ella; el diálogo no debe desaparecer.
  const [elegida, setElegida] = useState<BoletaPendiente | null>(null);

  // Las del socio elegido, la más antigua primero: es la que se suele pagar.
  const delSocio = useMemo(
    () =>
      boletas
        .filter((b) => b.socioId === socioId)
        .sort((a, b) => a.periodo.localeCompare(b.periodo)),
    [boletas, socioId]
  );

  if (elegida) {
    return <PagoDialog boleta={elegida} comite={comite} onCerrar={onCerrar} />;
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Busca al socio y elige la boleta que está pagando.
          </DialogDescription>
        </DialogHeader>

        {socios.length === 0 ? (
          <p className="rounded-lg bg-muted/60 px-3.5 py-3 text-[0.9rem] text-muted-foreground">
            No hay boletas con saldo por pagar.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <SocioBuscador
              socios={socios}
              onElegir={(s) => {
                setSocioId(s?.id ?? null);
                setElegida(null);
              }}
            />

            {socioId && (
              <div className="flex flex-col gap-1.5">
                <div className="text-[0.82rem] font-medium">Boletas por pagar</div>
                <div className="flex flex-col gap-2">
                  {delSocio.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setElegida(b)}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3 text-left",
                        "transition-colors hover:border-primary hover:bg-primary/5"
                      )}
                    >
                      <span className="font-medium">{formatearPeriodo(b.periodo)}</span>
                      <span className="text-right text-[0.82rem] text-muted-foreground">
                        <span className="font-semibold tabular-nums text-foreground">
                          {clp.format(saldo(b.montoTotal, b.montoPagado))}
                        </span>{" "}
                        por pagar
                        {b.montoPagado > 0 && ` · de ${clp.format(b.montoTotal)}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
