"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { crearCategoria, eliminarCategoria, renombrarCategoria } from "@/app/panel/inventario/actions";
import { avisarCambio } from "@/lib/avisos-datos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CategoriaPropia } from "@/lib/inventario-comun";
import { useConfirmar } from "@/components/ui/confirmar";

/**
 * Las categorías del inventario: las crea el propio comité, según lo que guarda en bodega.
 * Se agregan, se renombran y se borran aquí. Al borrar una, sus materiales quedan sin categoría.
 */
export function CategoriasDialog({
  propias,
  usos,
  onCerrar,
}: {
  propias: CategoriaPropia[];
  /** Cuántos materiales usa cada categoría propia, por id. */
  usos: Record<string, number>;
  onCerrar: () => void;
}) {
  const { confirmar, dialogo } = useConfirmar();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await crearCategoria(nombre);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success("Categoría creada");
      avisarCambio("inventario");
      setNombre("");
    });
  }

  function empezarEdicion(c: CategoriaPropia) {
    setEditandoId(c.id);
    setNombreEditado(c.nombre);
    setErrorEdicion(null);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdicion(null);
  }

  function guardarEdicion(c: CategoriaPropia) {
    // Sin cambios: no hay nada que guardar.
    if (nombreEditado.trim() === c.nombre) {
      cancelarEdicion();
      return;
    }
    setErrorEdicion(null);
    iniciar(async () => {
      const r = await renombrarCategoria(c.id, nombreEditado);
      if (!r.ok) {
        setErrorEdicion(r.error);
        return;
      }
      toast.success("Categoría renombrada");
      avisarCambio("inventario");
      cancelarEdicion();
    });
  }

  async function borrar(c: CategoriaPropia) {
    const n = usos[c.id] ?? 0;
    const aviso = n > 0 ? ` ${n === 1 ? "Su material queda" : `Sus ${n} materiales quedan`} sin categoría.` : "";
    if (!(await confirmar({ titulo: `¿Borrar la categoría «${c.nombre}»?`, descripcion: aviso.trim() || "No se puede deshacer.", boton: "Borrar" }))) return;
    setBorrandoId(c.id);
    iniciar(async () => {
      const r = await eliminarCategoria(c.id);
      setBorrandoId(null);
      if (r.ok) {
        toast.success("Categoría borrada");
        avisarCambio("inventario");
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Categorías del inventario</DialogTitle>
          <DialogDescription className="text-[0.9rem]">Para ordenar los materiales de tu bodega.</DialogDescription>
        </DialogHeader>

        <form onSubmit={agregar} className="mt-2 flex gap-2">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej.: Válvulas, Pintura, Uniformes…"
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

        <section className="mt-2">
          <h3 className="mb-2 text-[0.8rem] font-medium tracking-wide text-muted-foreground uppercase">Tus categorías</h3>
          {propias.length === 0 ? (
            <p className="text-[0.9rem] text-muted-foreground">Todavía no creaste ninguna.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {propias.map((c) => (
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
                      <span className="min-w-0 truncate">
                        {c.nombre}
                        <span className="ml-2 text-[0.8rem] text-muted-foreground">
                          {usos[c.id] ?? 0} {(usos[c.id] ?? 0) === 1 ? "material" : "materiales"}
                        </span>
                      </span>
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

        <div className="mt-2 flex justify-end">
          <Button variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
            Listo
          </Button>
        </div>
        {dialogo}
      </DialogContent>
    </Dialog>
  );
}
