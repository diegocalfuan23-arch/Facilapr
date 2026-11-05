"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { eliminarLabor, guardarLabor, type ResultadoLabores } from "@/app/panel/labores/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { formatoCantidad, unidadCorta, type Insumo } from "@/lib/inventario-comun";
import { TIPOS_LABOR, type EstadoLabor, type LaborFila } from "@/lib/labores-comun";
import { cn } from "@/lib/utils";

const campo = "h-10 px-3 text-[0.95rem]";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type Linea = { clave: number; insumoId: string; cantidad: string };

/** Registrar una labor del comité y los materiales del inventario que usa. */
export function LaborDialog({ labor, insumos, onCerrar }: { labor: LaborFila | null; insumos: Insumo[]; onCerrar: () => void }) {
  const [resultado, enviar, pendiente] = useActionState<ResultadoLabores | null, FormData>(guardarLabor, null);
  const [borrando, iniciarBorrado] = useTransition();
  const editando = labor !== null;
  const [estado, setEstado] = useState<EstadoLabor>(labor?.estado ?? "PROGRAMADA");
  const [lineas, setLineas] = useState<Linea[]>(
    (labor?.materiales ?? []).filter((m) => m.insumoId).map((m, i) => ({ clave: i, insumoId: m.insumoId as string, cantidad: String(m.cantidad) }))
  );
  const [siguiente, setSiguiente] = useState(100);

  useEffect(() => {
    if (resultado?.ok) {
      toast.success(editando ? "Labor actualizada" : "Labor registrada");
      onCerrar();
    }
  }, [resultado, editando, onCerrar]);

  const delInventario = new Map(insumos.map((i) => [i.id, i]));
  // El stock disponible de un material: si esta labor ya lo descontó, lo que se ve en inventario ya no incluye su cantidad.
  const yaDescontado = (insumoId: string) => (labor?.descontada ? (labor.materiales.find((m) => m.insumoId === insumoId)?.cantidad ?? 0) : 0);

  function cambiar(clave: number, parte: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...parte } : l)));
  }

  const materiales = JSON.stringify(
    lineas.filter((l) => l.insumoId && Number(l.cantidad.replace(",", ".")) > 0).map((l) => ({ insumoId: l.insumoId, cantidad: Number(l.cantidad.replace(",", ".")) }))
  );

  function borrar() {
    if (!labor) return;
    if (!window.confirm(`¿Borrar la labor L-${labor.numero}?${labor.descontada ? " Los materiales que descontó vuelven al inventario." : ""}`)) return;
    iniciarBorrado(async () => {
      const r = await eliminarLabor(labor.id);
      if (r.ok) {
        toast.success("Labor borrada");
        onCerrar();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-2xl sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">{editando ? `Labor L-${labor.numero}` : "Nueva labor"}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">Un trabajo del comité y los materiales que usa. Al marcarla como hecha, se descuentan del inventario.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="mt-2 flex flex-col gap-4">
          {editando && <input type="hidden" name="id" value={labor.id} />}
          <input type="hidden" name="materiales" value={materiales} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="lab-titulo" className={etiqueta}>
                ¿Qué se hace?
              </label>
              <Input id="lab-titulo" name="titulo" defaultValue={labor?.titulo} placeholder="Ej.: Cambio de medidores del sector norte" maxLength={140} className={campo} autoFocus required />
            </div>
            <div>
              <label htmlFor="lab-tipo" className={etiqueta}>
                Tipo
              </label>
              <select id="lab-tipo" name="tipo" defaultValue={labor?.tipo ?? "MANTENCION"} className={selectClase}>
                {TIPOS_LABOR.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.texto}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lab-estado" className={etiqueta}>
                Estado
              </label>
              <select id="lab-estado" name="estado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoLabor)} className={selectClase}>
                <option value="PROGRAMADA">Programada</option>
                <option value="EN_CURSO">En curso</option>
                <option value="HECHA">Hecha</option>
              </select>
            </div>
            <div>
              <label htmlFor="lab-fecha" className={etiqueta}>
                Fecha
              </label>
              <Input id="lab-fecha" name="fecha" type="date" defaultValue={labor?.fecha ?? hoyEnChile()} className={campo} required />
            </div>
            {estado === "HECHA" ? (
              <div>
                <label htmlFor="lab-termino" className={etiqueta}>
                  Fecha en que se terminó
                </label>
                <Input id="lab-termino" name="fechaTermino" type="date" defaultValue={labor?.fechaTermino ?? hoyEnChile()} className={campo} />
              </div>
            ) : (
              <div />
            )}
            <div>
              <label htmlFor="lab-lugar" className={etiqueta}>
                Lugar (opcional)
              </label>
              <Input id="lab-lugar" name="lugar" defaultValue={labor?.lugar ?? ""} placeholder="Sector, caseta o pozo" maxLength={160} className={campo} />
            </div>
            <div>
              <label htmlFor="lab-responsable" className={etiqueta}>
                Responsable (opcional)
              </label>
              <Input id="lab-responsable" name="responsable" defaultValue={labor?.responsable ?? ""} maxLength={120} className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="lab-desc" className={etiqueta}>
                Detalle (opcional)
              </label>
              <Textarea id="lab-desc" name="descripcion" defaultValue={labor?.descripcion ?? ""} rows={2} maxLength={1000} />
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[0.9rem] font-semibold">Materiales del inventario</h3>
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-[0.8rem]"
                disabled={insumos.length === 0}
                onClick={() => {
                  setLineas((ls) => [...ls, { clave: siguiente, insumoId: "", cantidad: "" }]);
                  setSiguiente((n) => n + 1);
                }}
              >
                <Plus />
                Agregar material
              </Button>
            </div>

            {insumos.length === 0 && <p className="mt-3 text-[0.85rem] text-muted-foreground">Primero carga materiales en Inventario para poder usarlos aquí.</p>}

            {lineas.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {lineas.map((l) => {
                  const mat = delInventario.get(l.insumoId);
                  const disponible = mat ? mat.stock + yaDescontado(mat.id) : 0;
                  const cantidad = Number(l.cantidad.replace(",", ".")) || 0;
                  const falta = estado === "HECHA" && mat && cantidad > disponible;
                  return (
                    <div key={l.clave} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Material"
                          value={l.insumoId}
                          onChange={(e) => cambiar(l.clave, { insumoId: e.target.value })}
                          className={cn(selectClase, "min-w-0 flex-1")}
                        >
                          <option value="">Elige un material…</option>
                          {insumos.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.nombre} ({formatoCantidad(i.stock + yaDescontado(i.id))} {unidadCorta(i.unidad)})
                            </option>
                          ))}
                        </select>
                        <Input
                          aria-label="Cantidad"
                          value={l.cantidad}
                          onChange={(e) => cambiar(l.clave, { cantidad: e.target.value.replace(/[^\d.,]/g, "").slice(0, 10) })}
                          inputMode="decimal"
                          placeholder="Cant."
                          className={cn(campo, "w-24 shrink-0")}
                        />
                        <span className="w-10 shrink-0 text-[0.8rem] text-muted-foreground">{mat ? unidadCorta(mat.unidad) : ""}</span>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar material" onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}>
                          <X />
                        </Button>
                      </div>
                      {falta && (
                        <p className="text-[0.75rem] text-destructive">
                          Solo hay {formatoCantidad(disponible)} {unidadCorta(mat.unidad)}: no se podrá marcar como hecha.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-3 text-[0.75rem] text-muted-foreground">
              {estado === "HECHA"
                ? "Al guardar, estos materiales se descuentan del inventario."
                : "Se descuentan del inventario cuando la labor pasa a Hecha. Si la reabres, vuelven."}
            </p>
          </div>

          {resultado && !resultado.ok && (
            <p className="text-[0.85rem] text-destructive" role="alert">
              {resultado.error}
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
                {editando ? "Guardar cambios" : "Registrar labor"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
