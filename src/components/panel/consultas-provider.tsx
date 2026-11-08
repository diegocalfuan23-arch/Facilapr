"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * La caché de datos (TanStack Query) para las pantallas que ya pasaron a usarla. Se pone alrededor de cada página que la
 * necesita, no en todo el panel: así una pantalla que aún no migró no carga nada de más ni cambia su comportamiento.
 * Los datos se consideran frescos por 15 segundos; pasado ese tiempo se vuelven a pedir al volver a la pestaña.
 */
export function ConsultasProvider({ children }: { children: React.ReactNode }) {
  const [cliente] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 } } }));
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}
