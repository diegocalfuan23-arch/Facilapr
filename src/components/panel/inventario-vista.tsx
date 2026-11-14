"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Bell, BellOff, Boxes, ChevronRight, Droplets, Gauge, History, Minus, Pencil, Plus, Search, ShoppingCart, Smartphone, Tags, Wrench, X, Zap } from "lucide-react";
import { ajustarStock, consultarInventario, definirStockMinimo, type DatosInventario } from "@/app/panel/inventario/actions";
import { INTERVALO_RAPIDO, avisarCambio } from "@/lib/avisos-datos";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoriasDialog } from "@/components/panel/categorias-dialog";
import { HistorialStock } from "@/components/panel/historial-stock";
import { InsumoDialog } from "@/components/panel/insumo-dialog";
import {
  formatoCantidad,
  opcionesDeCategoria,
  PREFIJO_CATEGORIA_PROPIA,
  textoCategoriaInsumo,
  TEXTO_ORIGEN_STOCK,
  unidadCorta,
  type CategoriaPropia,
  type Insumo,
  type MovimientoStockFila,
} from "@/lib/inventario-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const COLORES = ["bg-[#6B46F5]", "bg-[#0B8BD3]", "bg-[#2FB386]", "bg-[#F0A23C]", "bg-[#B9B7C8]"];
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const cant = formatoCantidad;
const MOTIVOS = ["Conteo físico", "Pérdida o daño", "Préstamo devuelto", "Otro"];
const ORDENES = [
  { valor: "valor", texto: "Mayor valor" },
  { valor: "nombre", texto: "Nombre A–Z" },
  { valor: "dura", texto: "Se acaba antes" },
];
const DIA = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Santiago" });

const valorDe = (i: Insumo) => i.stock * i.costo;
type Nivel = "agotado" | "bajo" | "ok" | "sin";
const nivelDe = (i: Insumo): Nivel => (i.stock <= 0 ? "agotado" : i.stockMinimo <= 0 ? "sin" : i.stock <= i.stockMinimo ? "bajo" : "ok");

/** El ícono de un material según de qué parece ser (por el nombre y su categoría). */
function IconoMaterial({ texto, className }: { texto: string; className?: string }) {
  const t = texto.toLowerCase();
  if (/cloro|desinfec|qu[ií]m|l[ií]quid|agua/.test(t)) return <Droplets className={className} />;
  if (/medidor/.test(t)) return <Gauge className={className} />;
  if (/tel[eé]f|phone|celular/.test(t)) return <Smartphone className={className} />;
  if (/el[eé]ctr|cable|bater/.test(t)) return <Zap className={className} />;
  if (/herram|repuesto|bomba|motor|tuber|ca[ñn]er/.test(t)) return <Wrench className={className} />;
  return <Boxes className={className} />;
}

/** Cuánto sale por mes de cada material, según las salidas de los últimos 3 meses (labores y ajustes a mano, menos lo devuelto). */
function consumosMensuales(historial: MovimientoStockFila[], hoy: string) {
  const ahora = Date.parse(`${hoy}T12:00:00`);
  const ventana = 90 * 86_400_000;
  const porMaterial = new Map<string, { salidas: number; primera: number }>();
  for (const h of historial) {
    const t = Date.parse(h.fecha);
    const e = porMaterial.get(h.insumo) ?? { salidas: 0, primera: t };
    e.primera = Math.min(e.primera, t);
    if (ahora - t <= ventana) {
      if (h.cantidad < 0 && (h.origen === "LABOR" || h.origen === "MANUAL")) e.salidas += -h.cantidad;
      if (h.origen === "LABOR_DEVUELTA") e.salidas -= h.cantidad;
    }
    porMaterial.set(h.insumo, e);
  }
  const consumo = new Map<string, number>();
  for (const [nombre, e] of porMaterial) {
    if (e.salidas <= 0) continue;
    // Un material nuevo se mide desde su primer movimiento, no desde hace 3 meses.
    const desde = Math.max(e.primera, ahora - ventana);
    const meses = Math.max(1, (ahora - desde) / (30.4 * 86_400_000));
    consumo.set(nombre, e.salidas / meses);
  }
  return consumo;
}

/** La celda de stock: cuánto hay, el aviso y una barra con la marca del mínimo. */
function StockCelda({ i }: { i: Insumo }) {
  const n = nivelDe(i);
  const tope = Math.max(i.stock, i.stockMinimo * 3, 1);
  return (
    <span className="block">
      <span className="flex items-baseline gap-2">
        <span className={cn("text-[15px] font-semibold tabular-nums", (n === "agotado" || n === "bajo") && "text-[#A32020]")}>
          {cant(i.stock)} <span className={cn("text-xs font-medium", GRIS)}>{unidadCorta(i.unidad)}</span>
        </span>
        {n === "sin" ? (
          <span className={cn("inline-flex items-center gap-1 text-xs", GRIS)}>
            <BellOff className="size-3" aria-hidden />
            Sin aviso
          </span>
        ) : n === "ok" ? (
          <span className="text-xs text-[#075A3C]">aviso en {cant(i.stockMinimo)}</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-[#FDEFEF] px-1.5 py-px text-[11px] font-semibold text-[#A32020]">
            <AlertTriangle className="size-3" aria-hidden />
            {n === "agotado" ? "Agotado" : "Stock bajo"}
          </span>
        )}
      </span>
      {i.stockMinimo > 0 ? (
        <span role="img" aria-label={`${cant(i.stock)} ${unidadCorta(i.unidad)} en stock, aviso en ${cant(i.stockMinimo)}`} className="relative mt-1.5 block h-1.5 rounded-full bg-[#EEEBF7]">
          <span className={cn("block h-full rounded-full", n === "ok" ? "bg-[#2FB386]" : "bg-[#D6403D]")} style={{ width: `${Math.min(100, (i.stock / tope) * 100)}%` }} />
          <span aria-hidden className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-[#15132B]/50" style={{ left: `${(i.stockMinimo / tope) * 100}%` }} />
        </span>
      ) : null}
    </span>
  );
}

/** Lo que muestra el detalle de un material y lo que se puede hacer con él sin salir de la pantalla. */
function Detalle({
  i,
  categoria,
  consumoMes,
  movimientos,
  ocupado,
  onCerrar,
  onEditar,
  onAjustar,
  onMinimo,
  onHistorial,
}: {
  i: Insumo;
  categoria: string | null;
  consumoMes: number | null;
  movimientos: MovimientoStockFila[];
  ocupado: boolean;
  onCerrar: () => void;
  onEditar: () => void;
  onAjustar: (delta: number, motivo: string) => void;
  onMinimo: (v: number) => void;
  onHistorial: () => void;
}) {
  const [texto, setTexto] = useState("0");
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [editMin, setEditMin] = useState(false);
  const [min, setMin] = useState(i.stockMinimo > 0 ? String(i.stockMinimo).replace(".", ",") : "");

  const delta = Number(texto.replace(",", ".")) || 0;
  const nuevo = Math.round((i.stock + delta) * 1000) / 1000;
  const u = unidadCorta(i.unidad);
  const meses = consumoMes ? i.stock / consumoMes : null;
  const poner = (d: number) => setTexto(String(Math.round(d * 1000) / 1000).replace(".", ","));
  const ultimos = movimientos.slice(0, 6);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-5 py-4">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#ECE8FD] text-[#3A0CE3]">
          <IconoMaterial texto={`${categoria ?? ""} ${i.nombre}`} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-medium", GRIS)}>{[i.codigo, categoria ?? "Sin categoría"].filter(Boolean).join(" · ")}</p>
          <h2 className="text-lg leading-tight font-semibold">{i.nombre}</h2>
        </div>
        <Button variant="ghost" size="icon" aria-label="Editar material" onClick={onEditar} className="size-9 rounded-lg">
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onCerrar} className="size-9 rounded-lg lg:hidden">
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-[#F0EEF6] overflow-y-auto">
        <section className="px-5 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className={cn("text-xs", GRIS)}>En bodega</p>
              <p className="mt-0.5 text-[30px] leading-none font-semibold tabular-nums">
                {cant(i.stock)} <span className={cn("text-base font-medium", GRIS)}>{u}</span>
              </p>
            </div>
            <div className="text-right">
              <p className={cn("text-xs", GRIS)}>Valor</p>
              <p className="text-lg font-semibold tabular-nums">{clp(valorDe(i))}</p>
              <p className={cn("text-xs tabular-nums", GRIS)}>{clp(i.costo)} c/u</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#F8F7FC] px-3 py-2.5">
              <dt className={cn("text-[11px]", GRIS)}>Consumo promedio</dt>
              <dd className="mt-0.5 text-sm font-semibold">{consumoMes ? `${cant(Math.round(consumoMes * 10) / 10)} ${u} / mes` : "Sin consumo registrado"}</dd>
            </div>
            <div className="rounded-xl bg-[#F8F7FC] px-3 py-2.5">
              <dt className={cn("text-[11px]", GRIS)}>Alcanza para</dt>
              <dd className={cn("mt-0.5 text-sm font-semibold", meses !== null && meses < 2 && "text-[#A32020]")}>
                {meses === null ? "—" : meses >= 24 ? "Más de 2 años" : meses < 1 ? "Menos de 1 mes" : `${Math.floor(meses)} ${Math.floor(meses) === 1 ? "mes" : "meses"}`}
              </dd>
            </div>
          </dl>
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#EFEDF6] px-3 py-2.5">
            {i.stockMinimo > 0 ? <Bell className="size-4 shrink-0 text-[#0A7A52]" aria-hidden /> : <BellOff className="size-4 shrink-0 text-[#8A8799]" aria-hidden />}
            {editMin ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onMinimo(Number(min.replace(",", ".")) || 0);
                  setEditMin(false);
                }}
              >
                <span className="text-sm">Avisar con</span>
                <Input autoFocus inputMode="decimal" aria-label="Stock mínimo" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d,.]/g, ""))} className="h-8 w-20 rounded-lg border-[#E4E1F0] text-right shadow-none" />
                <span className={cn("text-sm", GRIS)}>{u}</span>
                <Button type="submit" size="sm" disabled={ocupado} className="ml-auto h-8 rounded-lg px-3 text-xs font-semibold">
                  Guardar
                </Button>
              </form>
            ) : (
              <>
                <span className="flex-1 text-sm">
                  {i.stockMinimo > 0 ? (
                    <>
                      Avisa cuando queden{" "}
                      <b className="font-semibold">
                        {cant(i.stockMinimo)} {u}
                      </b>
                    </>
                  ) : (
                    <span className={GRIS}>Sin aviso de stock bajo</span>
                  )}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setEditMin(true)} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-[#2A07A8]">
                  {i.stockMinimo > 0 ? "Cambiar" : "Definir aviso"}
                </Button>
              </>
            )}
          </div>
        </section>

        <section className="px-5 py-4">
          <p className="mb-2 text-[13px] font-semibold">Ajustar stock</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Restar" onClick={() => poner(delta - 1)} className="size-10 rounded-lg border-[#E4E1F0]">
              <Minus className="size-4" />
            </Button>
            <Input
              inputMode="decimal"
              aria-label="Cantidad a ajustar"
              value={texto}
              onChange={(e) => setTexto(e.target.value.replace(/[^\d,.+-]/g, ""))}
              className="h-10 w-20 rounded-lg border-[#E4E1F0] text-center font-semibold tabular-nums shadow-none"
            />
            <Button variant="outline" size="icon" aria-label="Sumar" onClick={() => poner(delta + 1)} className="size-10 rounded-lg border-[#E4E1F0]">
              <Plus className="size-4" />
            </Button>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as string)}>
              <SelectTrigger aria-label="Motivo" className="h-10 min-w-0 flex-1 rounded-lg border-[#E4E1F0] px-3">
                <SelectValue>{(v: string | null) => v ?? MOTIVOS[0]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {delta ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#F8F7FC] px-3 py-2 text-[13px]">
              <span>
                {cant(i.stock)} →{" "}
                <b className={cn("font-semibold", nuevo < 0 && "text-[#A32020]")}>
                  {cant(nuevo)} {u}
                </b>
              </span>
              <Button
                size="sm"
                disabled={nuevo < 0 || ocupado}
                onClick={() => {
                  onAjustar(delta, motivo);
                  setTexto("0");
                }}
                className="h-8 rounded-lg px-3 text-xs font-semibold"
              >
                Guardar ajuste
              </Button>
            </div>
          ) : (
            <p className={cn("mt-2 text-xs", GRIS)}>Las compras suman y las labores restan solas. Ajusta solo si el conteo no cuadra.</p>
          )}
        </section>

        <section className="px-5 py-4">
          <p className="mb-2 flex items-center justify-between text-[13px] font-semibold">
            <span>Movimientos</span>
            {movimientos.length > ultimos.length ? (
              <button type="button" onClick={onHistorial} className="text-xs font-semibold text-[#2A07A8] hover:underline">
                Ver todos
              </button>
            ) : null}
          </p>
          {ultimos.length ? (
            <ul className="flex flex-col gap-2.5">
              {ultimos.map((x) => {
                const entra = x.cantidad > 0;
                const tipo = x.origen === "MANUAL" || x.origen === "CORRECCION" ? "Ajuste" : entra ? "Entrada" : "Salida";
                return (
                  <li key={x.id} className="flex items-center gap-3 text-sm">
                    <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", entra ? "bg-[#E6F6EF] text-[#0A7A52]" : "bg-[#FDEFEF] text-[#A32020]")}>
                      {entra ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {TEXTO_ORIGEN_STOCK[x.origen]}
                        {x.motivo ? ` · ${x.motivo}` : ""}
                      </span>
                      <span className={cn("block text-xs", GRIS)}>
                        {DIA.format(new Date(x.fecha)).replaceAll("/", "-")} · {tipo}
                      </span>
                    </span>
                    <span className={cn("font-semibold tabular-nums", entra ? "text-[#075A3C]" : "text-[#A32020]")}>
                      {entra ? "+" : "−"}
                      {cant(Math.abs(x.cantidad))} {u}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={cn("text-sm", GRIS)}>Todavía no hay movimientos.</p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-[#F0EEF6] p-4">
        <Link href="/panel/compras" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-xl border-[#E4E1F0] font-semibold")}>
          <ShoppingCart className="size-4" />
          Comprar más
        </Link>
        <Link href="/panel/labores" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-xl border-[#E4E1F0] font-semibold")}>
          <Wrench className="size-4" />
          Usar en labor
        </Link>
      </div>
    </div>
  );
}

/** La consulta de Inventario: parte con lo que trajo el servidor y se actualiza sola (cada 10 segundos, al volver a la pestaña y cuando otra pestaña avisa un cambio). */
function useDatosInventario(inicial: DatosInventario) {
  return useQuery({ queryKey: ["inventario"], queryFn: () => consultarInventario(), initialData: inicial, refetchInterval: INTERVALO_RAPIDO }).data;
}

/** El inventario de bodega: cuánto vale lo que hay, qué se está acabando, y el detalle de cada material con su ajuste y sus movimientos. */
export function InventarioVista({
  insumos: insumosIniciales,
  categoriasPropias: propiasIniciales,
  historial: historialInicial,
}: {
  insumos: Insumo[];
  categoriasPropias: CategoriaPropia[];
  historial: MovimientoStockFila[];
}) {
  const cliente = useQueryClient();
  const { insumos, categoriasPropias, historial } = useDatosInventario({ insumos: insumosIniciales, categoriasPropias: propiasIniciales, historial: historialInicial });

  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [filtro, setFiltro] = useState<"todos" | "bajo" | "sin">("todos");
  const [orden, setOrden] = useState("valor");
  const [sel, setSel] = useState<string | null>(null);
  const [movil, setMovil] = useState(false);
  const [verCats, setVerCats] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [gestionandoCategorias, setGestionandoCategorias] = useState(false);
  const [verHistorial, setVerHistorial] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const cerrarForm = useCallback(() => {
    setCreando(false);
    setEditando(null);
  }, []);
  const cerrarCategorias = useCallback(() => setGestionandoCategorias(false), []);

  const hoy = hoyEnChile();
  const categorias = opcionesDeCategoria(
    categoriasPropias,
    insumos.map((i) => i.categoria)
  );
  const nombreCat = (i: Insumo) => textoCategoriaInsumo(i.categoria, categorias);
  // Cuántos materiales usa cada categoría propia, para avisar antes de borrarla.
  const usos: Record<string, number> = {};
  for (const i of insumos) {
    if (i.categoria.startsWith(PREFIJO_CATEGORIA_PROPIA)) {
      const id = i.categoria.slice(PREFIJO_CATEGORIA_PROPIA.length);
      usos[id] = (usos[id] ?? 0) + 1;
    }
  }

  const consumos = consumosMensuales(historial, hoy);
  const mesesDe = (i: Insumo) => {
    const c = consumos.get(i.nombre);
    return c ? i.stock / c : null;
  };

  const total = insumos.reduce((s, i) => s + valorDe(i), 0);
  const bajos = insumos.filter((i) => nivelDe(i) === "bajo" || nivelDe(i) === "agotado");
  const sinAviso = insumos.filter((i) => i.stockMinimo <= 0);
  const porCat = [...new Set(insumos.map((i) => nombreCat(i) ?? "Sin categoría"))]
    .map((c) => ({ c, v: insumos.filter((i) => (nombreCat(i) ?? "Sin categoría") === c).reduce((s, i) => s + valorDe(i), 0) }))
    .sort((a, b) => b.v - a.v);
  const resumenCat = porCat.length > 4 ? [...porCat.slice(0, 3), { c: "Otras", v: porCat.slice(3).reduce((s, x) => s + x.v, 0) }] : porCat;

  const q = busqueda.trim().toLowerCase();
  const visibles = insumos
    .filter((i) => {
      if (categoria === "sin" ? nombreCat(i) !== null : categoria !== "todas" && i.categoria !== categoria) return false;
      if (filtro === "bajo" && !bajos.includes(i)) return false;
      if (filtro === "sin" && i.stockMinimo > 0) return false;
      return !q || `${i.nombre} ${i.codigo ?? ""}`.toLowerCase().includes(q);
    })
    .sort((a, b) => (orden === "valor" ? valorDe(b) - valorDe(a) : orden === "nombre" ? a.nombre.localeCompare(b.nombre, "es") : (mesesDe(a) ?? 999) - (mesesDe(b) ?? 999)));

  // El detalle muestra el material elegido; mientras no se elige ninguno, el primero de la lista.
  const actual = insumos.find((i) => i.id === sel) ?? visibles[0] ?? null;

  useEffect(() => {
    if (!movil) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creando && !editando && verHistorial === null) setMovil(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [movil, creando, editando, verHistorial]);

  /** Aplica un cambio al instante en la pantalla; si el servidor lo rechaza, vuelve a como estaba. */
  function conCambioInmediato(id: string, cambio: Partial<Insumo>, guardar: () => Promise<{ ok: true } | { ok: false; error: string }>, exito: string) {
    const anterior = cliente.getQueryData<DatosInventario>(["inventario"]);
    cliente.setQueryData<DatosInventario>(["inventario"], (d) => (d ? { ...d, insumos: d.insumos.map((x) => (x.id === id ? { ...x, ...cambio } : x)) } : d));
    iniciar(async () => {
      const r = await guardar();
      if (r.ok) {
        toast.success(exito);
        avisarCambio("inventario");
      } else {
        toast.error(r.error);
        cliente.setQueryData(["inventario"], anterior);
      }
      void cliente.invalidateQueries({ queryKey: ["inventario"] });
    });
  }

  function ajustar(i: Insumo, delta: number, motivo: string) {
    const nuevo = Math.round((i.stock + delta) * 1000) / 1000;
    conCambioInmediato(i.id, { stock: nuevo }, () => ajustarStock(i.id, Math.abs(delta), delta > 0 ? "ENTRADA" : "SALIDA", motivo), delta > 0 ? "Entrada registrada" : "Salida registrada");
  }

  function definirMinimo(i: Insumo, v: number) {
    conCambioInmediato(i.id, { stockMinimo: v }, () => definirStockMinimo(i.id, v), v > 0 ? "Aviso guardado" : "Aviso quitado");
  }

  const detalle = (i: Insumo, alCerrar: () => void) => (
    <Detalle
      key={i.id}
      i={i}
      categoria={nombreCat(i)}
      consumoMes={consumos.get(i.nombre) ?? null}
      movimientos={historial.filter((h) => h.insumo === i.nombre)}
      ocupado={ocupado}
      onCerrar={alCerrar}
      onEditar={() => setEditando(i)}
      onAjustar={(d, m) => ajustar(i, d, m)}
      onMinimo={(v) => definirMinimo(i, v)}
      onHistorial={() => setVerHistorial(i.nombre)}
    />
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Inventario</h1>
          <p className={cn("mt-0.5 text-[15px]", GRIS)}>Los materiales en bodega. Las compras suman stock y las labores lo descuentan.</p>
        </div>
        <div data-tour="inv-acciones" className="flex gap-2">
          <Button variant="outline" className="h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold" onClick={() => setVerHistorial("")}>
            <History className="size-4" />
            <span className="hidden sm:inline">Historial</span>
          </Button>
          <Button variant="outline" className="h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold" onClick={() => setGestionandoCategorias(true)}>
            <Tags className="size-4" />
            <span className="hidden sm:inline">Categorías</span>
          </Button>
          <Button className="h-10 flex-1 rounded-lg px-4 font-semibold sm:flex-none" onClick={() => setCreando(true)}>
            <Plus />
            Nuevo material
          </Button>
        </div>
      </div>

      <section aria-label="Resumen" data-tour="inv-kpis" className={cn("mt-5 grid grid-cols-2 gap-y-4 rounded-2xl bg-card p-5 sm:p-6 lg:grid-cols-[1.6fr_1fr_1fr] lg:items-start lg:divide-x lg:divide-[#F0EEF6]", SOMBRA)}>
        <div className="col-span-2 lg:col-span-1 lg:pr-6">
          <p className={cn("text-[13px]", GRIS)}>Valor del inventario</p>
          <p className="mt-1 text-[32px] leading-none font-semibold tabular-nums">{clp(total)}</p>
          {total > 0 ? (
            <>
              <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={porCat.map((c) => `${c.c} ${clp(c.v)}`).join(", ")}>
                {resumenCat
                  .filter((c) => c.v > 0)
                  .map((c, i) => (
                    <span key={c.c} className={COLORES[i]} style={{ width: `${(c.v / total) * 100}%` }} />
                  ))}
              </div>
              <p className="mt-2 flex min-w-0 items-center gap-1.5 text-xs">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", COLORES[0])} />
                <span className={cn("truncate", GRIS)}>
                  <span className="hidden sm:inline">Mayor valor en </span>
                  <b className="font-semibold text-[#15132B]">{porCat[0]?.c}</b> · {Math.round(((porCat[0]?.v ?? 0) / total) * 100)}%
                </span>
                {porCat.length > 1 ? (
                  <button type="button" onClick={() => setVerCats((v) => !v)} aria-expanded={verCats} className="ml-auto shrink-0 font-semibold text-[#2A07A8] hover:underline">
                    {verCats ? "Ocultar" : `Ver ${porCat.length} categorías`}
                  </button>
                ) : null}
              </p>
              {verCats ? (
                <ul className="mt-3 max-h-[188px] divide-y divide-[#F3F1F8] overflow-y-auto rounded-xl border border-[#EFEDF6] text-[13px]">
                  {porCat.map((c, i) => (
                    <li key={c.c} className="flex items-center gap-2 px-3 py-2">
                      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", COLORES[Math.min(i, resumenCat.length - 1)])} />
                      <span className="min-w-0 flex-1 truncate">{c.c}</span>
                      <span className={cn("tabular-nums", GRIS)}>{clp(c.v)}</span>
                      <b className="w-9 text-right font-semibold tabular-nums">{Math.round((c.v / total) * 100)}%</b>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className={cn("mt-2 text-xs", GRIS)}>Aún no hay materiales con costo y stock.</p>
          )}
        </div>
        <button type="button" onClick={() => setFiltro(filtro === "bajo" ? "todos" : "bajo")} className="min-w-0 self-start text-left lg:px-6">
          <p className={cn("text-[13px]", GRIS)}>Stock bajo</p>
          <p className={cn("mt-1 text-[22px] leading-tight font-semibold tabular-nums", bajos.length ? "text-[#A32020]" : "text-[#075A3C]")}>
            {bajos.length ? `${bajos.length} ${bajos.length === 1 ? "material" : "materiales"}` : "Todo en orden"}
          </p>
          <p className={cn("mt-1 truncate text-xs", GRIS)}>{bajos.length ? bajos.map((i) => i.nombre).join(", ") : `${insumos.length} ${insumos.length === 1 ? "material con stock" : "materiales con stock"}`}</p>
        </button>
        <button type="button" onClick={() => setFiltro(filtro === "sin" ? "todos" : "sin")} className="min-w-0 self-start text-left lg:px-6">
          <p className={cn("text-[13px]", GRIS)}>Sin aviso de stock</p>
          <p className={cn("mt-1 text-[22px] leading-tight font-semibold tabular-nums", sinAviso.length ? "text-[#B86400]" : "")}>
            {sinAviso.length} de {insumos.length}
          </p>
          <p className={cn("mt-1 text-xs", GRIS)}>{sinAviso.length ? "Define un mínimo para que avise" : "Todos tienen aviso"}</p>
        </button>
      </section>

      {insumos.length === 0 ? (
        <div className={cn("mt-4 rounded-2xl bg-card px-6 py-14 text-center", SOMBRA)}>
          <span aria-hidden className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#ECE8FD] text-[#3A0CE3]">
            <Boxes className="size-6" />
          </span>
          <p className="mt-3 font-semibold">Todavía no registraste nada en el inventario</p>
          <p className={cn("mx-auto mt-1 max-w-xl text-sm", GRIS)}>Cloro, cañerías, medidores, repuestos de bomba: anota lo que guardas en bodega y te avisamos cuando se esté acabando.</p>
          <Button className="mt-4 h-10 rounded-lg font-semibold" onClick={() => setCreando(true)}>
            <Plus />
            Nuevo material
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div data-tour="inv-lista" className={cn("min-w-0 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
            <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input aria-label="Buscar material" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o código" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Select value={categoria} onValueChange={(v) => setCategoria(v as string)}>
                    <SelectTrigger aria-label="Categoría" className="h-10 w-full rounded-lg border-[#E4E1F0] px-3 sm:w-[200px]">
                      <SelectValue>{(v: string | null) => (v === "sin" ? "Sin categoría" : v && v !== "todas" ? (categorias.find((c) => c.valor === v)?.texto ?? "Categoría") : "Todas las categorías")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas las categorías</SelectItem>
                      {categorias.map((c) => (
                        <SelectItem key={c.valor} value={c.valor}>
                          {c.texto}
                        </SelectItem>
                      ))}
                      {insumos.some((i) => nombreCat(i) === null) ? <SelectItem value="sin">Sin categoría</SelectItem> : null}
                    </SelectContent>
                  </Select>
                  <Select value={orden} onValueChange={(v) => setOrden(v as string)}>
                    <SelectTrigger aria-label="Ordenar" className="h-10 w-full rounded-lg border-[#E4E1F0] px-3 sm:w-[160px]">
                      <SelectValue>{(v: string | null) => ORDENES.find((o) => o.valor === v)?.texto ?? ""}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ORDENES.map((o) => (
                        <SelectItem key={o.valor} value={o.valor}>
                          {o.texto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div data-tour="inv-filtros" role="tablist" aria-label="Filtro" className="grid grid-cols-3 gap-1 rounded-lg bg-[#F4F3F9] p-1 sm:w-[400px]">
                {(
                  [
                    ["todos", "Todos", insumos.length],
                    ["bajo", "Stock bajo", bajos.length],
                    ["sin", "Sin aviso", sinAviso.length],
                  ] as const
                ).map(([k, t, n]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={filtro === k}
                    onClick={() => setFiltro(k)}
                    className={cn("h-8 rounded-md text-[13px] font-semibold", filtro === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}
                  >
                    {t} <span className={cn("text-xs font-medium", filtro === k ? "text-[#6B46F5]" : "text-[#A19FB2]")}>{n}</span>
                  </button>
                ))}
              </div>
            </div>

            {visibles.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <Boxes className="mx-auto size-8 text-[#B4B2C4]" aria-hidden />
                <p className="mt-2 font-semibold">{filtro === "bajo" ? "Nada con stock bajo" : "Ningún material coincide"}</p>
                <p className={cn("mt-1 text-sm", GRIS)}>{filtro === "bajo" ? "Todos los materiales con aviso están sobre su mínimo." : "Prueba con otro filtro o búsqueda."}</p>
              </div>
            ) : (
              <>
                <div className={cn("hidden grid-cols-[minmax(0,1fr)_200px_110px_120px_20px] gap-4 border-b border-[#F3F1F8] bg-[#FAFAFD] px-5 py-2.5 text-xs font-medium md:grid", GRIS)}>
                  <span>Material</span>
                  <span>Stock</span>
                  <span className="text-right">Costo unitario</span>
                  <span className="text-right">Valor total</span>
                  <span />
                </div>
                <ul className="divide-y divide-[#F3F1F8]">
                  {visibles.map((i) => {
                    const activo = actual?.id === i.id;
                    const cat = nombreCat(i);
                    return (
                      <li key={i.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSel(i.id);
                            setMovil(true);
                          }}
                          aria-current={activo ? "true" : undefined}
                          className={cn(
                            "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-4 py-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[#C4B7FA] focus-visible:outline-none focus-visible:ring-inset md:grid-cols-[minmax(0,1fr)_200px_110px_120px_20px] md:px-5",
                            activo ? "bg-[#F5F3FE] shadow-[inset_3px_0_0_#3A0CE3]" : "hover:bg-[#FBFAFF]"
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EEFD] text-[#3A0CE3]">
                              <IconoMaterial texto={`${cat ?? ""} ${i.nombre}`} className="size-[18px]" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[15px] font-semibold">{i.nombre}</span>
                              <span className={cn("block truncate text-[13px]", GRIS)}>{[i.codigo, cat].filter(Boolean).join(" · ") || "Sin categoría"}</span>
                            </span>
                          </span>
                          <span className="text-right md:hidden">
                            <span className="block text-[15px] font-semibold tabular-nums">{clp(valorDe(i))}</span>
                            <span className={cn("block text-xs tabular-nums", GRIS)}>{clp(i.costo)} c/u</span>
                          </span>
                          <span className="col-span-2 pl-[52px] md:col-span-1 md:pl-0">
                            <StockCelda i={i} />
                          </span>
                          <span className={cn("hidden text-right text-sm tabular-nums md:block", GRIS)}>{clp(i.costo)}</span>
                          <span className="hidden text-right text-[15px] font-semibold tabular-nums md:block">{clp(valorDe(i))}</span>
                          <ChevronRight className="hidden size-4 text-[#B4B2C4] md:block" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className={cn("flex items-center justify-between gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3 text-sm", GRIS)}>
                  <span>
                    {visibles.length} {visibles.length === 1 ? "material" : "materiales"}
                  </span>
                  <span>
                    Valor <strong className="font-semibold text-[#15132B] tabular-nums">{clp(visibles.reduce((s, i) => s + valorDe(i), 0))}</strong>
                  </span>
                </div>
              </>
            )}
          </div>

          {actual ? <div className={cn("hidden h-[min(720px,calc(100vh-2rem))] overflow-hidden rounded-2xl bg-card text-sm lg:sticky lg:top-4 lg:block", SOMBRA)}>{detalle(actual, () => setSel(null))}</div> : null}
        </div>
      )}

      {actual && movil ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={`Detalle de ${actual.nombre}`}>
          <button type="button" aria-label="Cerrar" onClick={() => setMovil(false)} className="absolute inset-0 bg-[#15132B]/40" />
          <div className="absolute inset-x-0 bottom-0 h-[88vh] overflow-hidden rounded-t-2xl bg-white text-sm">{detalle(actual, () => setMovil(false))}</div>
        </div>
      ) : null}

      {(creando || editando) && <InsumoDialog key={editando?.id ?? "nuevo"} insumo={editando} categorias={categorias} onCerrar={cerrarForm} />}
      {gestionandoCategorias && <CategoriasDialog propias={categoriasPropias} usos={usos} onCerrar={cerrarCategorias} />}

      <Dialog open={verHistorial !== null} onOpenChange={(v) => !v && setVerHistorial(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium">Historial del inventario</DialogTitle>
            <DialogDescription className="text-[0.9rem]">Cada entrada y salida de stock: cuánto, por qué y quién lo hizo.</DialogDescription>
          </DialogHeader>
          {verHistorial !== null ? <HistorialStock key={verHistorial} historial={historial} busquedaInicial={verHistorial} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
