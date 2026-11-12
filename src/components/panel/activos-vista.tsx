"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type ColumnDef, type ColumnFiltersState, type FilterFn, type SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Boxes, Building2, CalendarDays, Coins, Cog, Droplets, Gauge, Landmark, Mountain, Plus, ReceiptText, Search, Truck, Waves, Wrench, type LucideIcon } from "lucide-react";
import { consultarActivos } from "@/app/panel/activos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActivoDialog } from "@/components/panel/activo-dialog";
import { CATEGORIAS_ACTIVO, TEXTO_ESTADO_ACTIVO, textoCategoriaActivo, valorActual, type ActivoFila, type EstadoActivo } from "@/lib/activos-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const alto = "h-11";

const AZUL = "from-sky-500 to-sky-700";
const VIOLETA = "from-[#3A0CE3] to-[#6B46F5]";
const VERDE = "from-emerald-500 to-emerald-700";
const GRIS = "from-slate-500 to-slate-700";

/** Ícono y color de cada categoría. */
const CATEGORIA: Record<string, { icono: LucideIcon; tono: string }> = {
  BOMBA: { icono: Cog, tono: VIOLETA },
  ESTANQUE: { icono: Droplets, tono: AZUL },
  CAPTACION: { icono: Waves, tono: AZUL },
  RED: { icono: Waves, tono: AZUL },
  TERRENO: { icono: Mountain, tono: VERDE },
  EDIFICIO: { icono: Building2, tono: GRIS },
  VEHICULO: { icono: Truck, tono: VIOLETA },
  EQUIPO: { icono: Wrench, tono: GRIS },
  MEDIDORES: { icono: Gauge, tono: VERDE },
  OTRO: { icono: Landmark, tono: GRIS },
};
const categoriaDe = (c: string) => CATEGORIA[c] ?? CATEGORIA.OTRO;

const ESTILO_ESTADO: Record<EstadoActivo, string> = {
  OPERATIVO: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  EN_REPARACION: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  BAJA: "bg-muted text-muted-foreground",
};
const PUNTO_ESTADO: Record<EstadoActivo, string> = {
  OPERATIVO: "bg-emerald-500",
  EN_REPARACION: "bg-amber-500",
  BAJA: "bg-muted-foreground",
};

function Kpi({ label, valor, icono: Icono, tono, nota, resaltado }: { label: string; valor: string; icono: LucideIcon; tono: string; nota?: string; resaltado?: "verde" | "ambar" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 lg:p-5 shadow-[0_8px_24px_rgba(58,12,227,0.1)]",
        resaltado === "verde" && "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
        resaltado === "ambar" && "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
        !resaltado && "border-border bg-card"
      )}
    >
      <span aria-hidden className={cn("hidden size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm lg:flex", tono)}>
        <Icono className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.8rem] leading-tight font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl leading-tight font-bold tracking-tight tabular-nums sm:text-2xl">{valor}</p>
        {nota && <p className="mt-1 text-[0.75rem] text-muted-foreground">{nota}</p>}
      </div>
    </div>
  );
}

function IconoBien({ categoria, className }: { categoria: string; className?: string }) {
  const { icono: Icono, tono } = categoriaDe(categoria);
  return (
    <span aria-hidden className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", tono, className)}>
      <Icono className="size-5" />
    </span>
  );
}

function EstadoInsignia({ estado }: { estado: EstadoActivo }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.8rem] font-medium", ESTILO_ESTADO[estado])}>
      <span aria-hidden className={cn("size-1.5 rounded-full", PUNTO_ESTADO[estado])} />
      {TEXTO_ESTADO_ACTIVO[estado]}
    </span>
  );
}

/** Cuánto vale hoy el bien, con una barra de qué parte de su costo conserva. */
function ValorHoy({ a, hoy }: { a: ActivoFila; hoy: string }) {
  if (a.estado === "BAJA") return <span className="text-muted-foreground">—</span>;
  const v = valorActual(a, hoy);
  const pct = a.costo > 0 ? Math.round((v.valorLibro / a.costo) * 100) : 0;
  const barra = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-sky-500" : "bg-amber-500";
  return (
    <div className="min-w-40">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-bold tabular-nums">{clp.format(v.valorLibro)}</span>
        <span className="text-[0.8rem] font-medium text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div role="img" aria-label={`Vale el ${pct}% de su costo`} className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barra)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="mt-1 text-[0.75rem] text-muted-foreground">
        {a.vidaUtilAnios > 0 && v.valorLibro === 0 ? "Vida útil cumplida" : v.depreciado > 0 ? `Bajó ${clp.format(v.depreciado)}` : "Sin depreciar"}
      </p>
    </div>
  );
}

