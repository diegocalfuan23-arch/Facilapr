"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { guardarProduccion } from "@/app/panel/tarifa/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatearPeriodo } from "@/lib/boletas";
import { metros, noFacturada, porcentaje, totalesDeAgua, type MesTarifa } from "@/lib/tarifa-comun";
import { cn } from "@/lib/utils";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const FILA = "grid grid-cols-[1fr_96px_64px] items-center gap-2 px-4 sm:grid-cols-[1fr_128px_128px_96px] sm:px-6";

const clp = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("es-CL")}`;
const enNumero = (v: string) => {
  const limpio = v.replace(/[.\s]/g, "");
  return /^\d+$/.test(limpio) ? Number(limpio) : null;
};

export function TarifaVista({
  anio,
  limites,
  meses,
  resultado,
}: {
  anio: number;
  limites: { desde: number; hasta: number };
  meses: MesTarifa[];
  resultado: number;
}) {
  const router = useRouter();
  const [cambios, setCambios] = useState<Record<string, string>>({});
  const [pendiente, iniciar] = useTransition();

  const filas = meses.map((m) => {
    const texto = cambios[m.mes] ?? (m.producido === null ? "" : String(m.producido));
    return { ...m, texto, producido: enNumero(texto) };
  });
  const agua = totalesDeAgua(filas);
  const hayCambios = Object.keys(cambios).length > 0;
  const irA = (a: number) => router.push(`/panel/tarifa?anio=${a}`);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    iniciar(async () => {
      const r = await guardarProduccion(cambios);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setCambios({});
      toast.success("Guardado");
    });
  }

  const cifras = [
    { nombre: "Producido", valor: agua.producido > 0 ? `${metros(agua.producido)} m³` : "—" },
    { nombre: "Facturado", valor: `${metros(agua.facturado)} m³` },
    { nombre: "No facturado", valor: porcentaje(agua.noFacturada) },
    { nombre: "Resultado de caja", valor: clp(resultado) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Datos tarifarios</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-[#E4E1F0] bg-white">
            <Button type="button" variant="ghost" size="icon" aria-label="Año anterior" disabled={anio <= limites.desde || hayCambios} onClick={() => irA(anio - 1)}>
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="px-2 text-sm font-semibold tabular-nums">{anio}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Año siguiente" disabled={anio >= limites.hasta || hayCambios} onClick={() => irA(anio + 1)}>
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
          <Button variant="outline" className="h-10 rounded-xl" nativeButton={false} render={<a href={`/panel/tarifa/consumos?anio=${anio}`} />}>
            <Download className="size-4" aria-hidden />
            Consumos
          </Button>
          <Button variant="outline" className="h-10 rounded-xl" nativeButton={false} render={<a href={`/panel/tarifa/pdf?anio=${anio}`} target="_blank" rel="noopener" />}>
            <FileText className="size-4" aria-hidden />
            PDF
          </Button>
        </div>
      </div>

      <Card className={cn("grid grid-cols-2 gap-0 rounded-2xl border-0 p-0 sm:grid-cols-4", SOMBRA)}>
        {cifras.map((c) => (
          <div key={c.nombre} className="p-4 sm:px-6">
            <p className={cn("text-[13px]", GRIS)}>{c.nombre}</p>
            <p className="text-2xl font-semibold tabular-nums">{c.valor}</p>
          </div>
        ))}
      </Card>

      <Card className={cn("gap-0 overflow-hidden rounded-2xl border-0 p-0", SOMBRA)}>
        <form onSubmit={guardar}>
          <div className={cn(FILA, "border-b border-[#F0EEF6] py-2 text-xs font-semibold", GRIS)}>
            <span>Mes</span>
            <span>Producido (m³)</span>
            <span className="hidden text-right sm:block">Facturado (m³)</span>
            <span className="text-right">No fact.</span>
          </div>
          {filas.map((m) => (
            <div key={m.mes} className={cn(FILA, "border-b border-[#F0EEF6] py-2")}>
              <label htmlFor={`m-${m.mes}`} className="min-w-0 text-sm">
                {formatearPeriodo(m.mes)}
                <span className={cn("block text-xs sm:hidden", GRIS)}>{metros(m.facturado)} m³ facturados</span>
              </label>
              <Input
                id={`m-${m.mes}`}
                inputMode="numeric"
                autoComplete="off"
                value={m.texto}
                onChange={(e) => setCambios((c) => ({ ...c, [m.mes]: e.target.value }))}
                className="h-10 rounded-xl border-[#E4E1F0] bg-white text-right tabular-nums shadow-none"
              />
              <span className="hidden text-right text-sm tabular-nums sm:block">{metros(m.facturado)}</span>
              <span className="text-right text-sm tabular-nums">{porcentaje(noFacturada(m.producido, m.facturado))}</span>
            </div>
          ))}
          <div className="flex justify-end p-4 sm:px-6">
            <Button type="submit" disabled={!hayCambios || pendiente} className="h-10 rounded-xl bg-[#3A0CE3] text-white hover:bg-[#2F09BA]">
              {pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Guardar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
