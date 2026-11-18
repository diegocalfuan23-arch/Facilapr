"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { marcarSocioDeLabor } from "@/app/panel/lecturas/rutas-actions";
import type { SocioDeLabor } from "@/lib/labores-comun";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";

/**
 * Los socios de una ruta donde se hace una labor, cada uno con su «Hecho». Lo marca quien recorre la ruta (el administrador
 * o el operador) y de ahí sale el «3 de 5 socios» de la labor. Una labor ya hecha se ve sin poder cambiarla.
 */
export function SociosDeLaborEnRuta({ laborId, socios, bloqueada, abierto = false }: { laborId: string; socios: SocioDeLabor[]; bloqueada: boolean; abierto?: boolean }) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const hechos = socios.filter((s) => s.hecha).length;

  function marcar(s: SocioDeLabor) {
    setTrabajando(s.paradaId);
    iniciar(async () => {
      try {
        const r = await marcarSocioDeLabor(laborId, s.paradaId, !s.hecha);
        if (!r.ok) toast.error(r.error);
      } catch {
        toast.error("No pudimos guardar. Revisa tu conexión e inténtalo de nuevo.");
      } finally {
        setTrabajando(null);
      }
    });
  }

  if (socios.length === 0) return null;

  return (
    <details open={abierto} className="group mt-1.5 w-full rounded-xl bg-[#F8F7FC]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-[#2A07A8] [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
        <span>
          {hechos} de {socios.length} {socios.length === 1 ? "socio" : "socios"} hechos
        </span>
      </summary>
      <ul className="divide-y divide-[#EFEDF6] px-1 pb-1">
        {socios.map((s) => (
          <li key={s.paradaId}>
            <button
              type="button"
              disabled={bloqueada || trabajando !== null}
              onClick={() => marcar(s)}
              aria-pressed={s.hecha}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left enabled:hover:bg-white disabled:cursor-default"
            >
              <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", s.hecha ? "border-[#0A7A52] bg-[#0A7A52] text-white" : "border-[#CFCBE0] bg-white")}>
                {trabajando === s.paradaId ? <Loader2 className="size-3 animate-spin text-[#5B5970]" /> : s.hecha ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[14px] font-medium", s.hecha && "text-[#8B89A0]")}>{s.nombre}</span>
                {s.numeroCliente ? <span className={cn("block text-xs", GRIS)}>N° {s.numeroCliente}</span> : null}
              </span>
              {s.hecha ? <span className="shrink-0 text-xs font-semibold text-[#075A3C]">Hecho</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
