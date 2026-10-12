"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { registrarEjecucion } from "@/app/panel/ordenes/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TIPOS_ORDEN, type TipoOrden } from "@/lib/ordenes";

export type OrdenParaEjecutar = {
  id: string;
  tipo: TipoOrden;
  socioNombre: string;
  direccion: string | null;
};

/**
 * Reduce la foto en el teléfono antes de enviarla: una foto de cámara pesa
 * varios MB y en el campo la señal es mala. A 1280 px y calidad 0,72 queda
 * en unos 150 a 300 KB y se sigue viendo el número del medidor.
 */
async function comprimir(archivo: File): Promise<{ mime: string; base64: string; vista: string }> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close();
  const vista = lienzo.toDataURL("image/jpeg", 0.72);
  return { mime: "image/jpeg", base64: vista.split(",")[1] ?? "", vista };
}

/** Subir la foto que prueba que el corte, la reposición o la reparación quedó hecho. */
export function EvidenciaDialog({
  orden,
  onCerrar,
}: {
  orden: OrdenParaEjecutar;
  onCerrar: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<{ mime: string; base64: string; vista: string } | null>(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [enviando, iniciar] = useTransition();

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setProcesando(true);
    try {
      setFoto(await comprimir(archivo));
    } catch {
      setError("No pudimos leer esa foto. Intenta con otra.");
    } finally {
      setProcesando(false);
    }
  }

  const info = TIPOS_ORDEN[orden.tipo];

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {info.texto} · {orden.socioNombre}
          </DialogTitle>
          <DialogDescription>
            {orden.direccion ? `${orden.direccion}. ` : ""}
            {info.ejecucion}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={alElegir}
          />

          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={foto.vista}
              alt="Foto de la evidencia"
              className="max-h-72 w-full rounded-lg border border-border object-contain"
            />
          ) : (
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {procesando ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
              <span className="text-[0.9rem]">{procesando ? "Preparando la foto…" : "Sacar o elegir foto"}</span>
            </button>
          )}

          {foto && (
            <Button variant="outline" size="sm" onClick={() => entrada.current?.click()}>
              <Camera />
              Cambiar foto
            </Button>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nota-evidencia">Nota (opcional)</Label>
            <Textarea
              id="nota-evidencia"
              rows={2}
              maxLength={300}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: Medidor sellado, lectura 1.234."
            />
          </div>

          {error && <p className="text-[0.88rem] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={!foto || enviando}
            onClick={() =>
              iniciar(async () => {
                if (!foto) return;
                const r = await registrarEjecucion(orden.id, { mime: foto.mime, base64: foto.base64 }, nota);
                if (r.ok) {
                  toast.success("Evidencia enviada. Queda por dar de alta.");
                  onCerrar();
                } else {
                  setError(r.error);
                  toast.error(r.error);
                }
              })
            }
          >
            {enviando && <Loader2 className="animate-spin" />}
            Enviar evidencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
