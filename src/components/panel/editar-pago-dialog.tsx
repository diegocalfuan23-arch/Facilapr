"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { editarPago } from "@/app/panel/boletas/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEDIOS_PAGO, textoConcepto } from "@/lib/pagos";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { avisarCambio } from "@/lib/avisos-datos";

const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** El día (AAAA-MM-DD) en hora de Chile de un instante ISO. */
const diaChile = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export type PagoEditable = {
  id: string;
  monto: number;
  /** ISO. */
  fecha: string;
  medio: string;
  referencia: string | null;
  pagadoPor: string | null;
  concepto: string;
  descripcion: string | null;
  repactacionId: string | null;
  socioNombre: string;
  comprobanteUrl: string;
};

/** Corregir un pago ya registrado. El comprobante se actualiza solo con lo que se cambie. */
export function EditarPagoDialog({ pago, onCerrar }: { pago: PagoEditable; onCerrar: () => void }) {
  const router = useRouter();
  const [fecha, setFecha] = useState(diaChile(pago.fecha));
  const [monto, setMonto] = useState(String(pago.monto));
  const [medio, setMedio] = useState(pago.medio);
  const [referencia, setReferencia] = useState(pago.referencia ?? "");
  const [pagadoPor, setPagadoPor] = useState(pago.pagadoPor ?? "");
  const [descripcion, setDescripcion] = useState(pago.descripcion ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const esCobro = pago.concepto !== "BOLETA";
  const medios = MEDIOS_PAGO.some((m) => m.valor === pago.medio) ? MEDIOS_PAGO : [...MEDIOS_PAGO, { valor: pago.medio, texto: pago.medio }];

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await editarPago(pago.id, {
        monto: Number(monto.replace(/\D/g, "")),
        fecha,
        medio,
        referencia,
        pagadoPor,
        descripcion,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success("Pago corregido. El comprobante ya muestra los datos nuevos.");
      avisarCambio("caja");
      router.refresh();
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Corregir pago</DialogTitle>
          <DialogDescription className="text-[0.9rem]">
            {pago.socioNombre} · {textoConcepto(pago.concepto)}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ep-fecha">Fecha del pago</Label>
              <Input id="ep-fecha" type="date" value={fecha} max={hoyEnChile()} onChange={(e) => setFecha(e.target.value)} className="h-10" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ep-monto">Monto</Label>
              <Input
                id="ep-monto"
                inputMode="numeric"
                value={monto ? `$${Number(monto).toLocaleString("es-CL")}` : ""}
                onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").slice(0, 9))}
                disabled={Boolean(pago.repactacionId)}
                className="h-10"
              />
            </div>
          </div>
          {pago.repactacionId && <p className="-mt-2 text-[0.75rem] text-muted-foreground">El monto de un pago de acuerdo no se cambia aquí: elimínalo y regístralo de nuevo.</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ep-medio">Medio de pago</Label>
              <select id="ep-medio" value={medio} onChange={(e) => setMedio(e.target.value)} className={selectClase}>
                {medios.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.texto}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ep-ref">N.º de operación</Label>
              <Input id="ep-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={80} placeholder="Opcional" className="h-10" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ep-pagador">Quién pagó (si no es el titular)</Label>
            <Input id="ep-pagador" value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)} maxLength={120} placeholder="Opcional" className="h-10" />
          </div>

          {esCobro && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="ep-desc">Detalle del cobro</Label>
              <Input id="ep-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={200} placeholder="Opcional" className="h-10" />
            </div>
          )}

          <p className="text-[0.75rem] text-muted-foreground">
            El comprobante se arma con estos datos cada vez que se abre: el mismo enlace muestra la versión corregida. Si ya lo enviaste al socio, vuelve a enviárselo.
          </p>

          {error && (
            <p className="text-[0.85rem] text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <a href={pago.comprobanteUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-primary hover:underline">
              <ExternalLink className="size-4" />
              Ver comprobante
            </a>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="button" className="h-10 rounded-full px-5 text-[0.95rem]" disabled={guardando || !fecha || !monto} onClick={guardar}>
                {guardando && <Loader2 className="animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
