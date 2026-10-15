"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileDown, Loader2, MessageCircle } from "lucide-react";
import { registrarCobro } from "@/app/panel/boletas/actions";
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
import { MEDIOS_PAGO, textoConcepto, type ConceptoCobro } from "@/lib/pagos";
import { normalizarTelefono } from "@/lib/formato";
import {
  enlaceWhatsApp,
  mensajeComprobanteCobro,
  telefonoValidoParaWhatsApp,
  type DatosComiteWhatsApp,
} from "@/lib/whatsapp";
import type { OpcionSocio } from "@/components/panel/socio-buscador";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const AYUDA_DESCRIPCION: Record<ConceptoCobro, string> = {
  RECONEXION: "Ej.: reposición del servicio, derecho de reconexión",
  REPARACION: "Ej.: cambio de medidor, reparación de matriz",
  OTRO: "Qué se está cobrando",
};

/**
 * Registrar un cobro que no es una boleta: la reposición o reconexión de un
 * socio, una reparación u otro cobro. Queda con su comprobante, igual que un pago.
 */
export function CobroDialog({
  socio,
  concepto,
  montoSugerido,
  comite,
  onCerrar,
}: {
  socio: OpcionSocio;
  concepto: ConceptoCobro;
  /** Lo que normalmente cuesta (p. ej. la reconexión de Configuración); se puede cambiar. */
  montoSugerido: number | null;
  comite: DatosComiteWhatsApp;
  onCerrar: () => void;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [monto, setMonto] = useState(montoSugerido ? String(montoSugerido) : "");
  const [descripcion, setDescripcion] = useState("");
  const [fechaPago, setFechaPago] = useState(hoy);
  const [medio, setMedio] = useState<string>("EFECTIVO");
  const [referencia, setReferencia] = useState("");
  const [otraPersona, setOtraPersona] = useState(false);
  const [pagador, setPagador] = useState("");
  const [telPagador, setTelPagador] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [registrado, setRegistrado] = useState<{
    monto: number;
    comprobanteUrl: string;
    descripcion: string | null;
    pagadoPor: string | null;
    pagadoPorTelefono: string | null;
  } | null>(null);

  // El comprobante se manda a quien pagó, si dejó su número; si no, al titular.
  const telefonoDestino = registrado?.pagadoPorTelefono ?? socio.telefono ?? null;
  const puedeWhatsApp = telefonoValidoParaWhatsApp(telefonoDestino);

  function enviarComprobante() {
    if (!registrado || !telefonoDestino) return;
    window.open(
      enlaceWhatsApp(
        telefonoDestino,
        mensajeComprobanteCobro(comite.nombre, {
          socioNombre: socio.nombre,
          concepto: textoConcepto(concepto),
          descripcion: registrado.descripcion,
          monto: registrado.monto,
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
          <DialogTitle>{registrado ? "Pago registrado" : textoConcepto(concepto)}</DialogTitle>
          <DialogDescription>{socio.nombre}</DialogDescription>
        </DialogHeader>

        {registrado ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg bg-forest/10 px-3.5 py-3 text-[0.9rem] text-forest">
              Se registró un pago de {clp.format(registrado.monto)} por {textoConcepto(concepto).toLowerCase()}.
            </p>
            {puedeWhatsApp ? (
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
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cobro-monto">Monto que pagó</Label>
              <Input
                id="cobro-monto"
                value={monto}
                onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                autoFocus
              />
              {concepto === "RECONEXION" && montoSugerido ? (
                <span className="text-[0.8rem] text-muted-foreground">
                  Costo de reconexión del comité: {clp.format(montoSugerido)}. Puedes cambiarlo.
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cobro-descripcion">
                Detalle{concepto === "OTRO" ? "" : " (opcional)"}
              </Label>
              <Input
                id="cobro-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder={AYUDA_DESCRIPCION[concepto]}
                maxLength={200}
              />
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
                    <Label htmlFor="cobro-pagador">Quién pagó</Label>
                    <Input
                      id="cobro-pagador"
                      value={pagador}
                      onChange={(e) => setPagador(e.target.value)}
                      placeholder="Nombre"
                      maxLength={120}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cobro-tel-pagador">Su teléfono</Label>
                    <Input
                      id="cobro-tel-pagador"
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
                <Label htmlFor="cobro-fecha">Fecha</Label>
                <Input
                  id="cobro-fecha"
                  type="date"
                  value={fechaPago}
                  max={hoy}
                  onChange={(e) => setFechaPago(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cobro-ref">N.º de operación</Label>
                <Input
                  id="cobro-ref"
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

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            {registrado ? "Listo" : "Cancelar"}
          </Button>
          {!registrado && (
            <Button
              disabled={pendiente || !Number(monto) || (concepto === "OTRO" && !descripcion.trim())}
              onClick={() =>
                iniciar(async () => {
                  setError(null);
                  const r = await registrarCobro(socio.id, {
                    concepto,
                    monto: Number(monto || 0),
                    fecha: fechaPago,
                    medio,
                    referencia: referencia.trim() || undefined,
                    descripcion: descripcion.trim() || undefined,
                    pagadoPor: otraPersona ? pagador.trim() || undefined : undefined,
                    pagadoPorTelefono: otraPersona ? telPagador.trim() || undefined : undefined,
                  });
                  if (r.ok) {
                    toast.success("Pago registrado");
                    setRegistrado({
                      monto: Number(monto),
                      comprobanteUrl: r.comprobanteUrl,
                      descripcion: descripcion.trim() || null,
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
