"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Punto = { periodo: string; valor: number };

const FORMATOS = {
  clp: (n: number) => "$" + n.toLocaleString("es-CL"),
  m3: (n: number) => `${n.toLocaleString("es-CL")} m³`,
} as const;

/**
 * Barras por período: el período más alto va en el color principal y los demás más claros. Al pasar el
 * cursor (o tocar) una barra se ve su valor; sin tocar nada, se ve el de la barra más alta.
 */
export function ResumenBarras({ datos, formato, nombre }: { datos: Punto[]; formato: keyof typeof FORMATOS; nombre: string }) {
  const [activo, setActivo] = useState<string | null>(null);
  const f = FORMATOS[formato];
  const max = Math.max(...datos.map((d) => d.valor), 1);
  const mayor = datos.reduce((a, b) => (b.valor > a.valor ? b : a), datos[0] ?? { periodo: "", valor: 0 });
  const hayDatos = datos.some((d) => d.valor > 0);

  return (
    <div>
      <div className="flex h-[190px] items-stretch gap-1.5 border-b border-[#E4E1F0] sm:gap-2.5">
        {datos.map((d) => {
          const alto = d.valor === 0 ? 0 : Math.max((d.valor / max) * 88, 3);
          const verValor = activo === d.periodo || (activo === null && hayDatos && d.periodo === mayor.periodo);
          return (
            <button
              key={d.periodo}
              type="button"
              aria-label={`${d.periodo}: ${f(d.valor)}`}
              onMouseEnter={() => setActivo(d.periodo)}
              onMouseLeave={() => setActivo(null)}
              onFocus={() => setActivo(d.periodo)}
              onBlur={() => setActivo(null)}
              className="group relative flex min-w-0 flex-1 flex-col items-center justify-end rounded-t-lg hover:bg-[#F4F2FD] focus-visible:bg-[#F4F2FD] focus-visible:outline-none"
            >
              {verValor && (
                <span className="absolute z-10 rounded-md bg-[#15132B] px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white tabular-nums" style={{ bottom: `calc(${alto}% + 4px)` }}>
                  {f(d.valor)}
                </span>
              )}
              <span className={cn("w-full max-w-[44px] rounded-t-[4px]", hayDatos && d.periodo === mayor.periodo ? "bg-[#3A0CE3]" : "bg-[#A9B3F6]")} style={{ height: `${alto}%` }} />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2.5">
        {datos.map((d) => (
          <span key={d.periodo} className="min-w-0 flex-1 text-center text-xs text-[#5B5970]">
            {d.periodo}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{nombre}</caption>
        <tbody>
          {datos.map((d) => (
            <tr key={d.periodo}>
              <th scope="row">{d.periodo}</th>
              <td>{f(d.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
