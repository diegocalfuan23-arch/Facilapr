"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatoCantidad, TEXTO_ORIGEN_STOCK, unidadCorta, type MovimientoStockFila } from "@/lib/inventario-comun";
import { cn } from "@/lib/utils";

const alto = "h-10";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por material o motivo…"
          className={cn(alto, "rounded-full px-5 text-[0.95rem] sm:w-80")}
          aria-label="Buscar en el historial"
        />
        <div className="relative sm:w-56">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
            aria-label="Tipo de movimiento"
            className={cn(
              alto,
              "w-full appearance-none rounded-xl border border-input bg-transparent pr-10 pl-4 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">
            {historial.length === 0 ? "Todavía no hay movimientos" : "Nada coincide con esa búsqueda"}
          </p>
          <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
            {historial.length === 0
              ? "Aquí queda anotado cada ajuste de stock, cada compra y cada corrección, con quién lo hizo."
              : "Prueba con otro material o cambia el tipo."}
          </p>
        </div>
      ) : (
        <>
          <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-192 border-collapse text-[0.95rem]">
              <thead>
                <tr className="border-b border-border bg-card">
                  {["Fecha", "Material", "Tipo", "Cantidad", "Quedó", "Motivo", "Quién"].map((c) => (
                    <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrado.map((h) => {
                  const entra = h.cantidad > 0;
                  return (
                    <tr key={h.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{cuando.format(new Date(h.fecha))}</td>
                      <td className="px-5 py-4 font-medium">{h.insumo}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-[0.8rem] font-medium",
                            entra
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                          )}
                        >
                          {entra ? "Entrada" : "Salida"}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-5 py-4 font-medium whitespace-nowrap tabular-nums",
                          entra ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {entra ? "+" : "−"}
                        {formatoCantidad(Math.abs(h.cantidad))} {unidadCorta(h.unidad)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap tabular-nums">
                        {formatoCantidad(h.stockResultante)} {unidadCorta(h.unidad)}
                      </td>
                      <td className="px-5 py-4">
                        <div>{TEXTO_ORIGEN_STOCK[h.origen]}</div>
                        {h.motivo && <div className="text-[0.8rem] text-muted-foreground">{h.motivo}</div>}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{h.quien ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {historial.length >= 300 && (
            <p className="text-[0.8rem] text-muted-foreground">Se muestran los últimos 300 movimientos.</p>
          )}
        </>
      )}
    </div>
  );
}
