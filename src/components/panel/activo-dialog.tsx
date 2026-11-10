"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { eliminarActivo, guardarActivo, type ResultadoActivos } from "@/app/panel/activos/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { CATEGORIAS_ACTIVO, type ActivoFila } from "@/lib/activos-comun";
import { useConfirmar } from "@/components/ui/confirmar";
import { avisarCambio } from "@/lib/avisos-datos";

const campo = "h-10 px-3 text-[0.95rem]";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Registrar un bien del comité, o corregir su ficha, su estado y su vida útil. */
export function ActivoDialog({ activo, onCerrar }: { activo: ActivoFila | null; onCerrar: () => void }) {
  const { confirmar, dialogo } = useConfirmar();
  const [estado, enviar, pendiente] = useActionState<ResultadoActivos | null, FormData>(guardarActivo, null);
  const [borrando, iniciarBorrado] = useTransition();
  const editando = activo !== null;
  const [costo, setCosto] = useState(activo?.costo ? String(activo.costo) : "");
  const [categoria, setCategoria] = useState(activo?.categoria ?? "BOMBA");
  const [vida, setVida] = useState(activo ? String(activo.vidaUtilAnios) : String(CATEGORIAS_ACTIVO[0].vida));

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Bien actualizado" : "Bien registrado");
      avisarCambio("caja", "activos");
      onCerrar();
    }
  }, [estado, editando, onCerrar]);

  // Al elegir la categoría de un bien nuevo, se propone la vida útil típica; se puede cambiar.
  function cambiarCategoria(valor: string) {
    setCategoria(valor);
    if (!editando) setVida(String(CATEGORIAS_ACTIVO.find((c) => c.valor === valor)?.vida ?? 5));
  }

  async function borrar() {
    if (!activo) return;
    if (!(await confirmar({ titulo: `¿Borrar «${activo.nombre}»?`, descripcion: `${activo.costoEnCaja ? "También se quita su costo de la Caja. " : ""}Si el bien ya no está, es mejor marcarlo como dado de baja.`, boton: "Borrar" }))) return;
    iniciarBorrado(async () => {
      const r = await eliminarActivo(activo.id);
      if (r.ok) {
        toast.success("Bien borrado");
        avisarCambio("caja", "activos");
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
          <DialogTitle className="text-lg font-medium">{editando ? "Editar bien" : "Nuevo activo fijo"}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">Un bien de largo plazo del comité: bomba, estanque, terreno, vehículo…</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="mt-2 flex flex-col gap-4">
          {editando && <input type="hidden" name="id" value={activo.id} />}
          <input type="hidden" name="costo" value={costo} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="act-nombre" className={etiqueta}>
                Nombre del bien
              </label>
              <Input id="act-nombre" name="nombre" defaultValue={activo?.nombre} placeholder="Ej.: Bomba sumergible 5 HP" maxLength={140} className={campo} autoFocus required />
            </div>
            <div>
              <label htmlFor="act-categoria" className={etiqueta}>
                Categoría
              </label>
              <select id="act-categoria" name="categoria" value={categoria} onChange={(e) => cambiarCategoria(e.target.value)} className={selectClase}>
                {CATEGORIAS_ACTIVO.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.texto}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="act-codigo" className={etiqueta}>
                Código (opcional)
              </label>
              <Input id="act-codigo" name="codigo" defaultValue={activo?.codigo ?? ""} placeholder="Ej.: B-01" maxLength={40} className={campo} />
            </div>
            <div>
              <label htmlFor="act-fecha" className={etiqueta}>
                Fecha de adquisición
              </label>
              <Input id="act-fecha" name="fechaAdquisicion" type="date" defaultValue={activo?.fechaAdquisicion ?? hoyEnChile()} className={campo} required />
            </div>
            <div>
              <label htmlFor="act-costo" className={etiqueta}>
                Costo de adquisición
              </label>
              <Input
                id="act-costo"
                value={costo ? `$${Number(costo).toLocaleString("es-CL")}` : ""}
                onChange={(e) => setCosto(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="$0"
                inputMode="numeric"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="act-vida" className={etiqueta}>
                Vida útil (años)
              </label>
              <Input
                id="act-vida"
                name="vidaUtilAnios"
                value={vida}
                onChange={(e) => setVida(e.target.value.replace(/\D/g, "").slice(0, 3))}
                inputMode="numeric"
                className={campo}
              />
              <p className="mt-1.5 text-[0.75rem] text-muted-foreground">0 si no se deprecia (por ejemplo, un terreno).</p>
            </div>
            <div>
              <label htmlFor="act-estado" className={etiqueta}>
                Estado
              </label>
              <select id="act-estado" name="estado" defaultValue={activo?.estado ?? "OPERATIVO"} className={selectClase}>
                <option value="OPERATIVO">Operativo</option>
                <option value="EN_REPARACION">En reparación</option>
                <option value="BAJA">Dado de baja</option>
              </select>
            </div>
            <div>
              <label htmlFor="act-ubicacion" className={etiqueta}>
                Ubicación (opcional)
              </label>
              <Input id="act-ubicacion" name="ubicacion" defaultValue={activo?.ubicacion ?? ""} placeholder="Sector, caseta o pozo" maxLength={160} className={campo} />
            </div>
            <div>
              <label htmlFor="act-responsable" className={etiqueta}>
                Responsable (opcional)
              </label>
              <Input id="act-responsable" name="responsable" defaultValue={activo?.responsable ?? ""} maxLength={120} className={campo} />
            </div>
            {costo && !activo?.costoEnCaja && (
              <label className="flex items-start gap-2 text-[0.9rem] sm:col-span-2">
                <input type="checkbox" name="registrarCosto" value="si" className="mt-0.5 size-4" />
                <span>
                  Anotar el costo como egreso en la Caja
                  <span className="mt-0.5 block text-[0.75rem] text-muted-foreground">Márcalo si lo compraste con la plata del comité y aún no lo registras. En un bien antiguo, déjalo sin marcar.</span>
                </span>
              </label>
            )}
            {activo?.costoEnCaja && <p className="text-[0.85rem] text-muted-foreground sm:col-span-2">El costo de este bien ya está en la Caja: si cambias el monto o la fecha, se ajusta allá.</p>}
            <div className="sm:col-span-2">
              <label htmlFor="act-notas" className={etiqueta}>
                Notas (opcional)
              </label>
              <Textarea id="act-notas" name="notas" defaultValue={activo?.notas ?? ""} rows={2} maxLength={500} />
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
                {editando ? "Guardar cambios" : "Registrar bien"}
              </Button>
            </div>
          </div>
        </form>
        {dialogo}
      </DialogContent>
    </Dialog>
  );
}
