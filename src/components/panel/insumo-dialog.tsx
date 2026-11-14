"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { eliminarInsumo, guardarInsumo, type ResultadoInventario } from "@/app/panel/inventario/actions";
import { useConfirmar } from "@/components/ui/confirmar";
import { avisarCambio } from "@/lib/avisos-datos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CATEGORIA_NUEVA, UNIDADES_INSUMO, type Insumo, type OpcionCategoria } from "@/lib/inventario-comun";

const campo = "h-10 px-3 text-[0.95rem]";
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";

/** Crear un material de bodega, o corregir uno que ya existe. */
export function InsumoDialog({
  insumo,
  categorias,
  onCerrar,
}: {
  insumo: Insumo | null;
  /** Las categorías que creó el comité. */
  categorias: OpcionCategoria[];
  onCerrar: () => void;
}) {
  const { confirmar, dialogo } = useConfirmar();
  const [estado, enviar, pendiente] = useActionState<ResultadoInventario | null, FormData>(guardarInsumo, null);
  const [borrando, iniciarBorrado] = useTransition();
  const editando = insumo !== null;
  // «Otros» era la categoría por omisión de antes: ahora es no tener categoría.
  const [categoria, setCategoria] = useState(insumo && insumo.categoria !== "OTROS" ? insumo.categoria : "");

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Material actualizado" : "Material registrado");
      avisarCambio("inventario");
      onCerrar();
    }
  }, [estado, editando, onCerrar]);

  async function borrar() {
    if (!insumo) return;
    if (!(await confirmar({ titulo: `¿Borrar «${insumo.nombre}»?`, descripcion: "Se borra del inventario y no se puede deshacer.", boton: "Borrar" }))) return;
    iniciarBorrado(async () => {
      const r = await eliminarInsumo(insumo.id);
      if (r.ok) {
        toast.success("Material eliminado");
        avisarCambio("inventario");
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
          <DialogTitle className="text-lg font-medium">{editando ? "Editar material" : "Nuevo material"}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">
            Cloro, cañerías, medidores, repuestos de bomba: lo que guardas en bodega para tener a mano.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="mt-2 flex flex-col gap-4">
          {editando && <input type="hidden" name="id" value={insumo.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ins-nombre" className={etiqueta}>
                Nombre
              </label>
              <Input
                id="ins-nombre"
                name="nombre"
                defaultValue={insumo?.nombre}
                placeholder="Cloro granulado"
                maxLength={120}
                className={campo}
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="ins-codigo" className={etiqueta}>
                Código (opcional)
              </label>
              <Input
                id="ins-codigo"
                name="codigo"
                defaultValue={insumo?.codigo ?? ""}
                placeholder="Interno o del proveedor"
                maxLength={60}
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="ins-categoria" className={etiqueta}>
                Categoría (opcional)
              </label>
              <select
                id="ins-categoria"
                name="categoria"
                className={selectClase}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.texto}
                  </option>
                ))}
                <option value={CATEGORIA_NUEVA}>+ Crear categoría nueva…</option>
              </select>
            </div>
            <div>
              <label htmlFor="ins-unidad" className={etiqueta}>
                Se cuenta en
              </label>
              <select id="ins-unidad" name="unidad" className={selectClase} defaultValue={insumo?.unidad ?? "UNIDAD"}>
                {UNIDADES_INSUMO.map((u) => (
                  <option key={u.valor} value={u.valor}>
                    {u.texto}
                  </option>
                ))}
              </select>
            </div>
            {categoria === CATEGORIA_NUEVA && (
              <div className="sm:col-span-2">
                <label htmlFor="ins-categoria-nueva" className={etiqueta}>
                  Nombre de la categoría nueva
                </label>
                <Input
                  id="ins-categoria-nueva"
                  name="categoriaNueva"
                  placeholder="Ej.: Válvulas, Pintura, Uniformes…"
                  maxLength={40}
                  className={campo}
                  autoFocus
                  required
                />
              </div>
            )}
            <div>
              <label htmlFor="ins-stock" className={etiqueta}>
                Stock actual
              </label>
              <Input
                id="ins-stock"
                name="stock"
                defaultValue={insumo ? String(insumo.stock).replace(".", ",") : ""}
                placeholder="10"
                inputMode="decimal"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="ins-minimo" className={etiqueta}>
                Avisar si baja de
              </label>
              <Input
                id="ins-minimo"
                name="stockMinimo"
                defaultValue={insumo ? String(insumo.stockMinimo).replace(".", ",") : ""}
                placeholder="2"
                inputMode="decimal"
                className={campo}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ins-costo" className={etiqueta}>
                Costo por unidad (CLP)
              </label>
              <Input
                id="ins-costo"
                name="costo"
                defaultValue={insumo ? String(insumo.costo) : ""}
                placeholder="17500"
                inputMode="numeric"
                className={campo}
              />
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
                {editando ? "Guardar cambios" : "Registrar material"}
              </Button>
            </div>
          </div>
        </form>
        {dialogo}
      </DialogContent>
    </Dialog>
  );
}
