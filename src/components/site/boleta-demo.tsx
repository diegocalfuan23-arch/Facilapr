"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";

const LECTURA_ANTERIOR = 1236;
const GRIS = "text-[#5B5970]";
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

function Fila({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className={`text-sm ${GRIS}`}>{etiqueta}</dt>
      <dd className={`font-mono text-sm tabular-nums ${fuerte ? "font-semibold" : ""}`}>{valor}</dd>
    </div>
  );
}

/** Una boleta de ejemplo que se calcula sola al mover el consumo o las tarifas: muestra lo que hace el sistema. */
export function BoletaDemo() {
  const [cargo, setCargo] = useState(2100);
  const [m3, setM3] = useState(450);
  const [consumo, setConsumo] = useState(14);
  const campo = "mt-1 h-11 rounded-xl border-[#E4E1F0] bg-[#F7F6FC] font-mono text-[#15132B] shadow-none dark:bg-[#F7F6FC]";
  return (
    <div id="boleta" className="relative scroll-mt-24">
      <div aria-hidden className="absolute -inset-6 rounded-[40px] bg-[#5B7CFF]/30 blur-3xl" />
      <div className="relative rounded-[28px] bg-white p-6 text-[#15132B] shadow-[0_30px_80px_rgba(4,3,20,0.55)]">
        <span className="absolute -top-3 -right-3 hidden items-center gap-2 rounded-full bg-[#0A8259] px-3 py-2 text-xs font-semibold text-white shadow-lg sm:inline-flex">
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
          Cálculo automático
        </span>
        <div>
          <p className="text-[17px] font-semibold tracking-tight">Boleta de agua</p>
          <p className={`text-[13px] ${GRIS}`}>Comité de ejemplo · Noviembre 2026</p>
        </div>

        <dl className="mt-4 rounded-2xl bg-[#F7F6FC] px-4 py-2">
          <Fila etiqueta="Lectura anterior" valor={`${LECTURA_ANTERIOR.toLocaleString("es-CL")} m³`} />
          <Fila etiqueta="Lectura actual" valor={`${(LECTURA_ANTERIOR + consumo).toLocaleString("es-CL")} m³`} />
          <Fila etiqueta="Consumo" valor={`${consumo} m³`} fuerte />
        </dl>

        <label htmlFor="b-consumo" className="mt-4 block text-[13px] font-medium">
          Mueve el consumo
        </label>
        <input id="b-consumo" type="range" min="0" max="60" value={consumo} onChange={(e) => setConsumo(Number(e.target.value))} className="mt-1 h-6 w-full accent-[#3A0CE3]" />

        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="b-cargo" className="text-[13px] font-medium">
              Cargo fijo
            </label>
            <Input id="b-cargo" type="number" min="0" value={cargo} onChange={(e) => setCargo(Math.max(0, Number(e.target.value)))} className={campo} />
          </div>
          <div>
            <label htmlFor="b-m3" className="text-[13px] font-medium">
              Valor del m³
            </label>
            <Input id="b-m3" type="number" min="0" value={m3} onChange={(e) => setM3(Math.max(0, Number(e.target.value)))} className={campo} />
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <p className={`text-sm ${GRIS}`}>Total a pagar</p>
          <p className="text-[40px] leading-none font-semibold tracking-[-0.04em] text-[#3A0CE3] tabular-nums">{clp(consumo * m3 + cargo)}</p>
        </div>
      </div>
    </div>
  );
}
