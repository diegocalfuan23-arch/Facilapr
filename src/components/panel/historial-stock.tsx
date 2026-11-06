"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, History, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatoCantidad, TEXTO_ORIGEN_STOCK, unidadCorta, type MovimientoStockFila } from "@/lib/inventario-comun";
import { cn } from "@/lib/utils";

const alto = "h-11";

const cuando = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Santiago",
});

/**
 * El historial del inventario: cada vez que el stock de un material subió o bajó, con cuánto,
 * cuánto quedó, por qué y quién lo hizo. Sirve para saber a dónde fue el cloro o de dónde vino.
 */
export function HistorialStock({ historial, busquedaInicial }: { historial: MovimientoStockFila[]; busquedaInicial: string }) {
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [tipo, setTipo] = useState<"todos" | "entrada" | "salida">("todos");

  const q = busqueda.trim().toLowerCase();
  const filtrado = historial.filter((h) => {
    if (tipo === "entrada" && h.cantidad <= 0) return false;
    if (tipo === "salida" && h.cantidad >= 0) return false;
    if (q && !h.insumo.toLowerCase().includes(q) && !(h.motivo ?? "").toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por material o motivo"
            className={cn(alto, "rounded-full pr-4 pl-11 text-[0.95rem]")}
            aria-label="Buscar en el historial"
          />
        </div>
        <div className="relative sm:w-56">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
            aria-label="Tipo de movimiento"
            className={cn(
              alto,
              "w-full appearance-none rounded-full border border-input bg-transparent pr-10 pl-4 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            )}
          >
            <option value="todos">Entradas y salidas</option>
            <option value="entrada">Solo entradas</option>
            <option value="salida">Solo salidas</option>
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {filtrado.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <History className="mx-auto size-7 text-primary" aria-hidden />
          <p className="mt-2 text-[1.05rem] font-medium">{historial.length === 0 ? "Todavía no hay movimientos" : "Nada coincide con esa búsqueda"}</p>
          <p className="mx-auto mt-1 max-w-xl text-[0.95rem] text-muted-foreground">
            {historial.length === 0 ? "Aquí queda anotado cada ajuste de stock, cada compra y cada corrección, con quién lo hizo." : "Prueba con otro material o cambia el tipo."}
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[0_8px_24px_rgba(58,12,227,0.1)]">
            {filtrado.map((h) => {
              const entra = h.cantidad > 0;
              const Icono = entra ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={h.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      entra ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                    )}
                  >
                    <Icono className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.95rem] font-semibold">
                      {entra ? "Entrada" : "Salida"} de {h.insumo}
                    </p>
                    <p className="truncate text-[0.8rem] text-muted-foreground">
                      {TEXTO_ORIGEN_STOCK[h.origen]}
                      {h.motivo ? ` · ${h.motivo}` : ""}
                    </p>
                    <p className="truncate text-[0.75rem] text-muted-foreground tabular-nums">
                      {cuando.format(new Date(h.fecha))}
                      {h.quien ? ` · ${h.quien}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("font-bold tabular-nums", entra ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {entra ? "+" : "−"}
                      {formatoCantidad(Math.abs(h.cantidad))} {unidadCorta(h.unidad)}
                    </p>
                    <p className="text-[0.8rem] text-muted-foreground tabular-nums">
                      Quedan {formatoCantidad(h.stockResultante)} {unidadCorta(h.unidad)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {historial.length >= 300 && <p className="text-[0.8rem] text-muted-foreground">Se muestran los últimos 300 movimientos.</p>}
        </>
      )}
    </div>
  );
}
