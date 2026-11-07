"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { eliminarArranque, guardarArranque, type ResultadoArranques } from "@/app/panel/arranques/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmar } from "@/components/ui/confirmar";
import type { ArranqueFila, SocioAsignable } from "@/lib/arranques-comun";
import { cn } from "@/lib/utils";

const campo = "h-10 px-3 text-[0.95rem]";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Crear un arranque o corregir uno: su nombre, dónde está y qué socios abastece. */
export function ArranqueDialog({
  arranque,
  arranques,
  socios,
  onCerrar,
}: {
  arranque: ArranqueFila | null;
  /** Todos los arranques, para decir en cuál está ya cada socio. */
  arranques: ArranqueFila[];
  socios: SocioAsignable[];
  onCerrar: () => void;
}) {
  const { confirmar, dialogo } = useConfirmar();
  const [estado, enviar, pendiente] = useActionState<ResultadoArranques | null, FormData>(guardarArranque, null);
  const [borrando, iniciarBorrado] = useTransition();
  const editando = arranque !== null;
  const [elegidos, setElegidos] = useState<Set<string>>(() => new Set(arranque?.socios.map((s) => s.id) ?? []));
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Arranque actualizado" : "Arranque registrado");
      onCerrar();
    }
  }, [estado, editando, onCerrar]);

  const nombreDe = useMemo(() => new Map(arranques.map((a) => [a.id, a.nombre])), [arranques]);

  const visibles = useMemo(() => {
    const q = sinTildes(busca.trim());
    const lista = socios.filter((s) => !q || sinTildes(`${s.nombre} ${s.numero ?? ""} ${s.rut ?? ""}`).includes(q));
    // Los ya elegidos primero, para verlos sin buscar.
    return [...lista].sort((a, b) => Number(elegidos.has(b.id)) - Number(elegidos.has(a.id))).slice(0, 120);
  }, [socios, busca, elegidos]);

  function alternar(id: string) {
    setElegidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  async function borrar() {
    if (!arranque) return;
    if (!(await confirmar({ titulo: `¿Borrar «${arranque.nombre}»?`, descripcion: "Los socios no se borran: solo dejan de estar asignados a este arranque.", boton: "Borrar" }))) return;
    iniciarBorrado(async () => {
      const r = await eliminarArranque(arranque.id);
      if (r.ok) {
        toast.success("Arranque borrado");
        onCerrar();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-xl sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">{editando ? "Editar arranque" : "Nuevo arranque"}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">Un punto de conexión de la red y los socios que abastece.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="mt-2 flex flex-col gap-4">
          {editando && <input type="hidden" name="id" value={arranque.id} />}
          <input type="hidden" name="socios" value={JSON.stringify([...elegidos])} />

          <div>
            <label htmlFor="arr-nombre" className={etiqueta}>
              Nombre
            </label>
            <Input id="arr-nombre" name="nombre" defaultValue={arranque?.nombre} placeholder="Ej.: Arranque 12 o Pasaje Los Aromos" maxLength={120} className={campo} autoFocus required />
          </div>
          <div>
            <label htmlFor="arr-ubicacion" className={etiqueta}>
              Dónde está (opcional)
            </label>
            <Input id="arr-ubicacion" name="ubicacion" defaultValue={arranque?.ubicacion ?? ""} placeholder="Sector, calle o referencia" maxLength={200} className={campo} />
          </div>
          <div>
            <label htmlFor="arr-notas" className={etiqueta}>
              Notas (opcional)
            </label>
            <Textarea id="arr-notas" name="notas" defaultValue={arranque?.notas ?? ""} rows={2} maxLength={500} />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <span className="text-[0.8rem] font-medium">Socios que abastece</span>
              <span className="text-[0.8rem] text-muted-foreground tabular-nums">
                {elegidos.size} {elegidos.size === 1 ? "socio" : "socios"}
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar socio por nombre, N.º o RUT" aria-label="Buscar socio" className={cn(campo, "pl-9")} />
            </div>
            <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {visibles.length === 0 ? (
                <li className="px-3 py-3 text-[0.85rem] text-muted-foreground">{socios.length === 0 ? "Aún no hay socios cargados." : "Ningún socio coincide."}</li>
              ) : (
                visibles.map((s) => {
                  const enOtro = s.arranqueId && s.arranqueId !== arranque?.id ? nombreDe.get(s.arranqueId) : null;
                  return (
                    <li key={s.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                        <input type="checkbox" checked={elegidos.has(s.id)} onChange={() => alternar(s.id)} className="size-4 accent-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.9rem] font-medium">
                            {s.numero ? `N.º ${s.numero} · ` : ""}
                            {s.nombre}
                          </span>
                          {enOtro && elegidos.has(s.id) ? (
                            <span className="block text-[0.75rem] text-amber-700 dark:text-amber-300">Hoy está en «{enOtro}»: se moverá a este arranque</span>
                          ) : enOtro ? (
                            <span className="block text-[0.75rem] text-muted-foreground">Ya está en «{enOtro}»</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {estado && !estado.ok && (
            <p className="text-[0.8rem] text-destructive" role="alert">
              {estado.error}
            </p>
          )}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {editando ? (
              <Button type="button" variant="ghost" className="h-10 px-4 text-[0.95rem] text-destructive" onClick={borrar} disabled={borrando || pendiente}>
                {borrando && <Loader2 className="animate-spin" />}
                Borrar arranque
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" className="h-10 rounded-full px-5 text-[0.95rem]" disabled={pendiente || borrando}>
                {pendiente && <Loader2 className="animate-spin" />}
                {editando ? "Guardar cambios" : "Registrar arranque"}
              </Button>
            </div>
          </div>
        </form>
        {dialogo}
      </DialogContent>
    </Dialog>
  );
}
