"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, History, Loader2, Trash2 } from "lucide-react";
import { ajustarStock, eliminarInsumo } from "@/app/panel/inventario/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CategoriasDialog } from "@/components/panel/categorias-dialog";
import { HistorialStock } from "@/components/panel/historial-stock";
import { InsumoDialog } from "@/components/panel/insumo-dialog";
import {
  estaBajo,
  formatoCantidad,
  opcionesDeCategoria,
  PREFIJO_CATEGORIA_PROPIA,
  textoCategoriaInsumo,
  unidadCorta,
  type CategoriaPropia,
  type Insumo,
  type MovimientoStockFila,
} from "@/lib/inventario-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

const alto = "h-10";
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";
const ROJO_TARJ = "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10";
const ROJO_TXT = "text-red-600 dark:text-red-400";
const VERDE_TXT = "text-emerald-700 dark:text-emerald-400";

/** Entrada o salida de stock de un material: cuánto entró o cuánto se sacó. */
function AjusteDialog({ insumo, onCerrar }: { insumo: Insumo; onCerrar: () => void }) {
  const [tipo, setTipo] = useState<"ENTRADA" | "SALIDA">("SALIDA");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await ajustarStock(insumo.id, Number(cantidad.replace(",", ".")), tipo, motivo);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success(tipo === "ENTRADA" ? "Entrada registrada" : "Salida registrada");
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Ajustar stock</DialogTitle>
          <DialogDescription className="text-[0.9rem]">
            {insumo.nombre}: hay {formatoCantidad(insumo.stock)} {unidadCorta(insumo.unidad)}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid grid-cols-2 gap-3" role="group" aria-label="Tipo de ajuste">
          <button
            type="button"
            onClick={() => setTipo("ENTRADA")}
            aria-pressed={tipo === "ENTRADA"}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-[0.9rem] font-medium transition-colors",
              tipo === "ENTRADA"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowDown className="size-4" />
            Entrada
          </button>
          <button
            type="button"
            onClick={() => setTipo("SALIDA")}
            aria-pressed={tipo === "SALIDA"}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-[0.9rem] font-medium transition-colors",
              tipo === "SALIDA"
                ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowUp className="size-4" />
            Salida
          </button>
        </div>

        <div className="mt-4">
          <label htmlFor="aj-cantidad" className="mb-2 block text-[0.8rem] font-medium">
            Cantidad ({unidadCorta(insumo.unidad)})
          </label>
          <Input
            id="aj-cantidad"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value.replace(/[^\d,.]/g, ""))}
            placeholder="0"
            inputMode="decimal"
            className={cn(alto, "px-3 text-[0.95rem]")}
            autoFocus
          />
        </div>

        <div className="mt-4">
          <label htmlFor="aj-motivo" className="mb-2 block text-[0.8rem] font-medium">
            Motivo (opcional)
          </label>
          <Input
            id="aj-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={tipo === "SALIDA" ? "Ej.: cloración semanal, reparación del pozo" : "Ej.: donación, devolución"}
            maxLength={200}
            className={cn(alto, "px-3 text-[0.95rem]")}
          />
        </div>

        {error && (
          <p className="mt-3 text-[0.8rem] text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button className="h-10 rounded-full px-5 text-[0.95rem]" onClick={guardar} disabled={pendiente || !cantidad}>
            {pendiente && <Loader2 className="animate-spin" />}
            Registrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Confirmación antes de borrar un material. */
function EliminarDialog({ insumo, onCerrar }: { insumo: Insumo; onCerrar: () => void }) {
  const [pendiente, iniciar] = useTransition();

  function borrar() {
    iniciar(async () => {
      const r = await eliminarInsumo(insumo.id);
      if (r.ok) {
        toast.success("Material eliminado");
        onCerrar();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="p-6 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">¿Eliminar {insumo.nombre}?</DialogTitle>
          <DialogDescription className="text-[0.9rem]">Se borra del inventario y no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button variant="destructive" className="h-10 px-4 text-[0.95rem]" onClick={borrar} disabled={pendiente}>
            {pendiente && <Loader2 className="animate-spin" />}
            Sí, eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * El inventario de bodega del comité, con el diseño de MecánicoApp: buscador y botón
 * arriba, pestañas, la tabla en una tarjeta y los formularios en modales. Cada material
 * dice cuánto hay y avisa cuando está por acabarse.
 */
export function InventarioVista({
  insumos,
  categoriasPropias,
  historial,
}: {
  insumos: Insumo[];
  categoriasPropias: CategoriaPropia[];
  historial: MovimientoStockFila[];
}) {
  const [vista, setVista] = useState<"materiales" | "historial">("materiales");
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pestana, setPestana] = useState<"todos" | "bajo">("todos");
  const [categoria, setCategoria] = useState("todas");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [ajustando, setAjustando] = useState<Insumo | null>(null);
  const [eliminando, setEliminando] = useState<Insumo | null>(null);
  const [gestionandoCategorias, setGestionandoCategorias] = useState(false);
  const cerrarForm = useCallback(() => {
    setCreando(false);
    setEditando(null);
  }, []);
  const cerrarAjuste = useCallback(() => setAjustando(null), []);
  const cerrarEliminar = useCallback(() => setEliminando(null), []);
  const cerrarCategorias = useCallback(() => setGestionandoCategorias(false), []);

  const categorias = opcionesDeCategoria(
    categoriasPropias,
    insumos.map((i) => i.categoria)
  );
  // Cuántos materiales usa cada categoría propia, para avisar antes de borrarla.
  const usos: Record<string, number> = {};
  for (const i of insumos) {
    if (i.categoria.startsWith(PREFIJO_CATEGORIA_PROPIA)) {
      const id = i.categoria.slice(PREFIJO_CATEGORIA_PROPIA.length);
      usos[id] = (usos[id] ?? 0) + 1;
    }
  }

  const sinCategoria = insumos.filter((i) => textoCategoriaInsumo(i.categoria, categorias) === null).length;
  const cuantos = (valor: string) => insumos.filter((i) => i.categoria === valor).length;
  const bajos = insumos.filter(estaBajo);
  const valor = insumos.reduce((s, i) => s + i.stock * i.costo, 0);

  const q = busqueda.trim().toLowerCase();
  const filtrados = insumos.filter((i) => {
    if (pestana === "bajo" && !estaBajo(i)) return false;
    if (categoria === "sin" && textoCategoriaInsumo(i.categoria, categorias) !== null) return false;
    if (categoria !== "todas" && categoria !== "sin" && i.categoria !== categoria) return false;
    if (q && !i.nombre.toLowerCase().includes(q) && !i.codigo?.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Materiales</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{insumos.length}</p>
        </div>
        <div className={cn("rounded-xl border p-5", bajos.length > 0 ? ROJO_TARJ : "border-border bg-card")}>
          <p className={cn(etiquetaKpi, bajos.length > 0 ? ROJO_TXT : "text-muted-foreground")}>Con stock bajo</p>
          <p className={cn("mt-3 text-[2rem] leading-none font-bold tabular-nums", bajos.length > 0 && ROJO_TXT)}>
            {bajos.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Valor del inventario</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{clp.format(valor)}</p>
        </div>
      </section>

      {/* Una sola fila: las pestañas a la izquierda y las acciones principales a la derecha. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex w-full gap-1 rounded-xl border border-border p-1 sm:w-fit" role="tablist" aria-label="Sección">
        {(
          [
            ["materiales", "Materiales"],
            ["historial", "Historial"],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={vista === id}
            onClick={() => {
              setVista(id);
              // Al entrar por la pestaña (y no por el botón de un material), se ve todo el historial.
              if (id === "historial") setBusquedaHistorial("");
            }}
            className={cn(
              "rounded-lg px-5 py-1.5 text-[0.9rem] font-medium transition-colors",
              vista === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {texto}
          </button>
        ))}
      </div>

      {vista === "materiales" && (
        <div className="flex gap-3">
          <Button variant="outline" className={cn(alto, "rounded-xl px-4 text-[0.95rem]")} onClick={() => setGestionandoCategorias(true)}>
            Categorías
          </Button>
          <Button className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
            + Nuevo material
          </Button>
        </div>
      )}
      </div>

      {vista === "historial" ? (
        <HistorialStock historial={historial} busquedaInicial={busquedaHistorial} />
      ) : (
        <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o código…"
          className={cn(alto, "rounded-full px-5 text-[0.95rem] sm:w-80")}
          aria-label="Buscar materiales"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          {categorias.length > 0 && (
            <div className="relative sm:w-56">
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                aria-label="Categoría"
                className={cn(
                  alto,
                  "w-full appearance-none rounded-xl border border-input bg-transparent pr-10 pl-4 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                )}
              >
                <option value="todas">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.texto} ({cuantos(c.valor)})
                  </option>
                ))}
                {sinCategoria > 0 && <option value="sin">Sin categoría ({sinCategoria})</option>}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}
          {/* El filtro de stock bajo es un botón que se enciende y se apaga, no otra fila de pestañas. */}
          <button
            type="button"
            aria-pressed={pestana === "bajo"}
            onClick={() => setPestana(pestana === "bajo" ? "todos" : "bajo")}
            className={cn(
              alto,
              "inline-flex items-center justify-center gap-2 rounded-xl border px-4 text-[0.95rem] whitespace-nowrap transition-colors",
              pestana === "bajo"
                ? "border-red-300 bg-red-50 text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400"
                : "border-input text-muted-foreground hover:text-foreground"
            )}
          >
            Stock bajo
            {bajos.length > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[0.75rem] leading-none font-medium text-white">
                {bajos.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">
            {insumos.length === 0 ? "Todavía no registraste nada en el inventario" : "Nada coincide con esa búsqueda"}
          </p>
          <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
            {insumos.length === 0
              ? "Cloro, cañerías, medidores, repuestos de bomba: anota lo que guardas en bodega y te avisamos cuando se esté acabando."
              : "Prueba con otra palabra, o cambia la categoría o el filtro de stock bajo."}
          </p>
          {insumos.length === 0 && (
            <Button className={cn(alto, "mt-5 rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
              + Nuevo material
            </Button>
          )}
        </div>
      ) : (
        <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-160 border-collapse text-[0.95rem]">
            <thead>
              <tr className="border-b border-border bg-card">
                {["Material", "Categoría", "Stock", "Avisar en", "Costo"].map((c) => (
                  <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                    {c}
                  </th>
                ))}
                <th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => {
                const bajo = estaBajo(i);
                return (
                  <tr
                    key={i.id}
                    onClick={() => setEditando(i)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-card/50"
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium">{i.nombre}</div>
                      {i.codigo && <div className="text-[0.8rem] text-muted-foreground">{i.codigo}</div>}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{textoCategoriaInsumo(i.categoria, categorias) ?? "—"}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={cn("font-medium tabular-nums", bajo ? ROJO_TXT : VERDE_TXT)}>
                        {formatoCantidad(i.stock)} {unidadCorta(i.unidad)}
                      </span>
                      {bajo && (
                        <span className="ml-2 rounded-full bg-red-50 px-2.5 py-1 text-[0.75rem] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
                          Bajo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">
                      {i.stockMinimo > 0 ? `${formatoCantidad(i.stockMinimo)} ${unidadCorta(i.unidad)}` : "—"}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap tabular-nums">{clp.format(i.costo)}</td>
                    <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" className="rounded-full px-3" onClick={() => setAjustando(i)}>
                          Ajustar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Ver el historial de ${i.nombre}`}
                          title="Ver el historial"
                          className="text-muted-foreground"
                          onClick={() => {
                            setBusquedaHistorial(i.nombre);
                            setVista("historial");
                          }}
                        >
                          <History />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Eliminar ${i.nombre}`}
                          className="text-muted-foreground"
                          onClick={() => setEliminando(i)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      {(creando || editando) && <InsumoDialog key={editando?.id ?? "nuevo"} insumo={editando} categorias={categorias} onCerrar={cerrarForm} />}
      {ajustando && <AjusteDialog insumo={ajustando} onCerrar={cerrarAjuste} />}
      {eliminando && <EliminarDialog insumo={eliminando} onCerrar={cerrarEliminar} />}
      {gestionandoCategorias && <CategoriasDialog propias={categoriasPropias} usos={usos} onCerrar={cerrarCategorias} />}
    </div>
  );
}
