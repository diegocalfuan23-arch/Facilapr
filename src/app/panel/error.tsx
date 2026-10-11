"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Pantalla de error del panel. A diferencia de la genérica de Next, mantiene el
 * menú lateral y muestra qué falló: si una sección se cae, el resto del panel
 * sigue disponible y el mensaje sirve para diagnosticar.
 */
export default function ErrorPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error en el panel:", error);
  }, [error]);

  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <h1 className="mt-4 text-[1.05rem] font-semibold">
        Esta sección no pudo cargarse
      </h1>
      <p className="mt-2 text-[0.9rem] leading-relaxed text-muted-foreground">
        El resto del panel sigue funcionando. Reintenta, y si vuelve a pasar,
        avísanos con el detalle de abajo.
      </p>

      <pre className="mt-4 max-h-40 w-full overflow-auto rounded-lg bg-muted/60 p-3 text-left font-mono text-[0.72rem] leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {error.message || "Sin mensaje"}
        {error.digest ? `\nid: ${error.digest}` : ""}
      </pre>

      <Button className="mt-5" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
