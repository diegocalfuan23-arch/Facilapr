"use client";

import { useCallback, useState } from "react";
import { Boxes, Building2, CalendarDays, Coins, Cog, Droplets, Gauge, Landmark, Mountain, Plus, ReceiptText, Search, Truck, Waves, Wrench, type LucideIcon } from "lucide-react";
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
const VIOLETA = "from-primary to-primary/70";
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
        "flex items-center gap-4 rounded-2xl border p-4 lg:p-5",
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

/** Los activos fijos del comité y cuánto vale cada uno hoy (depreciación lineal según su vida útil). */
export function ActivosVista({ activos }: { activos: ActivoFila[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<ActivoFila | null>(null);
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
  }, []);

  const hoy = hoyEnChile();
  const vigentes = activos.filter((a) => a.estado !== "BAJA");
  const costoTotal = vigentes.reduce((s, a) => s + a.costo, 0);
  const valorTotal = vigentes.reduce((s, a) => s + valorActual(a, hoy).valorLibro, 0);
  const enReparacion = vigentes.filter((a) => a.estado === "EN_REPARACION").length;

  const q = busqueda.trim().toLowerCase();
  const filtrados = activos.filter((a) => {
    if (categoria !== "todas" && a.categoria !== categoria) return false;
    if (!q) return true;
    return a.nombre.toLowerCase().includes(q) || (a.codigo ?? "").toLowerCase().includes(q) || (a.ubicacion ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Bienes" valor={String(vigentes.length)} icono={Boxes} tono={VIOLETA} nota={activos.length > vigentes.length ? `${activos.length - vigentes.length} dados de baja` : undefined} />
        <Kpi label="Costo de adquisición" valor={clp.format(costoTotal)} icono={ReceiptText} tono={AZUL} />
        <Kpi label="Valor actual" valor={clp.format(valorTotal)} icono={Coins} tono={VERDE} resaltado="verde" />
        <Kpi label="En reparación" valor={String(enReparacion)} icono={Wrench} tono="from-amber-500 to-amber-700" resaltado={enReparacion > 0 ? "ambar" : undefined} />
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
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
          <Button className={cn(alto, "rounded-full px-5 text-[0.95rem]")} onClick={() => setCreando(true)}>
            <Plus aria-hidden />
            Nuevo bien
          </Button>
        </div>
      </div>

      {filtrados.length === 0 ? (
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
          <div className="scroll-fino hidden overflow-x-auto rounded-2xl border border-border md:block">
            <table className="w-full min-w-200 border-collapse text-[0.95rem]">
              <thead>
                <tr className="border-b border-border bg-card">
                  {["Bien", "Categoría", "Adquirido", "Costo", "Valor actual", "Estado"].map((c) => (
                    <th key={c} className="px-5 py-4 text-left text-[0.85rem] font-medium whitespace-nowrap text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((a) => (
                  <tr key={a.id} onClick={() => setEditando(a)} className={cn("cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/50", a.estado === "BAJA" && "opacity-60")}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <IconoBien categoria={a.categoria} />
                        <div className="min-w-0">
                          <p className="font-semibold">{a.nombre}</p>
                          {(a.codigo || a.ubicacion) && <p className="text-[0.8rem] text-muted-foreground">{[a.codigo, a.ubicacion].filter(Boolean).join(" · ")}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">{textoCategoriaActivo(a.categoria)}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{fechaCorta(a.fechaAdquisicion)}</td>
                    <td className="px-5 py-4 whitespace-nowrap tabular-nums">{clp.format(a.costo)}</td>
                    <td className="px-5 py-4">
                      <ValorHoy a={a} hoy={hoy} />
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <EstadoInsignia estado={a.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {filtrados.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setEditando(a)}
                className={cn("rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50", a.estado === "BAJA" && "opacity-60")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <IconoBien categoria={a.categoria} />
                    <div className="min-w-0">
                      <p className="leading-tight font-semibold">{a.nombre}</p>
                      <p className="text-[0.8rem] text-muted-foreground">{textoCategoriaActivo(a.categoria)}</p>
                    </div>
                  </div>
                  <EstadoInsignia estado={a.estado} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-muted/60 px-3 py-2">
                    <p className="text-[0.75rem] text-muted-foreground">Costo</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{clp.format(a.costo)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 px-3 py-2">
                    <p className="flex items-center gap-1 text-[0.75rem] text-muted-foreground">
                      <CalendarDays className="size-3.5" aria-hidden />
                      Adquirido
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{fechaCorta(a.fechaAdquisicion)}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-1 text-[0.75rem] text-muted-foreground">Valor actual</p>
                  <ValorHoy a={a} hoy={hoy} />
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
