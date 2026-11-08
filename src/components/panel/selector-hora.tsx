"use client";

import { useState } from "react";
import { Clock3, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";
const dosDigitos = (n: number) => String(n).padStart(2, "0");
const aMinutos = (h: string) => {
  const [a, b] = h.split(":").map(Number);
  return a * 60 + b;
};
const aHora = (m: number) => `${dosDigitos(Math.floor(m / 60))}:${dosDigitos(m % 60)}`;

/** Al aparecer el elemento elegido, la lista se centra en él. */
const alMontar = (el: HTMLElement | null) => el?.scrollIntoView({ block: "center" });

/** Lo escrito en el buscador como hora completa (HH:MM), o null si todavía no lo es: «845» → 08:45, «8:45» → 08:45. */
function horaEscrita(q: string): string | null {
  const solo = q.replace(/\D/g, "");
  if (solo.length < 3 || solo.length > 4) return null;
  const h = Number(solo.length === 3 ? solo.slice(0, 1) : solo.slice(0, 2));
  const m = Number(solo.slice(-2));
  return h < 24 && m < 60 ? `${dosDigitos(h)}:${dosDigitos(m)}` : null;
}

/**
 * Una hora que se elige de una lista que parte desde las primeras horas de trabajo (no desde la hora de ahora, como
 * el selector del navegador) y que se puede buscar o escribir: «8», «845», «17». Sirve para la hora de llegada,
 * de ingreso y de apertura o cierre.
 */
export function SelectorHora({
  valor,
  onCambio,
  etiqueta,
  inicio = "06:00",
  paso = 5,
  vacio,
  className,
  invalido = false,
}: {
  valor: string | null;
  onCambio: (hora: string | null) => void;
  /** Para lectores de pantalla: «Hora de llegada de Sultan». */
  etiqueta: string;
  /** Desde qué hora parte la lista (se redondea a la hora anterior). Más temprano se llega buscando. */
  inicio?: string;
  /** Cada cuántos minutos hay una opción. */
  paso?: number;
  /** Si se pasa, aparece una opción para dejar el campo vacío con este texto («Cuando abre el comité»). */
  vacio?: string;
  className?: string;
  invalido?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  // Si no hay lugar debajo (las últimas filas de la pantalla), la lista se abre hacia arriba.
  const [arriba, setArriba] = useState(false);
  const [q, setQ] = useState("");

  const desde = Math.floor(aMinutos(inicio) / 60) * 60;
  const todas: string[] = [];
  for (let m = desde; m < 24 * 60; m += paso) todas.push(aHora(m));

  const solo = q.replace(/\D/g, "");
  // «8» muestra las 08:xx; «18» las 18:xx; «845» las 08:45 y vecinas; «1» las 01:xx y las 10 a 19.
  const lista = solo ? todas.filter((h) => h.replace(":", "").startsWith(solo) || h.replace(":", "").slice(1).startsWith(solo)) : todas;
  const exacta = horaEscrita(q);
  const sugerida = exacta && !lista.includes(exacta) ? exacta : null;

  function elegir(h: string | null) {
    onCambio(h);
    setAbierto(false);
    setQ("");
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label={etiqueta}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          // La lista mide unos 300 px: arriba solo si abajo no cabe y arriba sí.
          setArriba(window.innerHeight - r.bottom < 320 && r.top > 320);
          setAbierto((v) => !v);
        }}
        className={cn(
          "flex h-9 w-[118px] items-center justify-between gap-1.5 rounded-lg border bg-white px-2.5 text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          invalido ? "border-[#F2C1C0]" : "border-[#E4E1F0]",
          valor ? "text-[#15132B]" : GRIS,
          className
        )}
      >
        <span className="truncate">{valor ?? "--:--"}</span>
        <Clock3 className="size-4 shrink-0 text-[#8A8799]" aria-hidden />
      </button>

      {abierto && (
        <>
          <button type="button" aria-label="Cerrar" onClick={() => setAbierto(false)} className="fixed inset-0 z-40 cursor-default bg-transparent" />
          <div role="listbox" aria-label={etiqueta} className={cn("absolute left-0 z-50 w-[220px] overflow-hidden rounded-xl border border-[#ECEAF4] bg-white shadow-[0_12px_32px_rgba(21,19,43,0.18)]", arriba ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]")}>
            <div className="relative border-b border-[#F0EEF6] p-2">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                inputMode="numeric"
                value={q}
                onChange={(e) => setQ(e.target.value.replace(/[^\d:]/g, "").slice(0, 5))}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setAbierto(false);
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const h = exacta ?? lista[0];
                    if (h) elegir(h);
                  }
                }}
                placeholder="Escribe 8, 845 o 17"
                aria-label="Buscar hora"
                className="h-9 w-full rounded-lg border border-[#E4E1F0] pr-2 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto p-1">
              {vacio && !solo && (
                <li>
                  <button type="button" onClick={() => elegir(null)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-[#F5F4FA]">
                    <X className="size-3.5 text-[#8A8799]" aria-hidden />
                    <span className={GRIS}>{vacio}</span>
                  </button>
                </li>
              )}
              {sugerida && (
                <li>
                  <button type="button" onClick={() => elegir(sugerida)} className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold text-[#2A07A8] hover:bg-[#F5F3FE]">
                    Usar {sugerida}
                  </button>
                </li>
              )}
              {lista.map((h) => {
                const elegida = h === valor;
                return (
                  <li key={h}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={elegida}
                      // Con el buscador vacío, la lista se abre en la hora elegida; si no hay, queda arriba, en las primeras horas.
                      ref={elegida && !solo ? alMontar : undefined}
                      onClick={() => elegir(h)}
                      className={cn("w-full rounded-lg px-2.5 py-1.5 text-left text-sm tabular-nums hover:bg-[#F5F4FA]", elegida && "bg-[#ECE8FD] font-semibold text-[#2A07A8]")}
                    >
                      {h}
                    </button>
                  </li>
                );
              })}
              {lista.length === 0 && !sugerida && <li className={cn("px-2.5 py-3 text-center text-sm", GRIS)}>Esa hora no existe.</li>}
            </ul>
          </div>
        </>
      )}
    </span>
  );
}
