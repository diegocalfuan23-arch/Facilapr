"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { eliminarTrabajador, guardarTrabajador, type ResultadoPersonal } from "@/app/panel/personal/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CARGOS_SUGERIDOS, type TrabajadorFila } from "@/lib/personal-comun";

const campo = "h-10 px-3 text-[0.95rem]";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Agregar a una persona del comité, o corregir su ficha. */
export function TrabajadorDialog({ persona, onCerrar }: { persona: TrabajadorFila | null; onCerrar: () => void }) {
  const [estado, enviar, pendiente] = useActionState<ResultadoPersonal | null, FormData>(guardarTrabajador, null);
  const [borrando, iniciarBorrado] = useTransition();
  const editando = persona !== null;
  const [sueldo, setSueldo] = useState(persona?.sueldo ? String(persona.sueldo) : "");

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Ficha actualizada" : "Persona agregada");
      onCerrar();
    }
  }, [estado, editando, onCerrar]);

  function borrar() {
    if (!persona) return;
    if (!window.confirm(`¿Borrar a «${persona.nombre}»?`)) return;
    iniciarBorrado(async () => {
      const r = await eliminarTrabajador(persona.id);
      if (r.ok) {
        toast.success("Persona borrada");
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
          <DialogTitle className="text-lg font-medium">{editando ? "Editar ficha" : "Nueva persona"}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">Quien trabaja para el comité y cobra por ello.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="mt-2 flex flex-col gap-4">
          {editando && <input type="hidden" name="id" value={persona.id} />}
          <input type="hidden" name="sueldo" value={sueldo} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="per-nombre" className={etiqueta}>
                Nombre
              </label>
              <Input id="per-nombre" name="nombre" defaultValue={persona?.nombre} maxLength={120} className={campo} autoFocus required />
            </div>
            <div>
              <label htmlFor="per-cargo" className={etiqueta}>
                Cargo
              </label>
              <Input id="per-cargo" name="cargo" list="per-cargos" defaultValue={persona?.cargo} maxLength={60} className={campo} required />
              <datalist id="per-cargos">
                {CARGOS_SUGERIDOS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="per-rut" className={etiqueta}>
                RUT (opcional)
              </label>
              <Input id="per-rut" name="rut" defaultValue={persona?.rut ?? ""} placeholder="12.345.678-9" maxLength={20} className={campo} />
            </div>
            <div>
              <label htmlFor="per-contrato" className={etiqueta}>
                Forma de pago
              </label>
              <select id="per-contrato" name="contrato" defaultValue={persona?.contrato ?? "SUELDO"} className={selectClase}>
                <option value="SUELDO">Sueldo</option>
                <option value="HONORARIO">Honorarios</option>
              </select>
            </div>
            <div>
              <label htmlFor="per-sueldo" className={etiqueta}>
                Monto mensual
              </label>
              <Input
                id="per-sueldo"
                value={sueldo ? `$${Number(sueldo).toLocaleString("es-CL")}` : ""}
                onChange={(e) => setSueldo(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="$0"
                inputMode="numeric"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="per-telefono" className={etiqueta}>
                Teléfono (opcional)
              </label>
              <Input id="per-telefono" name="telefono" defaultValue={persona?.telefono ?? ""} maxLength={30} className={campo} />
            </div>
            <div>
              <label htmlFor="per-ingreso" className={etiqueta}>
                Fecha de ingreso (opcional)
              </label>
              <Input id="per-ingreso" name="fechaIngreso" type="date" defaultValue={persona?.fechaIngreso ?? ""} className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="per-email" className={etiqueta}>
                Correo (opcional)
              </label>
              <Input id="per-email" name="email" type="email" defaultValue={persona?.email ?? ""} maxLength={120} className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="per-notas" className={etiqueta}>
                Notas (opcional)
              </label>
              <Textarea id="per-notas" name="notas" defaultValue={persona?.notas ?? ""} rows={2} maxLength={500} />
            </div>
            {editando && (
              <div className="sm:col-span-2">
                <label htmlFor="per-activo" className={etiqueta}>
                  Estado
                </label>
                <select id="per-activo" name="activo" defaultValue={persona.activo ? "si" : "no"} className={selectClase}>
                  <option value="si">Activo</option>
                  <option value="no">Inactivo (ya no trabaja en el comité)</option>
                </select>
              </div>
            )}
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
                Borrar
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
                {editando ? "Guardar cambios" : "Agregar persona"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
