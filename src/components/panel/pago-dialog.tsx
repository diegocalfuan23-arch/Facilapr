"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileDown, Loader2, MessageCircle, Trash2 } from "lucide-react";
import {
  eliminarPago,
  pagosDeBoleta,
  registrarPago,
  type PagoRegistrado,
} from "@/app/panel/boletas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatearPeriodo, saldo } from "@/lib/boletas";
import { MEDIOS_PAGO, textoMedioPago } from "@/lib/pagos";
import { normalizarTelefono } from "@/lib/formato";
import {
  enlaceWhatsApp,
  mensajeComprobantePago,
  primerNombre,
  telefonoValidoParaWhatsApp,
  type DatosComiteWhatsApp,
} from "@/lib/whatsapp";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/** Lo que el diálogo necesita saber de la boleta a la que se le registra el pago. */
export type BoletaParaPago = {
  id: string;
  socioNombre: string;
  socioTelefono: string | null;
  /** Aceptó recibir WhatsApp automáticos: sin esto el comprobante automático no le sale. */
  socioConsentimiento?: boolean;
  periodo: string;
  montoTotal: number;
  montoPagado: number;
};

/** Registrar un pago o abono sobre una boleta, con su historial y comprobante. */
export function PagoDialog({
  boleta,
  comite,
  onCerrar,
}: {
  boleta: BoletaParaPago;
  comite: DatosComiteWhatsApp;
  onCerrar: () => void;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [monto, setMonto] = useState(
    String(saldo(boleta.montoTotal, boleta.montoPagado) || "")
  );
  const [fechaPago, setFechaPago] = useState(hoy);
  const [medio, setMedio] = useState<string>("EFECTIVO");
  const [referencia, setReferencia] = useState("");
  // Quien pone la plata no siempre es el titular del arranque (un familiar, un arrendatario…).
  const [otraPersona, setOtraPersona] = useState(false);
  const [pagador, setPagador] = useState("");
  const [telPagador, setTelPagador] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [historial, setHistorial] = useState<PagoRegistrado[] | null>(null);
  // Lo que se acaba de registrar: ofrece mandar el comprobante.
  const [registrado, setRegistrado] = useState<{
    monto: number;
    comprobanteUrl: string;
    montoPagado: number;
    pagadoPor: string | null;
    pagadoPorTelefono: string | null;
  } | null>(null);

  useEffect(() => {
    let vivo = true;
    pagosDeBoleta(boleta.id)
      .then((r) => vivo && setHistorial(r))
      .catch(() => vivo && setHistorial([]));
    return () => {
      vivo = false;
    };
  }, [boleta.id, registrado]);

  const pagadoActual = registrado?.montoPagado ?? boleta.montoPagado;
  const pendienteDePago = saldo(boleta.montoTotal, pagadoActual);
  // El comprobante se manda a quien pagó, si dejó su número; si no, al titular.
  const telefonoDestino = registrado?.pagadoPorTelefono ?? boleta.socioTelefono;
  const puedeWhatsApp = telefonoValidoParaWhatsApp(telefonoDestino);
  // Si el comprobante ya le sale solo al titular, el botón manual sobra; se mantiene si pagó
  // otra persona y dejó su número (el automático va solo al titular) o si al titular no le sale.
  const cubiertoPorAutomatico =
    Boolean(comite.comprobanteAutomatico) &&
    Boolean(boleta.socioConsentimiento) &&
    telefonoValidoParaWhatsApp(boleta.socioTelefono) &&
    !registrado?.pagadoPorTelefono;

  function enviarComprobante() {
    if (!registrado || !telefonoDestino) return;
    window.open(
      enlaceWhatsApp(
        telefonoDestino,
        mensajeComprobantePago(comite.nombre, {
          socioNombre: boleta.socioNombre,
          periodo: boleta.periodo,
          monto: registrado.monto,
          montoTotal: boleta.montoTotal,
          montoPagado: registrado.montoPagado,
          comprobanteUrl: registrado.comprobanteUrl,
          pagadoPor: registrado.pagadoPor,
        })
      ),
      "_blank",
      "noopener"
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{registrado ? "Pago registrado" : "Registrar pago"}</DialogTitle>
          <DialogDescription>
            {boleta.socioNombre} · {formatearPeriodo(boleta.periodo)} ·{" "}
            {clp.format(boleta.montoTotal)}
          </DialogDescription>
        </DialogHeader>

        {registrado ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg bg-forest/10 px-3.5 py-3 text-[0.9rem] text-forest">
              Se registró un pago de {clp.format(registrado.monto)}.{" "}
              {pendienteDePago > 0
                ? `Quedan ${clp.format(pendienteDePago)} por pagar.`
                : "La boleta quedó pagada completa."}
            </p>
            {cubiertoPorAutomatico ? (
              <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-[0.84rem] text-muted-foreground">
                El comprobante le llega a {primerNombre(boleta.socioNombre)} por WhatsApp automáticamente.
              </p>
            ) : puedeWhatsApp ? (
              <Button onClick={enviarComprobante} className="h-10">
                <MessageCircle />
                Enviar comprobante por WhatsApp
              </Button>
            ) : (
              <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-[0.84rem] text-muted-foreground">
                Este socio no tiene un teléfono válido para WhatsApp. Puedes abrir
                el comprobante y compartirlo por otro medio.
              </p>
            )}
            <Button
              variant="outline"
              className="h-10"
              nativeButton={false}
              render={<a href={registrado.comprobanteUrl} target="_blank" rel="noopener" />}
            >
              <FileDown />
              Ver comprobante
            </Button>
          </div>
        ) : pendienteDePago === 0 ? (
          <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-[0.9rem] text-muted-foreground">
            Esta boleta está pagada completa.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="monto">Monto que pagó</Label>
              <Input
                id="monto"
                value={monto}
                onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                autoFocus
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMonto(String(pendienteDePago))}
                >
                  Pagó lo que falta ({clp.format(pendienteDePago)})
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Medio de pago</Label>
              <div className="flex flex-wrap gap-2">
                {MEDIOS_PAGO.map((m) => (
                  <Button
                    key={m.valor}
                    type="button"
                    size="sm"
                    variant={medio === m.valor ? "default" : "outline"}
                    onClick={() => setMedio(m.valor)}
                  >
                    {m.texto}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-[0.88rem]">
                <input
                  type="checkbox"
                  checked={otraPersona}
                  onChange={(e) => setOtraPersona(e.target.checked)}
                />
                Pagó otra persona (no es el titular)
              </label>
              {otraPersona && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pagador">Quién pagó</Label>
                    <Input
                      id="pagador"
                      value={pagador}
                      onChange={(e) => setPagador(e.target.value)}
                      placeholder="Nombre"
                      maxLength={120}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="tel-pagador">Su teléfono</Label>
                    <Input
                      id="tel-pagador"
                      value={telPagador}
                      onChange={(e) => setTelPagador(e.target.value)}
                      placeholder="Opcional"
                      maxLength={30}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fecha-pago">Fecha</Label>
                <Input
                  id="fecha-pago"
                  type="date"
                  value={fechaPago}
                  max={hoy}
                  onChange={(e) => setFechaPago(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ref-pago">N.º de operación</Label>
                <Input
                  id="ref-pago"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Opcional"
                  maxLength={80}
                />
              </div>
            </div>

            {error && <p className="text-[0.88rem] text-destructive">{error}</p>}
          </div>
        )}

        {historial && historial.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[0.78rem] font-medium text-muted-foreground">
              Pagos de esta boleta
            </div>
            <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
              {historial.map((h) => (
                <div key={h.id} className="flex items-center gap-2 px-3 py-2 text-[0.84rem]">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium tabular-nums">{clp.format(h.monto)}</div>
                    <div className="truncate text-[0.76rem] text-muted-foreground">
                      {new Date(h.fecha).toLocaleDateString("es-CL")} ·{" "}
                      {textoMedioPago(h.medio)}
                      {h.pagadoPor ? ` · pagó ${h.pagadoPor}` : ""}
                      {h.referencia ? ` · ${h.referencia}` : ""}
                    </div>
                  </div>
                  <a
                    href={h.comprobanteUrl}
                    target="_blank"
                    rel="noopener"
                    className="text-[0.78rem] font-medium text-primary hover:underline"
                  >
                    Comprobante
                  </a>
                  <button
                    type="button"
                    aria-label="Eliminar pago"
                    title="Eliminar este pago"
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      if (!window.confirm("¿Eliminar este pago? La boleta volverá a deber ese monto.")) return;
                      iniciar(async () => {
                        const r = await eliminarPago(h.id);
                        if (r.ok) {
                          toast.success("Pago eliminado");
                          setHistorial((prev) => prev?.filter((x) => x.id !== h.id) ?? null);
                          setRegistrado(null);
                        } else {
                          toast.error(r.error);
                        }
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            {registrado ? "Listo" : "Cancelar"}
          </Button>
          {!registrado && pendienteDePago > 0 && (
            <Button
              disabled={pendiente || !Number(monto)}
              onClick={() =>
                iniciar(async () => {
                  setError(null);
                  const r = await registrarPago(boleta.id, {
                    monto: Number(monto || 0),
                    fecha: fechaPago,
                    medio,
                    referencia: referencia.trim() || undefined,
                    pagadoPor: otraPersona ? pagador.trim() || undefined : undefined,
                    pagadoPorTelefono: otraPersona ? telPagador.trim() || undefined : undefined,
                  });
                  if (r.ok) {
                    toast.success("Pago registrado");
                    setRegistrado({
                      monto: Number(monto),
                      comprobanteUrl: r.comprobanteUrl,
                      montoPagado: r.montoPagado,
                      pagadoPor: otraPersona ? pagador.trim() || null : null,
                      pagadoPorTelefono:
                        otraPersona && telPagador.trim() ? normalizarTelefono(telPagador.trim()) : null,
                    });
                  } else {
                    setError(r.error);
                    toast.error(r.error);
                  }
                })
              }
            >
              {pendiente && <Loader2 className="animate-spin" />}
              Registrar pago
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
