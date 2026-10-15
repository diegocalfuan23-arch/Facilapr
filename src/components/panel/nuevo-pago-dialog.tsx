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
import { CobroDialog } from "@/components/panel/cobro-dialog";
import { PagoDialog, type BoletaParaPago } from "@/components/panel/pago-dialog";
import { CONCEPTOS_COBRO, type ConceptoCobro } from "@/lib/pagos";
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
  todosLosSocios,
  costoReconexion,
  boletas,
  comite,
  onCerrar,
}: {
  /** Los que tienen boletas con saldo: solo ellos pueden pagar una boleta. */
  socios: OpcionSocio[];
  /** Todos los socios: cualquiera puede pagar una reposición, una reparación u otro cobro. */
  todosLosSocios: OpcionSocio[];
  costoReconexion: number | null;
  boletas: BoletaPendiente[];
  comite: DatosComiteWhatsApp;
  onCerrar: () => void;
}) {
  // Qué se está pagando: una boleta (lo habitual) u otro cobro.
  const [queSePaga, setQueSePaga] = useState<"BOLETA" | ConceptoCobro>("BOLETA");
  const [socioCobro, setSocioCobro] = useState<OpcionSocio | null>(null);
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

  if (queSePaga !== "BOLETA" && socioCobro) {
    return (
      <CobroDialog
        socio={socioCobro}
        concepto={queSePaga}
        montoSugerido={queSePaga === "RECONEXION" ? costoReconexion : null}
        comite={comite}
        onCerrar={onCerrar}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            {queSePaga === "BOLETA"
              ? "Busca al socio y elige la boleta que está pagando."
              : "Busca al socio que está pagando."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <div className="text-[0.82rem] font-medium">¿Qué está pagando?</div>
          <div className="flex flex-wrap gap-2">
            {[{ valor: "BOLETA", texto: "Boleta" }, ...CONCEPTOS_COBRO].map((c) => (
              <Button
                key={c.valor}
                type="button"
                size="sm"
                variant={queSePaga === c.valor ? "default" : "outline"}
                onClick={() => {
                  setQueSePaga(c.valor as "BOLETA" | ConceptoCobro);
                  setSocioCobro(null);
                  setSocioId(null);
                }}
              >
                {c.texto}
              </Button>
            ))}
          </div>
        </div>

        {queSePaga !== "BOLETA" ? (
          <SocioBuscador socios={todosLosSocios} onElegir={(s) => setSocioCobro(s)} />
        ) : socios.length === 0 ? (
          <p className="rounded-lg bg-muted/60 px-3.5 py-3 text-[0.9rem] text-muted-foreground">
            No hay boletas con saldo por pagar. Si es una reposición, una reparación u otro cobro, elígelo arriba.
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
