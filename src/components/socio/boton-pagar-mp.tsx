"use client";

import { useState } from "react";
import { pagarConMercadoPago } from "@/app/socio/[slug]/pagar-actions";

/** «Pagar con Mercado Pago»: pide el link en el momento y lleva al socio a pagar. */
export function BotonPagarMp({ slug, boletaId }: { slug: string; boletaId: string }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pagar() {
    setError(null);
    setCargando(true);
    const r = await pagarConMercadoPago(slug, boletaId);
    if (r.ok) {
      window.location.href = r.url;
      return;
    }
    setCargando(false);
    setError(r.error);
  }

  return (
    <div className="mt-2 flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={pagar}
        disabled={cargando}
        className="rounded-lg bg-primary px-3.5 py-2 text-[0.85rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {cargando ? "Abriendo…" : "Pagar con Mercado Pago"}
      </button>
      {error && (
        <span role="alert" className="max-w-[16rem] text-[0.78rem] text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
