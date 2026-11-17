"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, FileText, Loader2, Paperclip, X } from "lucide-react";
import { adjuntarComprobante } from "@/app/panel/finanzas/comprobantes";
import { COMPROBANTE_MAX_BYTES } from "@/lib/comprobantes-comun";
import { cn } from "@/lib/utils";

const ACEPTA = "application/pdf,image/png,image/jpeg";
const GRIS = "text-[#5B5970]";

/** El comprobante se revisa en el navegador antes de enviarlo: si pesa de más, se avisa al tiro. */
function archivoOk(archivo: File | undefined): archivo is File {
  if (!archivo) return false;
  if (archivo.size > COMPROBANTE_MAX_BYTES) {
    toast.error("El archivo pesa más de 3 MB. Prueba con una versión más liviana.");
    return false;
  }
  return true;
}

/**
 * El recuadro para adjuntar un comprobante al anotar un movimiento. El archivo viaja con el formulario (campo «archivo»)
 * y es opcional.
 */
export function CampoComprobante() {
  const entrada = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState<string | null>(null);

  return (
    <div className="relative">
      <input
        ref={entrada}
        type="file"
        name="archivo"
        accept={ACEPTA}
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && !archivoOk(f)) {
            e.target.value = "";
            setNombre(null);
          } else {
            setNombre(f?.name ?? null);
          }
        }}
      />
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        className={cn("flex w-full items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 text-left text-sm", nombre ? "border-[#2FB386] bg-[#F3FBF7] pr-11" : "border-[#C9BCFB] hover:bg-[#FAF8FF]")}
      >
        {nombre ? <Check className="size-4 shrink-0 text-[#0A7A52]" aria-hidden /> : <Paperclip className="size-4 shrink-0 text-[#6B46F5]" aria-hidden />}
        <span className="min-w-0">
          <span className="block font-semibold">{nombre ? "Comprobante adjunto" : "Adjuntar comprobante"}</span>
          <span className={cn("block truncate text-xs", GRIS)}>{nombre ?? "Foto o PDF de la factura o el voucher, hasta 3 MB"}</span>
        </span>
      </button>
      {nombre ? (
        <button
          type="button"
          aria-label="Quitar el comprobante"
          onClick={() => {
            if (entrada.current) entrada.current.value = "";
            setNombre(null);
          }}
          className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#5B5970] hover:bg-white"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * El comprobante de un movimiento ya anotado, en su fila: «Ver» si lo tiene, «Adjuntar» si le falta. Al subir un archivo
 * se guarda al tiro y se avisa con `onListo` para que la pantalla vuelva a pedir sus datos.
 */
export function AccionComprobante({ movimientoId, tiene, onListo, className }: { movimientoId: string; tiene: boolean; onListo?: () => void; className?: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, iniciar] = useTransition();

  function subir(archivo: File | undefined) {
    if (!archivoOk(archivo)) return;
    const datos = new FormData();
    datos.set("archivo", archivo);
    iniciar(async () => {
      const r = await adjuntarComprobante(movimientoId, datos);
      if (r.ok) {
        toast.success("Comprobante adjuntado");
        onListo?.();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <input
        ref={entrada}
        type="file"
        accept={ACEPTA}
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          subir(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {tiene ? (
        <>
          <a href={`/panel/finanzas/comprobante/${movimientoId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#075A3C] hover:underline">
            <FileText className="size-3.5" aria-hidden />
            Ver comprobante
          </a>
          <button type="button" aria-label="Reemplazar el comprobante" title="Reemplazar" disabled={subiendo} onClick={() => entrada.current?.click()} className="flex size-6 items-center justify-center rounded-md text-[#A19FB2] hover:bg-[#F4F3F9] hover:text-[#5B5970]">
            {subiendo ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
          </button>
        </>
      ) : (
        <button type="button" disabled={subiendo} onClick={() => entrada.current?.click()} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#B86400] hover:underline">
          {subiendo ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" aria-hidden />}
          Adjuntar
        </button>
      )}
    </span>
  );
}