/** La búsqueda: por nombre, código o ubicación. */
const buscar: FilterFn<ActivoFila> = (fila, _columna, valor: string) => {
  const a = fila.original;
  const q = valor.trim().toLowerCase();
  return a.nombre.toLowerCase().includes(q) || (a.codigo ?? "").toLowerCase().includes(q) || (a.ubicacion ?? "").toLowerCase().includes(q);
};

/** Las columnas de la tabla: lo que se ordena y cómo se dibuja cada celda. */
const COLUMNAS: ColumnDef<ActivoFila>[] = [
  {
    accessorKey: "nombre",
    header: "Bien",
    cell: ({ row: { original: a } }) => (
      <div className="flex items-center gap-4">
        <IconoBien categoria={a.categoria} />
        <div className="min-w-0">
          <p className="font-semibold">{a.nombre}</p>
          {(a.codigo || a.ubicacion) && <p className="text-[0.8rem] text-muted-foreground">{[a.codigo, a.ubicacion].filter(Boolean).join(" · ")}</p>}
        </div>
      </div>
    ),
  },
  {
    id: "categoria",
    header: "Categoría",
    accessorFn: (a) => textoCategoriaActivo(a.categoria),
    // El filtro de categoría compara con el valor interno, no con el texto que se ve.
    filterFn: (fila, _columna, valor: string) => fila.original.categoria === valor,
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
  },
  {
    accessorKey: "fechaAdquisicion",
    header: "Adquirido",
    cell: ({ getValue }) => <span className="text-muted-foreground tabular-nums">{fechaCorta(getValue<string>())}</span>,
  },
  {
    accessorKey: "costo",
    header: "Costo",
    cell: ({ getValue }) => <span className="tabular-nums">{clp.format(getValue<number>())}</span>,
  },
  {
    id: "valorActual",
    header: "Valor actual",
    // Los dados de baja van al final al ordenar de mayor a menor.
    accessorFn: (a) => (a.estado === "BAJA" ? -1 : valorActual(a, hoyEnChile()).valorLibro),
    cell: ({ row }) => <ValorHoy a={row.original} hoy={hoyEnChile()} />,
  },
  {
    id: "estado",
    header: "Estado",
    accessorFn: (a) => TEXTO_ESTADO_ACTIVO[a.estado],
    cell: ({ row }) => <EstadoInsignia estado={row.original.estado} />,
  },
];

