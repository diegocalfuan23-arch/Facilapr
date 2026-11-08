"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { escucharCambios } from "@/lib/avisos-datos";

/**
 * La caché de datos (TanStack Query) para las pantallas que ya pasaron a usarla. Se pone alrededor de cada página que la
 * necesita, no en todo el panel: así una pantalla que aún no migró no carga nada de más ni cambia su comportamiento.
 * Los datos se consideran frescos por 15 segundos; pasado ese tiempo se vuelven a pedir al volver a la pestaña.
 * Además escucha los avisos de las otras pestañas del navegador: si una registró un pago, esta lo vuelve a pedir al instante.
 */
export function ConsultasProvider({ children }: { children: React.ReactNode }) {
  const [cliente] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 } } }));
  useEffect(() => escucharCambios((claves) => claves.forEach((k) => void cliente.invalidateQueries({ queryKey: [k] }))), [cliente]);
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}
