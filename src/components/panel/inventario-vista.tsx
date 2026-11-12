"use client";

import { useCallback, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellOff, Boxes, ChevronDown, Coins, Droplets, History, Loader2, Plus, Search, Smartphone, Tag, Trash2, TriangleAlert, Wrench, Zap, type LucideIcon } from "lucide-react";
import { ajustarStock, consultarInventario, eliminarInsumo, type DatosInventario } from "@/app/panel/inventario/actions";
import { INTERVALO_RAPIDO, avisarCambio } from "@/lib/avisos-datos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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

const alto = "h-11";
const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.1)]";
const COLUMNAS = "lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_110px_130px_210px]";

/** El ícono de un material según de qué parece ser (por el nombre de su categoría). */
function iconoDe(categoria: string | null, nombre: string): { icono: LucideIcon; tono: string } {
  const t = `${categoria ?? ""} ${nombre}`.toLowerCase();
  if (/cloro|desinfec|qu[ií]m|l[ií]quid|agua/.test(t)) return { icono: Droplets, tono: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" };
  if (/tel[eé]f|phone|celular|electr|cable|bater/.test(t)) return { icono: /el[eé]ctr|cable|bater/.test(t) ? Zap : Smartphone, tono: "bg-primary/10 text-primary" };
  if (/herram|repuesto|bomba|motor/.test(t)) return { icono: Wrench, tono: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" };
  return { icono: Boxes, tono: "bg-muted text-muted-foreground" };
}

function Kpi({ label, valor, detalle, icono: Icono, tono, children }: { label: string; valor: string; detalle?: string; icono: LucideIcon; tono: string; children?: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-border bg-card p-4 lg:p-5", SOMBRA)}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[0.8rem] font-semibold text-muted-foreground">{label}</p>
        <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tono)}>
          <Icono className="size-[18px]" />
        </span>
      </div>
      <p className="mt-1 text-[1.65rem] leading-tight font-bold tracking-tight tabular-nums lg:text-[2rem]">{valor}</p>
      {detalle && <p className="mt-1 text-[0.8rem] text-muted-foreground">{detalle}</p>}
      {children}
    </div>
  );
}

