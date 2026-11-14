"use client";

import { useState } from "react";
import { ChevronRight, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type AvisoSocio = { id: string; titulo: string; mensaje: string; cuando: string; nuevo: boolean };

const VISIBLES = 3;

/** Los avisos que la directiva publicó (Comunicado): los recientes resaltados y, si hay más, un botón para verlos todos. */
export function AvisosSocio({ avisos }: { avisos: AvisoSocio[] }) {
  const [todos, setTodos] = useState(false);
  const nuevos = avisos.filter((a) => a.nuevo).length;
  const lista = todos ? avisos : avisos.slice(0, VISIBLES);

  return (
    <section id="avisos" aria-label="Avisos del comité" className="scroll-mt-20 rounded-2xl bg-card p-6 shadow-[0_8px_24px_rgba(58,12,227,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold">Avisos del comité</p>
        {nuevos > 0 && <span className="rounded-full bg-[#FDEFEF] px-2 py-0.5 text-[11px] font-bold text-[#A32020]">{nuevos === 1 ? "1 nuevo" : `${nuevos} nuevos`}</span>}
      </div>

      {avisos.length === 0 ? (
        <p className="mt-4 rounded-xl bg-[#F8F7FC] p-4 text-sm text-[#5B5970]">Por ahora no hay avisos. Cuando tu comité publique uno, lo verás aquí.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {lista.map((a) => (
            <li key={a.id} className={cn("flex gap-3 rounded-xl p-3", a.nuevo ? "bg-[#FFF8EC] ring-1 ring-[#F6E3C4] ring-inset" : "bg-[#F8F7FC]")}>
              <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", a.nuevo ? "bg-[#FFE7C2] text-[#8A4B00]" : "bg-white text-[#3A0CE3]")}>
                <Megaphone className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-snug font-semibold">{a.titulo}</p>
                <p className="mt-0.5 text-[13px] leading-snug whitespace-pre-line text-[#5B5970]">{a.mensaje}</p>
                <p className="mt-1 text-[11px] text-[#8A8799]">{a.cuando}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {avisos.length > VISIBLES && (
        <button type="button" onClick={() => setTodos((v) => !v)} aria-expanded={todos} className="mt-3 flex w-full items-center justify-between rounded-xl px-1 py-2 text-[13px] font-semibold text-[#2A07A8] hover:underline">
          <span className="flex items-center gap-2">
            <Megaphone className="size-4" aria-hidden />
            {todos ? "Ver menos avisos" : "Ver todos los avisos"}
          </span>
          <ChevronRight className={cn("size-4 transition-transform", todos && "rotate-90")} aria-hidden />
        </button>
      )}
    </section>
  );
}
