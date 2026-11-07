"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const largoDeMes = (k: string) => MESES[Number(k.slice(5)) - 1] ?? k;
const cortoDe = (k: string) => {
  const t = largoDeMes(k);
  return t[0].toUpperCase() + t.slice(1, 3);
};
const titulo = (t: string) => t[0].toUpperCase() + t.slice(1);

/**
 * El mes que se mira: flechas, un calendario con el año y cuántas lecturas tiene cada mes, y «Todos los meses».
 * `mes` es AAAA-MM o "todos". No se puede ir a un mes que todavía no llega.
 */
export function SelectorMesLecturas({ mes, actual, onCambio, conteo, total }: { mes: string; actual: string; onCambio: (k: string) => void; conteo: (k: string) => number; total: number }) {
  const [abierto, setAbierto] = useState(false);
  const [anio, setAnio] = useState(Number((mes === "todos" ? actual : mes).slice(0, 4)));
  const ref = useRef<HTMLDivElement>(null);
  const anioActual = Number(actual.slice(0, 4));
  const base = mes === "todos" ? actual : mes;

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", cerrar);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", cerrar);
    };
  }, [abierto]);

  function mover(d: number) {
    const [a, n] = base.split("-").map(Number);
    const t = new Date(a, n - 1 + d, 1);
    const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
    if (k <= actual) onCambio(k);
  }

  function alternar() {
    if (!abierto) setAnio(Number(base.slice(0, 4)));
    setAbierto((v) => !v);
  }

  const n = mes === "todos" ? total : conteo(mes);
  return (
    <div ref={ref} className="relative flex items-center gap-1 rounded-xl bg-white/90 p-1 shadow-[0_2px_8px_rgba(58,12,227,0.05)]">
      <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => mover(-1)} className="size-10 rounded-lg">
        <ChevronLeft />
      </Button>
      <button type="button" aria-haspopup="dialog" aria-expanded={abierto} onClick={alternar} className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 hover:bg-[#F5F4FA] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:min-w-[210px]">
        <CalendarDays className="size-4 shrink-0 text-[#6F6C82]" aria-hidden />
        <span className="text-left leading-tight">
          <span className="block text-sm font-semibold">
            {mes === "todos" ? (
              "Todos los meses"
            ) : (
              <>
                {titulo(largoDeMes(mes))} {mes.slice(0, 4)}
                {mes === actual && <span className="ml-1.5 rounded bg-[#ECE8FD] px-1 py-px text-[10px] font-bold text-[#2A07A8] uppercase">Actual</span>}
              </>
            )}
          </span>
          <span className={cn("block text-[11px] tabular-nums", GRIS)}>
            {n} lectura{n === 1 ? "" : "s"}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-[#6F6C82] transition-transform", abierto && "rotate-180")} aria-hidden />
      </button>
      <Button variant="ghost" size="icon" aria-label="Mes siguiente" disabled={mes === "todos" || mes >= actual} onClick={() => mover(1)} className="size-10 rounded-lg">
        <ChevronRight />
      </Button>

      {abierto && (
        <div role="dialog" aria-label="Elegir mes" className="absolute inset-x-0 top-[calc(100%+8px)] z-40 rounded-2xl border border-[#ECEAF4] bg-white p-3 shadow-[0_16px_40px_rgba(21,19,43,0.16)] sm:right-auto sm:left-0 sm:w-[340px]">
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label="Año anterior" onClick={() => setAnio((a) => a - 1)} className="size-8 rounded-lg">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold tabular-nums">{anio}</span>
            <Button variant="ghost" size="icon" aria-label="Año siguiente" disabled={anio >= anioActual} onClick={() => setAnio((a) => a + 1)} className="size-8 rounded-lg">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MESES.map((_, i) => {
              const k = `${anio}-${String(i + 1).padStart(2, "0")}`;
              const futuro = k > actual;
              const c = conteo(k);
              const sel = k === mes;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={futuro}
                  onClick={() => {
                    onCambio(k);
                    setAbierto(false);
                  }}
                  aria-current={sel ? "true" : undefined}
                  className={cn("flex h-14 flex-col items-center justify-center rounded-xl border text-sm leading-tight transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35", sel ? "border-primary bg-[#F3F0FE] text-[#2A07A8]" : k === actual ? "border-[#D9D1FB]" : "border-transparent enabled:hover:bg-[#F7F6FB]")}
                >
                  <span className="font-semibold">{cortoDe(k)}</span>
                  <span className={cn("text-[11px] tabular-nums", c ? (sel ? "text-[#6B46F5]" : GRIS) : "text-[#B4B2C4]")}>{futuro ? "—" : c ? `${c} lect.` : "sin datos"}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            {mes !== "todos" && (
              <button
                type="button"
                onClick={() => {
                  onCambio("todos");
                  setAbierto(false);
                }}
                className="w-full rounded-lg py-2 text-[13px] font-semibold text-[#2A07A8] hover:bg-[#F5F3FE]"
              >
                Ver todos los meses
              </button>
            )}
            {mes !== actual && (
              <button
                type="button"
                onClick={() => {
                  onCambio(actual);
                  setAbierto(false);
                }}
                className="w-full rounded-lg py-2 text-[13px] font-semibold text-[#2A07A8] hover:bg-[#F5F3FE]"
              >
                Volver a {largoDeMes(actual)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