/** El valor total del inventario, con una barra de qué materiales pesan más. */
function ValorInventario({ insumos, total }: { insumos: Insumo[]; total: number }) {
  const orden = [...insumos].sort((a, b) => b.stock * b.costo - a.stock * a.costo);
  const top = orden.slice(0, 3).map((i) => ({ nombre: i.nombre, valor: i.stock * i.costo }));
  const otros = orden.slice(3).reduce((s, i) => s + i.stock * i.costo, 0);
  const partes = (otros > 0 ? [...top, { nombre: "Otros", valor: otros }] : top).filter((p) => p.valor > 0);
  const tonos = ["bg-primary", "bg-primary/50", "bg-primary/30", "bg-muted-foreground/30"];
  return (
    <div className="col-span-2">
      <Kpi label="Valor del inventario" valor={clp.format(total)} icono={Coins} tono="bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
        {partes.length > 0 && total > 0 && (
          <>
            <div className="mt-4 flex h-1.5 gap-0.5" aria-hidden>
              {partes.map((p, i) => (
                <span key={`${p.nombre}-${i}`} className={cn("rounded-full", tonos[i])} style={{ width: `${(p.valor / total) * 100}%`, minWidth: 6 }} />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-muted-foreground">
              {partes.map((p, i) => (
                <li key={`${p.nombre}-${i}`} className="flex items-center gap-2">
                  <span aria-hidden className={cn("size-2 rounded-full", tonos[i])} />
                  {p.nombre} <span className="font-semibold tabular-nums">{Math.round((p.valor / total) * 100)}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Kpi>
    </div>
  );
}

/** Barra de stock con una marca donde salta el aviso. */
function MedidorStock({ i }: { i: Insumo }) {
  if (i.stockMinimo <= 0) return null;
  const tope = Math.max(i.stock, i.stockMinimo * 2) * 1.1;
  const bajo = estaBajo(i);
  return (
    <div
      role="img"
      aria-label={`${formatoCantidad(i.stock)} ${unidadCorta(i.unidad)} en stock, aviso en ${formatoCantidad(i.stockMinimo)} ${unidadCorta(i.unidad)}`}
      className="relative mt-2 h-1 w-full max-w-52 rounded-full bg-muted"
    >
      <div className={cn("h-full rounded-full", bajo ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, (i.stock / tope) * 100)}%` }} />
      <span className="absolute -top-1 h-3 w-0.5 rounded-full bg-muted-foreground" style={{ left: `${(i.stockMinimo / tope) * 100}%` }} />
    </div>
  );
}

function EstadoStock({ i }: { i: Insumo }) {
  if (i.stockMinimo <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[0.8rem] text-muted-foreground">
        <BellOff className="size-3.5" aria-hidden />
        Sin aviso
      </span>
    );
  }
  const bajo = estaBajo(i);
  return (
    <span className={cn("inline-flex items-center gap-2 text-[0.8rem] font-medium", bajo ? "font-bold text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
      {bajo ? <TriangleAlert className="size-3.5" aria-hidden /> : <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />}
      {bajo ? "Stock bajo" : `Aviso en ${formatoCantidad(i.stockMinimo)}`}
    </span>
  );
}

/** Entrada o salida de stock de un material: cuánto entró o cuánto se sacó. */
function AjusteDialog({ insumo, onCerrar }: { insumo: Insumo; onCerrar: () => void }) {
  const [tipo, setTipo] = useState<"ENTRADA" | "SALIDA">("SALIDA");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const n = Number(cantidad.replace(",", ".")) || 0;
  const nuevoStock = insumo.stock + (tipo === "ENTRADA" ? n : -n);
  const excede = tipo === "SALIDA" && nuevoStock < 0;

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await ajustarStock(insumo.id, Number(cantidad.replace(",", ".")), tipo, motivo);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success(tipo === "ENTRADA" ? "Entrada registrada" : "Salida registrada");
      avisarCambio("inventario");
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[440px]">
        <div className="bg-gradient-to-r from-[#3A0CE3] to-[#6B46F5] py-4 pr-14 pl-5 text-primary-foreground">
          <DialogTitle className="text-xl font-bold">Ajustar {insumo.nombre}</DialogTitle>
          <DialogDescription className="text-sm text-white/90">
            Stock actual: {formatoCantidad(insumo.stock)} {unidadCorta(insumo.unidad)}
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div role="radiogroup" aria-label="Tipo de ajuste" className="grid grid-cols-2 gap-2">
            {(
              [
                ["ENTRADA", "Entrada"],
                ["SALIDA", "Salida"],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={tipo === valor}
                onClick={() => setTipo(valor)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  tipo === valor ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"
                )}
              >
                {texto}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="aj-cantidad" className="text-[0.8rem] font-semibold">
              Cantidad ({unidadCorta(insumo.unidad)})
            </label>
            <Input
              id="aj-cantidad"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value.replace(/[^\d,.]/g, ""))}
              placeholder="0"
              inputMode="decimal"
              className="mt-2 h-11 rounded-xl text-base font-bold"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="aj-motivo" className="text-[0.8rem] font-semibold">
              Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Input
              id="aj-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={tipo === "SALIDA" ? "Ej.: cloración semanal, reparación del pozo" : "Ej.: donación, devolución"}
              maxLength={200}
              className="mt-2 h-11 rounded-xl"
            />
          </div>

          {n > 0 && (
            <p className={cn("rounded-xl px-3 py-2 text-sm font-semibold tabular-nums", excede ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-primary/10 text-primary")}>
              {excede ? "La salida supera el stock disponible" : `Quedarán ${formatoCantidad(nuevoStock)} ${unidadCorta(insumo.unidad)}`}
            </p>
          )}

          {error && (
            <p className="text-[0.8rem] text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button className="h-12 rounded-full font-semibold" onClick={guardar} disabled={pendiente || n <= 0 || excede}>
            {pendiente && <Loader2 className="animate-spin" />}
            Guardar ajuste
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
        avisarCambio("inventario");
        onCerrar();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[400px]">
        <div className="bg-red-700 py-4 pr-14 pl-5 text-white">
          <DialogTitle className="text-xl font-bold">Eliminar {insumo.nombre}</DialogTitle>
          <DialogDescription className="text-sm text-white/90">Se borra del inventario y no se puede deshacer.</DialogDescription>
        </div>
        <div className="flex justify-end gap-2 p-5">
          <Button variant="ghost" className="h-11 rounded-full px-5 font-semibold" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button className="h-11 rounded-full bg-red-700 px-5 font-semibold text-white hover:bg-red-800" onClick={borrar} disabled={pendiente}>
            {pendiente && <Loader2 className="animate-spin" />}
            Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * El inventario de bodega del comité: cuánto vale lo que hay, qué se está acabando y el historial de
 * cada entrada y salida. Cada material dice cuánto hay y avisa cuando está por acabarse.
 */
/** La consulta de Inventario: parte con lo que trajo el servidor y se actualiza sola (cada 10 segundos, al volver a la pestaña y cuando otra pestaña avisa un cambio). */
function useDatosInventario(inicial: DatosInventario) {
  return useQuery({ queryKey: ["inventario"], queryFn: () => consultarInventario(), initialData: inicial, refetchInterval: INTERVALO_RAPIDO }).data;
}

/** La frase bajo el título: cuántos materiales hay y cuántos están por acabarse. */
export function ResumenInventario({ inicial }: { inicial: DatosInventario }) {
  const { insumos } = useDatosInventario(inicial);
  const bajos = insumos.filter(estaBajo).length;
  return (
    <>
      {insumos.length === 0
        ? "Cloro, cañerías, medidores, repuestos: lo que guardas en bodega."
        : bajos > 0
          ? `${insumos.length} en total, ${bajos} a punto de acabarse.`
          : `${insumos.length} ${insumos.length === 1 ? "material registrado" : "materiales registrados"}.`}
    </>
  );
}

export function InventarioVista({
  insumos: insumosIniciales,
  categoriasPropias: propiasIniciales,
  historial: historialInicial,
}: {
  insumos: Insumo[];
  categoriasPropias: CategoriaPropia[];
  historial: MovimientoStockFila[];
}) {
  const { insumos, categoriasPropias, historial } = useDatosInventario({ insumos: insumosIniciales, categoriasPropias: propiasIniciales, historial: historialInicial });
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
  const sinAviso = insumos.filter((i) => i.stockMinimo <= 0).length;
  const valor = insumos.reduce((s, i) => s + i.stock * i.costo, 0);
  const nCategorias = new Set(insumos.map((i) => textoCategoriaInsumo(i.categoria, categorias)).filter(Boolean)).size;

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
      <section aria-label="Resumen" className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <ValorInventario insumos={insumos} total={valor} />
        <Kpi label="Materiales" valor={String(insumos.length)} detalle={`${nCategorias} ${nCategorias === 1 ? "categoría" : "categorías"}`} icono={Boxes} tono="bg-primary/10 text-primary" />
        <Kpi
          label="Con stock bajo"
          valor={String(bajos.length)}
          detalle={sinAviso > 0 ? `${sinAviso} sin aviso definido` : "Todos con aviso"}
          icono={TriangleAlert}
          tono={bajos.length > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"}
        />
      </section>

      {/* Una sola fila: las pestañas a la izquierda y las acciones principales a la derecha. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid w-full grid-cols-2 gap-1 rounded-full bg-muted p-1 sm:w-60" role="tablist" aria-label="Sección">
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
              className={cn("h-10 rounded-full text-sm font-semibold transition-colors", vista === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {texto}
            </button>
          ))}
        </div>

        {vista === "materiales" && (
          <div className="flex gap-2">
            <Button variant="outline" className={cn(alto, "flex-1 rounded-full px-4 font-semibold sm:flex-none")} onClick={() => setGestionandoCategorias(true)}>
              <Tag />
              Categorías
            </Button>
            <Button className={cn(alto, "flex-[2] rounded-full px-5 font-semibold shadow-md shadow-primary/30 sm:flex-none")} onClick={() => setCreando(true)}>
              <Plus />
              Nuevo material
            </Button>
          </div>
        )}
      </div>

      {vista === "historial" ? (
        <HistorialStock historial={historial} busquedaInicial={busquedaHistorial} />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o código"
                className={cn(alto, "rounded-full pr-4 pl-11 text-[0.95rem]")}
                aria-label="Buscar materiales"
              />
            </div>
            <div className="flex gap-2">
              {categorias.length > 0 && (
                <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    aria-label="Categoría"
                    className={cn(
                      alto,
                      "w-full appearance-none rounded-full border border-input bg-transparent pr-10 pl-4 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
                  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors",
                  pestana === "bajo" ? "border-amber-600 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" : "border-input text-muted-foreground hover:text-foreground"
                )}
              >
                Stock bajo
                {bajos.length > 0 && <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[0.75rem] leading-none font-medium text-white">{bajos.length}</span>}
              </button>
            </div>
          </div>

          {filtrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-20 text-center">
              <p className="text-[1.05rem] font-medium">{insumos.length === 0 ? "Todavía no registraste nada en el inventario" : "Nada coincide con esa búsqueda"}</p>
              <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
                {insumos.length === 0
                  ? "Cloro, cañerías, medidores, repuestos de bomba: anota lo que guardas en bodega y te avisamos cuando se esté acabando."
                  : "Prueba con otra palabra, o cambia la categoría o el filtro de stock bajo."}
              </p>
              {insumos.length === 0 && (
                <Button className={cn(alto, "mt-6 rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
                  <Plus />
                  Nuevo material
                </Button>
              )}
            </div>
          ) : (
            <div>
              <div className={cn("hidden gap-4 px-5 pb-2 text-[0.8rem] font-semibold text-muted-foreground lg:grid", COLUMNAS)}>
                <span>Material</span>
                <span>Stock</span>
                <span className="text-right">Costo unitario</span>
                <span className="text-right">Valor total</span>
                <span>
                  <span className="sr-only">Acciones</span>
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {filtrados.map((i) => {
                  const cat = textoCategoriaInsumo(i.categoria, categorias);
                  const { icono: Icono, tono } = iconoDe(cat, i.nombre);
                  return (
                    <li key={i.id}>
                      <div
                        onClick={() => setEditando(i)}
                        className={cn(
                          "grid cursor-pointer items-center gap-x-4 gap-y-4 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-lg hover:shadow-primary/15 lg:px-5",
                          COLUMNAS,
                          SOMBRA
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <span aria-hidden className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tono)}>
                            <Icono className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[1.05rem] font-bold tracking-tight">{i.nombre}</p>
                            <p className="truncate text-[0.8rem] text-muted-foreground">{[i.codigo, cat].filter(Boolean).join(" · ") || "Sin categoría"}</p>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-xl font-bold tracking-tight tabular-nums">
                              {formatoCantidad(i.stock)} {unidadCorta(i.unidad)}
                            </p>
                            <EstadoStock i={i} />
                          </div>
                          <MedidorStock i={i} />
                        </div>
                        <div className="flex justify-between gap-4 lg:block lg:text-right">
                          <span className="text-[0.8rem] text-muted-foreground lg:hidden">Costo unitario</span>
                          <span className="text-sm text-muted-foreground tabular-nums">{clp.format(i.costo)}</span>
                        </div>
                        <div className="flex justify-between gap-4 lg:block lg:text-right">
                          <span className="text-[0.8rem] text-muted-foreground lg:hidden">Valor total</span>
                          <span className="text-[1.05rem] font-bold tracking-tight tabular-nums">{clp.format(i.stock * i.costo)}</span>
                        </div>
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            onClick={() => setAjustando(i)}
                            aria-label={`Ajustar ${i.nombre}`}
                            className="h-10 rounded-full border-transparent bg-primary/10 px-4 font-semibold text-primary shadow-none hover:bg-primary/20 hover:text-primary"
                          >
                            Ajustar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Ver el historial de ${i.nombre}`}
                            title="Ver el historial"
                            className="size-10 rounded-full text-muted-foreground"
                            onClick={() => {
                              setBusquedaHistorial(i.nombre);
                              setVista("historial");
                            }}
                          >
                            <History />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Eliminar ${i.nombre}`}
                            className="size-10 rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-700"
                            onClick={() => setEliminando(i)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
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
