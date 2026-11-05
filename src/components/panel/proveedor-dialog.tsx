"use client";

import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { eliminarProveedor, guardarProveedor, type ResultadoCompras } from "@/app/panel/compras/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProveedorFila } from "@/lib/compras-comun";
import { useConfirmar } from "@/components/ui/confirmar";

const campo = "h-10 px-3 text-[0.95rem]";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";

/** Crear un proveedor, o corregir uno que ya existe (y borrarlo, si no se necesita más). */
export function ProveedorDialog({ proveedor, onCerrar }: { proveedor: ProveedorFila | null; onCerrar: () => void }) {
  const { confirmar, dialogo } = useConfirmar();
  const [estado, enviar, pendiente] = useActionState<ResultadoCompras | null, FormData>(guardarProveedor, null);
  const [borrando, iniciarBorrado] = useTransition();
  const editando = proveedor !== null;

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Proveedor actualizado" : "Proveedor registrado");
      onCerrar();
    }
  }, [estado, editando, onCerrar]);

  async function borrar() {
    if (!proveedor) return;
    if (!(await confirmar({ titulo: `¿Borrar a «${proveedor.nombre}»?`, descripcion: "Sus compras se quedan con su nombre.", boton: "Borrar" }))) return;
    iniciarBorrado(async () => {
      const r = await eliminarProveedor(proveedor.id);
      if (r.ok) {
        toast.success("Proveedor borrado");
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
          <DialogTitle className="text-lg font-medium">{editando ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">A quién le compra tu comité.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="mt-2 flex flex-col gap-4">
          {editando && <input type="hidden" name="id" value={proveedor.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="prv-nombre" className={etiqueta}>
                Nombre
              </label>
              <Input id="prv-nombre" name="nombre" defaultValue={proveedor?.nombre} maxLength={120} className={campo} autoFocus required />
            </div>
            <div>
              <label htmlFor="prv-rut" className={etiqueta}>
                RUT (opcional)
              </label>
              <Input id="prv-rut" name="rut" defaultValue={proveedor?.rut ?? ""} placeholder="76.123.456-7" maxLength={20} className={campo} />
            </div>
            <div>
              <label htmlFor="prv-telefono" className={etiqueta}>
                Teléfono (opcional)
              </label>
              <Input id="prv-telefono" name="telefono" defaultValue={proveedor?.telefono ?? ""} maxLength={30} className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="prv-email" className={etiqueta}>
                Correo (opcional)
              </label>
              <Input id="prv-email" name="email" type="email" defaultValue={proveedor?.email ?? ""} maxLength={120} className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="prv-direccion" className={etiqueta}>
                Dirección (opcional)
              </label>
              <Input id="prv-direccion" name="direccion" defaultValue={proveedor?.direccion ?? ""} maxLength={200} className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="prv-notas" className={etiqueta}>
                Notas (opcional)
              </label>
              <Textarea id="prv-notas" name="notas" defaultValue={proveedor?.notas ?? ""} rows={2} maxLength={500} />
            </div>
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
                Borrar proveedor
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
                {editando ? "Guardar cambios" : "Registrar proveedor"}
              </Button>
            </div>
          </div>
        </form>
        {dialogo}
      </DialogContent>
    </Dialog>
  );
}
