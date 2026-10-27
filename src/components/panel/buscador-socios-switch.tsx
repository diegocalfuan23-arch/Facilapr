"use client";

import { useState } from "react";
import { cambiarApareceEnBuscador } from "@/app/panel/configuracion/buscador-actions";
import { Switch } from "@/components/ui/switch";

/** Interruptor: que el comité aparezca en el buscador público donde los socios encuentran su cuenta. */
export function BuscadorSociosSwitch({ inicial, tieneSlug }: { inicial: boolean; tieneSlug: boolean }) {
  const [aparece, setAparece] = useState(inicial);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(v: boolean) {
    setError(null);
    setAparece(v);
    const r = await cambiarApareceEnBuscador(v);
    if (!r.ok) {
      setAparece(!v);
      setError(r.error);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-border p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[1.05rem] font-semibold">Buscador de socios</h2>
          <p className="mt-1 text-[0.9rem] text-muted-foreground">
            Si lo activas, tus socios pueden encontrar a tu comité por nombre o comuna en facilapr.cl/socios y entrar a su
            cuenta desde ahí. Solo se muestra el nombre y la comuna de tu comité.
          </p>
          {!tieneSlug && (
            <p className="mt-2 text-[0.85rem] text-muted-foreground">Para activarlo, tu comité necesita su dirección propia (Mi sitio).</p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-[0.85rem] text-destructive">
              {error}
            </p>
          )}
        </div>
        <Switch checked={aparece} onCheckedChange={cambiar} disabled={!tieneSlug && !aparece} aria-label="Aparecer en el buscador de socios" />
      </div>
    </section>
  );
}
