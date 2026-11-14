"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { pagarConMercadoPago } from "@/app/socio/[slug]/pagar-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * «Pagar»: pide el link de pago de la boleta en el momento y lleva al socio a pagar. El del resumen es el botón grande blanco
 * sobre el fondo morado; el de cada fila de boletas, uno chico.
 */
export function BotonPagarPortal({ slug, boletaId, monto, variante }: { slug: string; boletaId: string; monto: string; variante: "hero" | "fila" }) {
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

  const hero = variante === "hero";
  return (
    <div className={cn("flex flex-col", hero ? "items-start gap-1.5" : "items-end gap-1")}>
      <Button
        onClick={pagar}
        disabled={cargando}
        className={cn(hero ? "h-11 rounded-xl bg-white px-5 font-semibold text-[#2A07A8] hover:bg-white/90" : "hidden h-9 rounded-lg px-3 font-semibold sm:inline-flex")}
      >
        {hero && <CreditCard className="size-4" />}
        {cargando ? "Abriendo…" : hero ? `Pagar ${monto}` : "Pagar"}
      </Button>
      {error && (
        <span role="alert" className={cn("max-w-[16rem] text-[0.78rem]", hero ? "text-[#FFC9C7]" : "text-destructive")}>
          {error}
        </span>
      )}
    </div>
  );
}
