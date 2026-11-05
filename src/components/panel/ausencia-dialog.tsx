"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { eliminarAusencia, guardarAusencia, type ResultadoAusencias } from "@/app/panel/ausencias/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { diasDe, TEXTO_TIPO_AUSENCIA, type AusenciaFila, type TipoAusencia } from "@/lib/rrhh-comun";

const campo = "h-10 px-3 text-[0.95rem]";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Registrar unas vacaciones, una licencia médica o un permiso. Los días se calculan solos. */
export function AusenciaDialog({
  ausencia,
  tipo,
  personas,
  onCerrar,
}: {
  ausencia: AusenciaFila | null;
  /** Lo que se registra: vacaciones o licencia (los permisos se eligen dentro de Vacaciones). */
  tipo: TipoAusencia;
  personas: { id: string; nombre: string }[];
  onCerrar: () => void;
}) {
  const [estado, enviar, pendiente] = useActionState<ResultadoAusencias | null, FormData>(guardarAusencia, null);
  const [borrando, iniciarBorrado] = useTransition();
  const editando = ausencia !== null;
  const [tipoActual, setTipoActual] = useState<TipoAusencia>(ausencia?.tipo ?? tipo);
  const [desde, setDesde] = useState(ausencia?.desde ?? hoyEnChile());
  const [hasta, setHasta] = useState(ausencia?.hasta ?? hoyEnChile());
  const dias = hasta >= desde ? diasDe(tipoActual, desde, hasta) : 0;
  const esLicencia = tipoActual === "LICENCIA";

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Registro actualizado" : "Registro guardado");
      onCerrar();
    }
  }, [estado, editando, onCerrar]);

  function borrar() {
    if (!ausencia) return;
    if (!window.confirm("¿Borrar este registro?")) return;
    iniciarBorrado(async () => {
      const r = await eliminarAusencia(ausencia.id);
      if (r.ok) {
        toast.success("Registro borrado");
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
          <DialogTitle className="text-lg font-medium">
            {editando ? "Editar" : "Nuevo"} · {TEXTO_TIPO_AUSENCIA[tipoActual].toLowerCase()}
          </DialogTitle>
          <DialogDescription className="text-[0.9rem]">
            {esLicencia ? "Los días de una licencia se cuentan corridos." : "Los días se cuentan hábiles, de lunes a viernes."}
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="mt-2 flex flex-col gap-4">
          {editando && <input type="hidden" name="id" value={ausencia.id} />}
          <input type="hidden" name="tipo" value={tipoActual} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className={tipo === "VACACIONES" ? "" : "sm:col-span-2"}>
              <label htmlFor="aus-persona" className={etiqueta}>
                Persona
              </label>
              <select id="aus-persona" name="trabajadorId" defaultValue={ausencia?.trabajadorId ?? ""} className={selectClase} required>
                <option value="" disabled>
                  Elige a la persona…
                </option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            {tipo === "VACACIONES" && (
              <div>
                <label htmlFor="aus-tipo" className={etiqueta}>
                  Tipo
                </label>
                <select id="aus-tipo" value={tipoActual} onChange={(e) => setTipoActual(e.target.value as TipoAusencia)} className={selectClase}>
                  <option value="VACACIONES">Vacaciones</option>
                  <option value="PERMISO">Permiso</option>
                </select>
              </div>
            )}
            <div>
              <label htmlFor="aus-desde" className={etiqueta}>
                Desde
              </label>
              <Input id="aus-desde" name="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={campo} required />
            </div>
            <div>
              <label htmlFor="aus-hasta" className={etiqueta}>
                Hasta
              </label>
              <Input id="aus-hasta" name="hasta" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className={campo} required />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <span className="text-[0.9rem] text-muted-foreground">{esLicencia ? "Días corridos" : "Días hábiles"}</span>
            <span className="text-[1.25rem] font-bold tabular-nums">{dias}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="aus-estado" className={etiqueta}>
                Estado
              </label>
              <select id="aus-estado" name="estado" defaultValue={ausencia?.estado ?? "APROBADA"} className={selectClase}>
                <option value="APROBADA">Aprobada</option>
                <option value="SOLICITADA">Solicitada</option>
                <option value="RECHAZADA">Rechazada</option>
              </select>
            </div>
            <div>
              <label htmlFor="aus-detalle" className={etiqueta}>
                {esLicencia ? "Folio o motivo (opcional)" : "Detalle (opcional)"}
              </label>
              <Input id="aus-detalle" name="detalle" defaultValue={ausencia?.detalle ?? ""} maxLength={200} className={campo} />
            </div>
            {tipoActual === "PERMISO" && (
              <label className="flex items-center gap-2 text-[0.9rem] sm:col-span-2">
                <input type="checkbox" name="sinGoce" value="si" defaultChecked={ausencia?.sinGoce ?? false} className="size-4" />
                Sin goce de sueldo (esos días se descuentan de la remuneración)
              </label>
            )}
            <div className="sm:col-span-2">
              <label htmlFor="aus-nota" className={etiqueta}>
                Nota (opcional)
              </label>
              <Textarea id="aus-nota" name="nota" defaultValue={ausencia?.nota ?? ""} rows={2} maxLength={500} />
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
                {editando ? "Guardar cambios" : "Guardar"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