/** Los activos fijos del comité y cuánto vale cada uno hoy (depreciación lineal según su vida útil). */
export function ActivosVista({ activos: inicial }: { activos: ActivoFila[] }) {
  // TanStack Table devuelve funciones que React Compiler no puede memoizar sin dejar datos viejos: este componente queda fuera.
  "use no memo";
  const cliente = useQueryClient();
  // Parte con lo que trajo el servidor y se actualiza sola: cada 30 segundos y al volver a la pestaña.
  const { data: activos } = useQuery({ queryKey: ["activos"], queryFn: () => consultarActivos(), initialData: inicial, refetchInterval: 30_000 });

  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [orden, setOrden] = useState<SortingState>([]);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<ActivoFila | null>(null);
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
    // Si se guardó algo, la lista se vuelve a pedir enseguida.
    void cliente.invalidateQueries({ queryKey: ["activos"] });
  }, [cliente]);

  const filtros: ColumnFiltersState = categoria === "todas" ? [] : [{ id: "categoria", value: categoria }];
  const tabla = useReactTable({
    data: activos,
    columns: COLUMNAS,
    state: { sorting: orden, globalFilter: busqueda, columnFilters: filtros },
    onSortingChange: setOrden,
    globalFilterFn: buscar,
    getColumnCanGlobalFilter: () => true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const filas = tabla.getRowModel().rows;

  const hoy = hoyEnChile();
  const vigentes = activos.filter((a) => a.estado !== "BAJA");
  const costoTotal = vigentes.reduce((s, a) => s + a.costo, 0);
  const valorTotal = vigentes.reduce((s, a) => s + valorActual(a, hoy).valorLibro, 0);
  const enReparacion = vigentes.filter((a) => a.estado === "EN_REPARACION").length;

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4" data-tour="act-kpis">
        <Kpi label="Bienes" valor={String(vigentes.length)} icono={Boxes} tono={VIOLETA} nota={activos.length > vigentes.length ? `${activos.length - vigentes.length} dados de baja` : undefined} />
        <Kpi label="Costo de adquisición" valor={clp.format(costoTotal)} icono={ReceiptText} tono={AZUL} />
        <Kpi label="Valor actual" valor={clp.format(valorTotal)} icono={Coins} tono={VERDE} resaltado="verde" />
        <Kpi label="En reparación" valor={String(enReparacion)} icono={Wrench} tono="from-amber-500 to-amber-700" resaltado={enReparacion > 0 ? "ambar" : undefined} />
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md" data-tour="act-buscar">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, código o ubicación…"
            className={cn(alto, "rounded-full pr-5 pl-11 text-[0.95rem]")}
            aria-label="Buscar"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            aria-label="Categoría"
            className={cn(
              alto,
              "rounded-full border border-input bg-transparent px-5 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            )}
          >
            <option value="todas">Todas las categorías</option>
            {CATEGORIAS_ACTIVO.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.texto}
              </option>
            ))}
          </select>
          <Button data-tour="act-nuevo" className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
            <Plus aria-hidden />
            Nuevo bien
          </Button>
        </div>
      </div>

      {filas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">{activos.length === 0 ? "Sin bienes registrados" : "Nada coincide con la búsqueda"}</p>
          {activos.length === 0 && (
            <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
              Registra la bomba, el estanque, el terreno y demás bienes del comité para saber qué tienes y cuánto vale.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="scroll-fino hidden overflow-x-auto rounded-2xl bg-card shadow-[0_10px_26px_rgba(58,12,227,0.14)] md:block">
            <table className="w-full min-w-200 border-collapse text-[0.95rem]">
              <thead>
                {tabla.getHeaderGroups().map((grupo) => (
                  <tr key={grupo.id} className="bg-gradient-to-r from-[#3A0CE3] to-[#6B46F5] text-primary-foreground">
                    {grupo.headers.map((h) => {
                      const sentido = h.column.getIsSorted();
                      const Flecha = sentido === "asc" ? ArrowUp : sentido === "desc" ? ArrowDown : ArrowUpDown;
                      return (
                        <th key={h.id} aria-sort={sentido === "asc" ? "ascending" : sentido === "desc" ? "descending" : "none"} className="px-5 py-3 text-left text-[0.85rem] font-semibold whitespace-nowrap">
                          <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1.5 rounded focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <Flecha aria-hidden className={cn("size-3.5", !sentido && "opacity-50")} />
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.id} onClick={() => setEditando(fila.original)} className={cn("cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-primary/5", fila.original.estado === "BAJA" && "opacity-60")}>
                    {fila.getVisibleCells().map((celda) => (
                      <td key={celda.id} className={cn("px-5 py-4", celda.column.id !== "nombre" && celda.column.id !== "valorActual" && "whitespace-nowrap")}>
                        {flexRender(celda.column.columnDef.cell, celda.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {filas.map(({ original: a }) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setEditando(a)}
                className={cn("overflow-hidden rounded-2xl bg-card text-left shadow-[0_10px_26px_rgba(58,12,227,0.14)]", a.estado === "BAJA" && "opacity-60")}
              >
                <div className={cn("flex items-center justify-between gap-3 bg-gradient-to-r px-4 py-3 text-white", categoriaDe(a.categoria).tono)}>
                  <div className="min-w-0">
                    <p className="leading-tight font-bold">{a.nombre}</p>
                    <p className="text-[0.8rem] text-white/90">{a.codigo || textoCategoriaActivo(a.categoria)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[0.75rem] font-bold text-emerald-800">{TEXTO_ESTADO_ACTIVO[a.estado]}</span>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted/60 px-3 py-2">
                      <p className="text-[0.75rem] text-muted-foreground">Categoría</p>
                      <p className="mt-1 text-sm font-semibold">{textoCategoriaActivo(a.categoria)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/60 px-3 py-2">
                      <p className="flex items-center gap-1 text-[0.75rem] text-muted-foreground">
                        <CalendarDays className="size-3.5" aria-hidden />
                        Adquirido
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">{fechaCorta(a.fechaAdquisicion)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-4 border-t border-border pt-4">
                    <div>
                      <p className="text-[0.75rem] text-muted-foreground">Costo</p>
                      <p className="text-sm font-semibold tabular-nums">{clp.format(a.costo)}</p>
                    </div>
                    <ValorHoy a={a} hoy={hoy} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {(creando || editando) && <ActivoDialog key={editando?.id ?? "nuevo"} activo={editando} onCerrar={cerrar} />}
    </div>
  );
}
