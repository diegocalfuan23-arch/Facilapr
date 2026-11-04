"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { crearCategoriaMov, eliminarCategoriaMov, renombrarCategoriaMov } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CategoriaMovimientoPropia, TipoMovimiento } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

/**
 * Las categorías de Caja: las crea el propio comité, una lista para egresos y otra para ingresos.
 * Se agregan, se renombran y se borran aquí. Al borrar una, sus movimientos quedan sin categoría.
 */
export function CategoriasCajaDialog({
  propias,
  onCerrar,
}: {
  propias: CategoriaMovimientoPropia[];
  onCerrar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoMovimiento>("EGRESO");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const lista = propias.filter((c) => c.tipo === tipo).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  function cambiarTipo(nuevo: TipoMovimiento) {
    setTipo(nuevo);
    setError(null);
    setEditandoId(null);
  }

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await crearCategoriaMov(tipo, nombre);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success("Categoría creada");
      setNombre("");
    });
  }

  function empezarEdicion(c: CategoriaMovimientoPropia) {
    setEditandoId(c.id);
    setNombreEditado(c.nombre);
    setErrorEdicion(null);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdicion(null);
  }

  function guardarEdicion(c: CategoriaMovimientoPropia) {
    if (nombreEditado.trim() === c.nombre) {
      cancelarEdicion();
      return;
    }
    setErrorEdicion(null);
    iniciar(async () => {
      const r = await renombrarCategoriaMov(c.id, nombreEditado);
      if (!r.ok) {
        setErrorEdicion(r.error);
        return;
      }
      toast.success("Categoría renombrada");
      cancelarEdicion();
    });
  }

  function borrar(c: CategoriaMovimientoPropia) {
    if (!window.confirm(`¿Borrar la categoría «${c.nombre}»? Los movimientos que la usan quedan sin categoría.`)) return;
    setBorrandoId(c.id);
    iniciar(async () => {
      const r = await eliminarCategoriaMov(c.id);
      setBorrandoId(null);
      if (r.ok) toast.success("Categoría borrada");
      else toast.error(r.error);
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Categorías de Caja</DialogTitle>
          <DialogDescription className="text-[0.9rem]">Para ordenar tus ingresos y egresos.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border p-1" role="tablist" aria-label="Tipo de categoría">
          {(
            [
              ["EGRESO", "Egresos"],
              ["INGRESO", "Ingresos"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={tipo === valor}
              onClick={() => cambiarTipo(valor)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-[0.9rem] font-medium transition-colors",
                tipo === valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {texto}
            </button>
          ))}
        </div>

        <form onSubmit={agregar} className="flex gap-2">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={tipo === "EGRESO" ? "Ej.: Luz, Reparaciones, Sueldos…" : "Ej.: Subsidio, Aportes, Cuotas…"}
            maxLength={40}
            className="h-10 flex-1 px-3 text-[0.95rem]"
            aria-label="Nombre de la categoría"
            autoFocus
          />
          <Button
            type="submit"
            className="h-10 rounded-full px-5 text-[0.95rem]"
            disabled={pendiente || nombre.trim().length < 2}
          >
            {pendiente && borrandoId === null && editandoId === null && <Loader2 className="animate-spin" />}
            Agregar
          </Button>
        </form>
        {error && (
          <p className="text-[0.8rem] text-destructive" role="alert">
            {error}
          </p>
        )}

        <section>
          <h3 className="mb-2 text-[0.8rem] font-medium tracking-wide text-muted-foreground uppercase">
            {tipo === "EGRESO" ? "Categorías de egresos" : "Categorías de ingresos"}
          </h3>
          {lista.length === 0 ? (
            <p className="text-[0.9rem] text-muted-foreground">Todavía no creaste ninguna.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {lista.map((c) => (
                <li key={c.id} className="px-4 py-2.5 text-[0.95rem]">
                  {editandoId === c.id ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Input
                          value={nombreEditado}
                          onChange={(e) => setNombreEditado(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              guardarEdicion(c);
                            }
                            if (e.key === "Escape") {
                              // Escape cierra el modal; aquí solo debe cancelar la edición.
                              e.stopPropagation();
                              cancelarEdicion();
                            }
                          }}
                          maxLength={40}
                          className="h-9 flex-1 px-3 text-[0.95rem]"
                          aria-label={`Nuevo nombre de ${c.nombre}`}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Guardar nombre"
                          className="shrink-0 text-emerald-700 dark:text-emerald-400"
                          disabled={pendiente || nombreEditado.trim().length < 2}
                          onClick={() => guardarEdicion(c)}
                        >
                          {pendiente ? <Loader2 className="animate-spin" /> : <Check />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Cancelar"
                          className="shrink-0 text-muted-foreground"
                          disabled={pendiente}
                          onClick={cancelarEdicion}
                        >
                          <X />
                        </Button>
                      </div>
                      {errorEdicion && (
                        <p className="text-[0.8rem] text-destructive" role="alert">
                          {errorEdicion}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">{c.nombre}</span>
                      <span className="flex shrink-0 items-center">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Renombrar ${c.nombre}`}
                          className="text-muted-foreground"
                          disabled={pendiente}
                          onClick={() => empezarEdicion(c)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Borrar ${c.nombre}`}
                          className="text-muted-foreground"
                          disabled={pendiente}
                          onClick={() => borrar(c)}
                        >
                          {borrandoId === c.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        </Button>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex justify-end">
          <Button variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
            Listo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
