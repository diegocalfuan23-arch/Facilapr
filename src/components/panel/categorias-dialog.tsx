"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { crearCategoria, eliminarCategoria } from "@/app/panel/inventario/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CategoriaPropia } from "@/lib/inventario-comun";

/**
 * Las categorías del inventario: las crea el propio comité, según lo que guarda en bodega.
 * Se agregan y se borran aquí. Al borrar una, sus materiales quedan sin categoría.
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
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

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
      setNombre("");
    });
  }

  function borrar(c: CategoriaPropia) {
    const n = usos[c.id] ?? 0;
    const aviso = n > 0 ? ` ${n === 1 ? "Su material queda" : `Sus ${n} materiales quedan`} sin categoría.` : "";
    if (!window.confirm(`¿Borrar la categoría «${c.nombre}»?${aviso}`)) return;
    setBorrandoId(c.id);
    iniciar(async () => {
      const r = await eliminarCategoria(c.id);
      setBorrandoId(null);
      if (r.ok) toast.success("Categoría borrada");
      else toast.error(r.error);
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Categorías del inventario</DialogTitle>
          <DialogDescription className="text-[0.9rem]">
            Crea las categorías que necesita tu bodega. Aparecen al registrar un material y en el filtro. También puedes crearlas directo desde el formulario del material.
          </DialogDescription>
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
          <Button type="submit" className="h-10 rounded-full px-5 text-[0.95rem]" disabled={pendiente || nombre.trim().length < 2}>
            {pendiente && borrandoId === null && <Loader2 className="animate-spin" />}
            Agregar
          </Button>
        </form>
        {error && (
          <p className="text-[0.8rem] text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 flex flex-col gap-4">
          <section>
            <h3 className="mb-2 text-[0.8rem] font-medium tracking-wide text-muted-foreground uppercase">Tus categorías</h3>
            {propias.length === 0 ? (
              <p className="text-[0.9rem] text-muted-foreground">Todavía no creaste ninguna. Escribe una arriba, por ejemplo «Válvulas» o «Cloro».</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {propias.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[0.95rem]">
                    <span className="min-w-0 truncate">
                      {c.nombre}
                      <span className="ml-2 text-[0.8rem] text-muted-foreground">
                        {usos[c.id] ?? 0} {(usos[c.id] ?? 0) === 1 ? "material" : "materiales"}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Borrar ${c.nombre}`}
                      className="shrink-0 text-muted-foreground"
                      disabled={pendiente}
                      onClick={() => borrar(c)}
                    >
                      {borrandoId === c.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="mt-2 flex justify-end">
          <Button variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
            Listo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
