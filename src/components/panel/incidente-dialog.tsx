"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { eliminarIncidente, guardarIncidente, type ResultadoIncidentes } from "@/app/panel/incidentes/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { TIPOS_INCIDENTE, type EstadoIncidente, type IncidenteFila } from "@/lib/incidentes-comun";

const campo = "h-10 px-3 text-[0.95rem]";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Registrar un incidente del sistema de agua, o actualizar cómo va (y cuánto costó repararlo). */
export function IncidenteDialog({ incidente, onCerrar }: { incidente: IncidenteFila | null; onCerrar: () => void }) {
  const [estado, enviar, pendiente] = useActionState<ResultadoIncidentes | null, FormData>(guardarIncidente, null);
  const [borrando, iniciarBorrado] = useTransition();
  const editando = incidente !== null;
  const [estadoInc, setEstadoInc] = useState<EstadoIncidente>(incidente?.estado ?? "ABIERTO");
  const [costo, setCosto] = useState(incidente?.costo ? String(incidente.costo) : "");

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Incidente actualizado" : "Incidente registrado");
      onCerrar();
    }
  }, [estado, editando, onCerrar]);

  function borrar() {
    if (!incidente) return;
    if (!window.confirm(`¿Borrar el incidente I-${incidente.numero}?${incidente.costoEnCaja ? " También se quita su costo de la Caja." : ""}`)) return;
    iniciarBorrado(async () => {
      const r = await eliminarIncidente(incidente.id);
      if (r.ok) {
        toast.success("Incidente borrado");
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
          <DialogTitle className="text-lg font-medium">{editando ? `Incidente I-${incidente.numero}` : "Nuevo incidente"}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">Una falla o evento del sistema de agua y cómo se resolvió.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="mt-2 flex flex-col gap-4">
          {editando && <input type="hidden" name="id" value={incidente.id} />}
          <input type="hidden" name="costo" value={costo} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="inc-titulo" className={etiqueta}>
                ¿Qué pasó?
              </label>
              <Input id="inc-titulo" name="titulo" defaultValue={incidente?.titulo} placeholder="Ej.: Fuga en la matriz de calle Los Aromos" maxLength={140} className={campo} autoFocus required />
            </div>
            <div>
              <label htmlFor="inc-tipo" className={etiqueta}>
                Tipo
              </label>
              <select id="inc-tipo" name="tipo" defaultValue={incidente?.tipo ?? "FUGA"} className={selectClase}>
                {TIPOS_INCIDENTE.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.texto}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inc-prioridad" className={etiqueta}>
                Prioridad
              </label>
              <select id="inc-prioridad" name="prioridad" defaultValue={incidente?.prioridad ?? "MEDIA"} className={selectClase}>
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
              </select>
            </div>
            <div>
              <label htmlFor="inc-fecha" className={etiqueta}>
                Fecha
              </label>
              <Input id="inc-fecha" name="fecha" type="date" defaultValue={incidente?.fecha ?? hoyEnChile()} className={campo} required />
            </div>
            <div>
              <label htmlFor="inc-lugar" className={etiqueta}>
                Lugar (opcional)
              </label>
              <Input id="inc-lugar" name="lugar" defaultValue={incidente?.lugar ?? ""} placeholder="Sector, calle o estanque" maxLength={160} className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="inc-descripcion" className={etiqueta}>
                Detalle (opcional)
              </label>
              <Textarea id="inc-descripcion" name="descripcion" defaultValue={incidente?.descripcion ?? ""} rows={2} maxLength={1000} />
            </div>
          </div>

          <h3 className="mt-2 text-[0.95rem] font-medium">Seguimiento</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="inc-estado" className={etiqueta}>
                Estado
              </label>
              <select
                id="inc-estado"
                name="estado"
                value={estadoInc}
                onChange={(e) => setEstadoInc(e.target.value as EstadoIncidente)}
                className={selectClase}
              >
                <option value="ABIERTO">Abierto</option>
                <option value="EN_REPARACION">En reparación</option>
                <option value="RESUELTO">Resuelto</option>
              </select>
            </div>
            <div>
              <label htmlFor="inc-responsable" className={etiqueta}>
                Responsable (opcional)
              </label>
              <Input id="inc-responsable" name="responsable" defaultValue={incidente?.responsable ?? ""} placeholder="Quién lo atiende" maxLength={120} className={campo} />
            </div>
            {estadoInc === "RESUELTO" && (
              <>
                <div>
                  <label htmlFor="inc-resolucion" className={etiqueta}>
                    Fecha de resolución
                  </label>
                  <Input id="inc-resolucion" name="fechaResolucion" type="date" defaultValue={incidente?.fechaResolucion ?? hoyEnChile()} className={campo} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="inc-solucion" className={etiqueta}>
                    Cómo se resolvió (opcional)
                  </label>
                  <Textarea id="inc-solucion" name="solucion" defaultValue={incidente?.solucion ?? ""} rows={2} maxLength={1000} />
                </div>
              </>
            )}
            <div>
              <label htmlFor="inc-costo" className={etiqueta}>
                Costo de la reparación (opcional)
              </label>
              <Input
                id="inc-costo"
                value={costo ? `$${Number(costo).toLocaleString("es-CL")}` : ""}
                onChange={(e) => setCosto(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="$0"
                inputMode="numeric"
                className={campo}
              />
            </div>
            {costo && !incidente?.costoEnCaja && (
              <label className="flex items-center gap-2 text-[0.9rem] sm:mt-7">
                <input type="checkbox" name="registrarCosto" value="si" defaultChecked className="size-4" />
                Anotarlo como egreso en la Caja
              </label>
            )}
            {incidente?.costoEnCaja && <p className="text-[0.85rem] text-muted-foreground sm:mt-7">Este costo ya está en la Caja: si lo cambias, se ajusta allá.</p>}
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
                {editando ? "Guardar cambios" : "Registrar incidente"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
