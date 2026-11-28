"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { emitirBoletas } from "@/app/panel/sii/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatearPeriodo } from "@/lib/boletas";
import { cn } from "@/lib/utils";

type Documento = { id: string; folio: number; monto: number; estado: string; socio: string; revisar: boolean };
type Omitida = { socio: string; motivo: string };

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  FIRMADA: { texto: "Sin enviar", clase: "bg-[#F3F1F8] text-[#5B5970]" },
  ENVIADA: { texto: "Enviada", clase: "bg-[#EEEBFD] text-[#3A0CE3]" },
  ACEPTADA: { texto: "Aceptada", clase: "bg-[#E6F6EF] text-[#075A3C]" },
  RECHAZADA: { texto: "Rechazada", clase: "bg-[#FDECEC] text-[#9F1D1D]" },
};
const Etiqueta = ({ texto, clase }: { texto: string; clase: string }) => (
  <span className={cn("shrink-0 rounded-full px-2 py-1 text-xs font-semibold", clase)}>{texto}</span>
);

export function SiiBoletas({
  periodos,
  periodo,
  porEmitir,
  omitidas,
  documentos,
}: {
  periodos: string[];
  periodo: string | null;
  porEmitir: number;
  omitidas: Omitida[];
  documentos: Documento[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [emitiendo, iniciar] = useTransition();

  const emitir = () =>
    iniciar(async () => {
      setError(null);
      const r = await emitirBoletas(periodo!);
      if (!r.ok) return setError(r.error);
      toast.success(`Emitidas: ${r.emitidas}${r.quedan ? `. Quedan ${r.quedan}` : ""}`);
    });

  return (
    <Card className="gap-4 rounded-2xl border-0 p-6 shadow-[0_8px_24px_rgba(58,12,227,0.08)]">
      <h2 className="text-base font-semibold">Boletas</h2>
      {periodo ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Mes"
            value={periodo}
            onChange={(e) => {
              setError(null);
              router.replace(`/panel/sii?mes=${e.target.value}`, { scroll: false });
            }}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {periodos.map((p) => (
              <option key={p} value={p}>
                {formatearPeriodo(p)}
              </option>
            ))}
          </select>
          <Button onClick={emitir} disabled={emitiendo || porEmitir === 0}>
            {emitiendo && <Loader2 className="animate-spin" />}
            Emitir {porEmitir}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-[#5B5970]">Sin boletas.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {omitidas.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[#8A4B00]">No se pueden emitir: {omitidas.length}</summary>
          <ul className="mt-2 max-h-60 divide-y divide-[#F3F1F8] overflow-y-auto">
            {omitidas.map((o, i) => (
              <li key={i} className="flex justify-between gap-4 py-1">
                <span className="truncate">{o.socio}</span>
                <span className="shrink-0 text-[#5B5970]">{o.motivo}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {documentos.length > 0 && (
        <ul className="divide-y divide-[#F3F1F8]">
          {documentos.map((d) => (
            <li key={d.id} className="flex items-center gap-4 py-2">
              <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">N° {d.folio}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{d.socio}</span>
              <span className="shrink-0 text-sm tabular-nums">${d.monto.toLocaleString("es-CL")}</span>
              {d.revisar && <Etiqueta texto="Revisar" clase="bg-[#FFF3E0] text-[#8A4B00]" />}
              <Etiqueta {...(ESTADOS[d.estado] ?? ESTADOS.FIRMADA)} />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Ver la boleta ${d.folio}`}
                nativeButton={false}
                render={<a href={`/panel/sii/documento/${d.id}`} target="_blank" rel="noopener" />}
              >
                <FileText />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
