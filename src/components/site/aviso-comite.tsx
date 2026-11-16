"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { avisarComiteQueBusco, type ResultadoAviso } from "@/app/socios/actions";

/** «¿Cuál es tu comité?»: el socio que no lo encuentra deja el nombre y la comuna, y a Facilapr le llega a quién escribirle. */
export function AvisoComite() {
  const [estado, enviar, pendiente] = useActionState<ResultadoAviso | null, FormData>(avisarComiteQueBusco, null);

  if (estado?.ok) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-lg bg-primary/5 px-4 py-3 text-[0.9rem] font-medium">
        <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
        Gracias, lo anotamos.
      </p>
    );
  }

  const campo = "h-10 w-full rounded-lg border border-border bg-background px-3 text-[0.9rem] outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  return (
    <form action={enviar} className="mt-4">
      <p className="text-[0.88rem] font-medium">¿Cuál es tu comité?</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input name="nombre" placeholder="Nombre del comité" aria-label="Nombre del comité" maxLength={80} required className={campo} />
        <input name="comuna" placeholder="Comuna" aria-label="Comuna" maxLength={60} required className={campo} />
        {/* Campo trampa: queda fuera de la vista y de la tabulación. */}
        <input name="sitio" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <button type="submit" disabled={pendiente} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[0.88rem] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70">
          {pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Avisar
        </button>
      </div>
      {estado && !estado.ok ? (
        <p role="alert" className="mt-2 text-[0.85rem] text-destructive">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
