"use client";

import Link from "next/link";
import { ArrowRight, Clock, ExternalLink, ListChecks } from "lucide-react";
import { RECORRIDOS, RECORRIDOS_NUEVOS } from "@/lib/recorridos";
import { lanzarRecorrido } from "@/components/panel/recorrido";

/** Lista de recorridos: cada uno lleva a su pantalla y la va explicando parte por parte. */
export function AyudaRecorridos() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Ayuda</h1>
        <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
          Elige un tema y la pantalla te muestra, parte por parte, cómo se usa.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[...RECORRIDOS, ...RECORRIDOS_NUEVOS].map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => lanzarRecorrido(r.id)}
            className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListChecks className="size-4.5" />
            </span>
            <div>
              <h2 className="text-[1rem] font-semibold">{r.titulo}</h2>
              <p className="mt-1 text-[0.87rem] leading-relaxed text-muted-foreground">
                {r.resumen}
              </p>
            </div>
            <div className="mt-auto flex w-full items-center justify-between pt-1">
              <span className="inline-flex items-center gap-3 font-mono text-[0.72rem] tracking-[0.06em] text-muted-foreground uppercase">
                <span>{r.pasos.length} pasos</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {r.minutos} min
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-[0.85rem] font-medium text-primary">
                Comenzar
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </button>
        ))}
      </div>

      <p className="text-[0.85rem] text-muted-foreground">
        ¿Necesitas algo para compartir con tu equipo?{" "}
        <Link
          href="/ayuda"
          target="_blank"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Guías con capturas de pantalla
          <ExternalLink className="size-3" />
        </Link>
      </p>
    </div>
  );
}
