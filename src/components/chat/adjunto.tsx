"use client";

import { FileText, X } from "lucide-react";
import { toast } from "sonner";
import { ADJUNTO_MAX_BYTES, textoDeAdjunto, type Adjunto } from "@/lib/adjuntos-comun";
import { cn } from "@/lib/utils";

const peso = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/** El texto que acompaña a un archivo; vacío cuando el mensaje es solo el archivo. */
export const textoDelMensaje = (m: { contenido: string; adjunto?: Adjunto | null }) =>
  m.adjunto && m.contenido === textoDeAdjunto(m.adjunto.nombre) ? "" : m.contenido;

/** El archivo elegido, si cabe. Se vacía el campo para poder elegir el mismo otra vez. */
export function archivoElegido(campo: HTMLInputElement): File | null {
  const archivo = campo.files?.[0] ?? null;
  campo.value = "";
  if (archivo && archivo.size > ADJUNTO_MAX_BYTES) {
    toast.error("El archivo pesa más de 3 MB.");
    return null;
  }
  return archivo;
}

/** Un archivo dentro de una burbuja. `oscuro`: la burbuja es morada. */
export function AdjuntoMensaje({ adjunto, oscuro }: { adjunto: Adjunto; oscuro?: boolean }) {
  const { tipo, url, nombre, tamano } = adjunto;
  if (/^image\/(png|jpeg|webp)$/.test(tipo)) {
    return (
      <a href={url} target="_blank" rel="noopener" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element -- el archivo llega por una dirección firmada, con cualquier tamaño */}
        <img src={url} alt={nombre} className="max-h-60 w-auto max-w-full rounded-lg" />
      </a>
    );
  }
  if (tipo.startsWith("audio/")) return <audio controls preload="none" src={url} className="mb-1 h-10 w-60 max-w-full" />;
  if (tipo.startsWith("video/")) return <video controls preload="metadata" src={url} className="mb-1 max-h-60 w-full rounded-lg" />;
  return (
    <a href={url} target="_blank" rel="noopener" className={cn("mb-1 flex items-center gap-2 rounded-lg px-2 py-2", oscuro ? "bg-white/15 hover:bg-white/25" : "bg-black/5 hover:bg-black/10")}>
      <FileText className="size-5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold">{nombre}</span>
        {tamano ? <span className="block text-[11px] opacity-70">{peso(tamano)}</span> : null}
      </span>
    </a>
  );
}

/** El archivo que está por enviarse, sobre la caja de escribir. */
export function ArchivoPorEnviar({ archivo, onQuitar }: { archivo: File; onQuitar: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[#F4F3F9] px-3 py-2 text-[13px] text-[#3F3C55]">
      <FileText className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{archivo.name}</span>
      <span className="shrink-0 text-xs opacity-70">{peso(archivo.size)}</span>
      <button type="button" onClick={onQuitar} aria-label="Quitar el archivo" className="rounded-full p-1 hover:bg-black/5">
        <X className="size-4" />
      </button>
    </div>
  );
}
