"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, CalendarCheck2, CalendarDays, Car, ChevronRight, Cog, Droplets, FileText, Gauge, Hash, Landmark, MapPin, Mountain, Package, Pencil, Plus, Search, UserRound, Waves, Wrench, X } from "lucide-react";
import { cambiarEstadoActivo, consultarActivos, programarLaborMantencion } from "@/app/panel/activos/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivoDialog } from "@/components/panel/activo-dialog";
import { TEXTO_ESTADO_ACTIVO, textoCategoriaActivo, valorActual, type ActivoFila, type EstadoActivo } from "@/lib/activos-comun";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const COLORES = ["bg-[#6B46F5]", "bg-[#0B8BD3]", "bg-[#2FB386]", "bg-[#F0A23C]", "bg-[#B9B7C8]"];

const ESTADO: Record<EstadoActivo, { chip: string; punto: string }> = {
  OPERATIVO: { chip: "bg-[#E6F6EF] text-[#075A3C]", punto: "bg-[#0A9B68]" },
  EN_REPARACION: { chip: "bg-[#FFF3E5] text-[#8F4400]", punto: "bg-[#E58200]" },
  BAJA: { chip: "bg-[#F0EFF4] text-[#4A4760]", punto: "bg-[#A5A3B5]" },
};

const ESTADOS_FILTRO: EstadoActivo[] = ["OPERATIVO", "EN_REPARACION", "BAJA"];
const ORDENES = [
  { valor: "valor", texto: "Mayor valor" },
  { valor: "nombre", texto: "Nombre A–Z" },
  { valor: "fecha", texto: "Más recientes" },
];

/** El ícono de cada categoría de bien. */
function IconoCategoria({ categoria, className }: { categoria: string; className?: string }) {
  if (categoria === "BOMBA") return <Cog className={className} />;
  if (categoria === "ESTANQUE") return <Droplets className={className} />;
  if (categoria === "CAPTACION" || categoria === "RED") return <Waves className={className} />;
  if (categoria === "TERRENO") return <Mountain className={className} />;
  if (categoria === "EDIFICIO") return <Building2 className={className} />;
  if (categoria === "VEHICULO") return <Car className={className} />;
  if (categoria === "EQUIPO") return <Wrench className={className} />;
  if (categoria === "MEDIDORES") return <Gauge className={className} />;
  return <Landmark className={className} />;
}

/** Lo que vale hoy un bien; uno dado de baja ya no cuenta. */
const valorDe = (a: ActivoFila, hoy: string) => (a.estado === "BAJA" ? 0 : valorActual(a, hoy).valorLibro);
const porcentaje = (a: ActivoFila, hoy: string) => (a.costo > 0 ? Math.round((valorDe(a, hoy) / a.costo) * 100) : 0);

/** Meses completos entre la compra y hoy. */
function mesesDesde(iso: string, hoy: string) {
  const [ya, ma, da] = iso.split("-").map(Number);
  const [yh, mh, dh] = hoy.split("-").map(Number);
  return Math.max(0, (yh - ya) * 12 + (mh - ma) - (dh < da ? 1 : 0));
}

function hace(iso: string, hoy: string) {
  const meses = mesesDesde(iso, hoy);
  if (meses < 1) return "este mes";
  if (meses < 12) return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  return `hace ${anios} ${anios === 1 ? "año" : "años"}`;
}

function Chip({ e }: { e: EstadoActivo }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", ESTADO[e].chip)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", ESTADO[e].punto)} />
      {TEXTO_ESTADO_ACTIVO[e]}
    </span>
  );
}

/** Cuánto vale hoy el bien, con una barra de qué parte de su costo conserva. */
function Barra({ a, hoy }: { a: ActivoFila; hoy: string }) {
  if (a.estado === "BAJA") return <span className={cn("block text-sm", GRIS)}>—</span>;
  const p = porcentaje(a, hoy);
  return (
    <span className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">{clp.format(valorDe(a, hoy))}</span>
        <span className={cn("text-xs tabular-nums", GRIS)}>{p}%</span>
      </span>
      <span role="img" aria-label={`Vale el ${p}% de su costo`} className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#EEEBF7]">
        <span className={cn("block h-full rounded-full", p < 40 ? "bg-[#E58200]" : "bg-[#6B46F5]")} style={{ width: `${Math.min(p, 100)}%` }} />
      </span>
    </span>
  );
}

/** La curva de depreciación lineal: de la compra al fin de la vida útil, con el punto de hoy. */
function Curva({ a, hoy }: { a: ActivoFila; hoy: string }) {
  const W = 320;
  const H = 96;
  const P = 4;
  const ini = Number(a.fechaAdquisicion.slice(0, 4));
  const fin = ini + a.vidaUtilAnios;
  const valor = valorDe(a, hoy);
  // El punto de hoy cae donde va la depreciación: depreciado ÷ costo del recorrido, que es lineal.
  const frac = a.costo > 0 ? 1 - valor / a.costo : 0;
  const hx = P + frac * (W - 2 * P);
  const hy = P + frac * (H - 2 * P);
  return (
    <figure className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full overflow-visible" role="img" aria-label={`Depreciación de ${clp.format(a.costo)} en ${ini} a $0 en ${fin}; hoy ${clp.format(valor)}`}>
        <defs>
          <linearGradient id={`g-${a.id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#6B46F5" stopOpacity="0.18" />
            <stop offset="1" stopColor="#6B46F5" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M${P},${P} L${hx},${hy} L${hx},${H} L${P},${H} Z`} fill={`url(#g-${a.id})`} />
        <line x1={P} y1={P} x2={hx} y2={hy} stroke="#6B46F5" strokeWidth="2" strokeLinecap="round" />
        <line x1={hx} y1={hy} x2={W - P} y2={H - P} stroke="#B9A9F8" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
        <line x1={hx} y1={0} x2={hx} y2={H} stroke="#DCD9E8" strokeDasharray="2 3" />
        <circle cx={hx} cy={hy} r="4.5" fill="#fff" stroke="#3A0CE3" strokeWidth="2" />
      </svg>
      <figcaption className={cn("relative mt-1 flex justify-between text-[11px] tabular-nums", GRIS)}>
        <span>{ini}</span>
        <span className="absolute -translate-x-1/2 font-semibold text-[#2A07A8]" style={{ left: `${(hx / W) * 100}%` }}>
          Hoy
        </span>
        <span>{fin} · $0</span>
      </figcaption>
    </figure>
  );
}

/** El detalle de un bien: cuánto vale, cómo se calcula, sus datos, y los botones para mandarlo a reparación o sacar su ficha. */
function Detalle({
  a,
  hoy,
  ocupado,
  onCerrar,
  onEditar,
  onEstado,
  onProgramar,
}: {
  a: ActivoFila;
  hoy: string;
  ocupado: boolean;
  onCerrar: () => void;
  onEditar: () => void;
  onEstado: (e: EstadoActivo) => void;
  onProgramar: () => void;
}) {
  const baja = a.estado === "BAJA";
  const sinDepreciar = a.vidaUtilAnios <= 0;
  const valor = valorDe(a, hoy);
  const dep = baja ? null : a.costo - valor;
  const quedan = Math.max(0, Math.round((a.vidaUtilAnios * 12 - mesesDesde(a.fechaAdquisicion, hoy)) / 12));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-5 py-4">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#ECE8FD] text-[#3A0CE3]">
          <IconoCategoria categoria={a.categoria} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-medium", GRIS)}>{textoCategoriaActivo(a.categoria)}</p>
          <h2 className="text-lg leading-tight font-semibold">{a.nombre}</h2>
          <div className="mt-1.5">
            <Chip e={a.estado} />
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Editar bien" onClick={onEditar} className="size-9 rounded-lg">
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onCerrar} className="size-9 rounded-lg lg:hidden">
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-[#F0EEF6] overflow-y-auto">
        {a.estado === "EN_REPARACION" ? (
          <div className="flex items-start gap-2.5 bg-[#FFF8EF] px-5 py-3 text-[13px] text-[#7A3B00]">
            <Wrench className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="flex-1">
              {a.reparacionDesde ? (
                <>
                  <b className="font-semibold">En reparación desde el {fechaCorta(a.reparacionDesde)}.</b>
                  {a.reparacionMotivo ? ` ${a.reparacionMotivo}.` : " Cuando vuelva a funcionar, márcalo como operativo."}
                </>
              ) : (
                <>
                  <b className="font-semibold">En reparación.</b> Cuando vuelva a funcionar, márcalo como operativo.
                </>
              )}
            </span>
          </div>
        ) : null}
        {baja ? (
          <div className="flex items-start gap-2.5 bg-[#F4F3F9] px-5 py-3 text-[13px] text-[#4A4760]">
            <Package className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="flex-1">
              <b className="font-semibold">Dado de baja.</b> Ya no cuenta en el valor del patrimonio.
            </span>
          </div>
        ) : null}

        <section className="px-5 py-4">
          <p className={cn("text-xs", GRIS)}>Valor actual</p>
          <p className="mt-0.5 text-[28px] leading-none font-semibold tabular-nums">{baja ? "—" : clp.format(valor)}</p>
          {!baja && !sinDepreciar ? <Curva a={a} hoy={hoy} /> : null}
          {!baja && sinDepreciar ? <p className={cn("mt-2 text-xs", GRIS)}>Este bien no se deprecia: su valor se mantiene.</p> : null}
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["Costo", clp.format(a.costo)],
                ["Depreciado", dep === null ? "—" : clp.format(dep)],
                ["Conserva", baja ? "—" : `${porcentaje(a, hoy)}%`],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-[#F8F7FC] px-2 py-2.5">
                <dt className={cn("text-[11px]", GRIS)}>{k}</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 px-5 py-4 text-sm">
          <div>
            <dt className={cn("flex items-center gap-1.5 text-xs", GRIS)}>
              <Hash className="size-3.5" aria-hidden />
              Código
            </dt>
            <dd className={cn("mt-0.5 font-medium", !a.codigo && GRIS)}>{a.codigo ?? "Sin código"}</dd>
          </div>
          <div>
            <dt className={cn("flex items-center gap-1.5 text-xs", GRIS)}>
              <CalendarDays className="size-3.5" aria-hidden />
              Adquirido
            </dt>
            <dd className="mt-0.5 font-medium tabular-nums">{fechaCorta(a.fechaAdquisicion)}</dd>
          </div>
          <div>
            <dt className={cn("flex items-center gap-1.5 text-xs", GRIS)}>
              <MapPin className="size-3.5" aria-hidden />
              Ubicación
            </dt>
            <dd className={cn("mt-0.5 font-medium", !a.ubicacion && GRIS)}>{a.ubicacion ?? "Sin ubicación"}</dd>
          </div>
          <div>
            <dt className={cn("flex items-center gap-1.5 text-xs", GRIS)}>
              <CalendarDays className="size-3.5" aria-hidden />
              Vida útil
            </dt>
            <dd className="mt-0.5 font-medium">
              {sinDepreciar ? (
                "No se deprecia"
              ) : (
                <>
                  {a.vidaUtilAnios} {a.vidaUtilAnios === 1 ? "año" : "años"} <span className={cn("font-normal", GRIS)}>· quedan {quedan}</span>
                </>
              )}
            </dd>
          </div>
          {a.responsable ? (
            <div className="col-span-2">
              <dt className={cn("flex items-center gap-1.5 text-xs", GRIS)}>
                <UserRound className="size-3.5" aria-hidden />
                Responsable
              </dt>
              <dd className="mt-0.5 font-medium">{a.responsable}</dd>
            </div>
          ) : null}
          {!sinDepreciar ? (
            <div className="col-span-2 rounded-xl bg-[#F8F7FC] px-3 py-2.5 text-[13px]">
              <span className={GRIS}>Depreciación lineal: </span>
              <b className="font-semibold tabular-nums">{clp.format(a.costo / a.vidaUtilAnios)} al año</b>
              <span className={GRIS}>
                {" "}
                ({clp.format(a.costo)} ÷ {a.vidaUtilAnios} {a.vidaUtilAnios === 1 ? "año" : "años"})
              </span>
            </div>
          ) : null}
        </dl>

        {a.proximaMantencion ? (
          <div className="flex items-center gap-3 px-5 py-3.5">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E2F2FC] text-[#0A5F91]">
              <CalendarCheck2 className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="block font-medium">Próxima mantención</span>
              <span className={cn("block text-xs tabular-nums", GRIS)}>{fechaCorta(a.proximaMantencion)}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={onProgramar} disabled={ocupado} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-[#2A07A8]">
              Programar labor
            </Button>
          </div>
        ) : null}

        {a.notas ? (
          <section className="px-5 py-4">
            <p className="mb-1.5 text-[13px] font-semibold">Notas</p>
            <p className={cn("text-sm whitespace-pre-line", GRIS)}>{a.notas}</p>
          </section>
        ) : null}

        <section className="px-5 py-4">
          <p className="mb-2 text-[13px] font-semibold">Historial</p>
          <ol className="flex flex-col gap-3 border-l-2 border-[#ECEAF4] pl-4 text-[13px]">
            {a.estado === "EN_REPARACION" && a.reparacionDesde ? (
              <li className="relative">
                <span aria-hidden className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-[#E58200] ring-4 ring-white" />
                <b className="font-semibold">Enviado a reparación</b>
                <span className={cn("block", GRIS)}>
                  {fechaCorta(a.reparacionDesde)}
                  {a.reparacionMotivo ? ` · ${a.reparacionMotivo}` : ""}
                </span>
              </li>
            ) : null}
            <li className="relative">
              <span aria-hidden className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-[#6B46F5] ring-4 ring-white" />
              <b className="font-semibold">Adquirido</b>
              <span className={cn("block", GRIS)}>
                {fechaCorta(a.fechaAdquisicion)} · {clp.format(a.costo)}
              </span>
              {a.costoEnCaja ? <span className={cn("block", GRIS)}>El costo quedó anotado como egreso en Caja.</span> : null}
            </li>
          </ol>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-[#F0EEF6] p-4">
        {a.estado === "EN_REPARACION" ? (
          <Button onClick={() => onEstado("OPERATIVO")} disabled={ocupado} className="h-11 rounded-xl bg-[#0A9B68] font-semibold hover:bg-[#0A9B68]/90">
            Marcar operativo
          </Button>
        ) : baja ? (
          <Button variant="outline" onClick={() => onEstado("OPERATIVO")} disabled={ocupado} className="h-11 rounded-xl border-[#E4E1F0] font-semibold">
            Volver a operativo
          </Button>
        ) : (
          <Button variant="outline" onClick={() => onEstado("EN_REPARACION")} disabled={ocupado} className="h-11 rounded-xl border-[#E4E1F0] font-semibold">
            <Wrench className="size-4" />
            Enviar a reparación
          </Button>
        )}
        <a href={`/panel/activos/ficha/${a.id}`} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-xl border-[#E4E1F0] font-semibold")}>
          <FileText className="size-4" />
          Ficha PDF
        </a>
      </div>
    </div>
  );
}

/** Los activos fijos del comité y cuánto vale cada uno hoy (depreciación lineal según su vida útil). */
export function ActivosVista({ activos: inicial }: { activos: ActivoFila[] }) {
  const cliente = useQueryClient();
  // Parte con lo que trajo el servidor y se actualiza sola: cada 30 segundos y al volver a la pestaña.
  const { data: activos } = useQuery({ queryKey: ["activos"], queryFn: () => consultarActivos(), initialData: inicial, refetchInterval: 30_000 });

  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [estado, setEstado] = useState<"todos" | EstadoActivo>("todos");
  const [orden, setOrden] = useState("valor");
  const [sel, setSel] = useState<string | null>(null);
  const [movil, setMovil] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<ActivoFila | null>(null);
  const [reparando, setReparando] = useState<ActivoFila | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, iniciar] = useTransition();
  const cerrar = useCallback(() => {
    setCreando(false);
    setEditando(null);
    // Si se guardó algo, la lista se vuelve a pedir enseguida.
    void cliente.invalidateQueries({ queryKey: ["activos"] });
  }, [cliente]);

  const hoy = hoyEnChile();

  function cambiarEstado(a: ActivoFila, nuevo: EstadoActivo, motivoReparacion?: string) {
    const anterior = activos;
    const desde = nuevo === "EN_REPARACION" ? hoy : null;
    const porQue = nuevo === "EN_REPARACION" ? motivoReparacion?.trim().slice(0, 200) || null : null;
    // El cambio se ve al instante; si el servidor lo rechaza, vuelve a como estaba.
    cliente.setQueryData<ActivoFila[]>(["activos"], (lista) =>
      lista?.map((x) => (x.id === a.id ? { ...x, estado: nuevo, reparacionDesde: desde, reparacionMotivo: porQue } : x))
    );
    iniciar(async () => {
      const r = await cambiarEstadoActivo(a.id, nuevo, motivoReparacion);
      if (r.ok) toast.success(nuevo === "EN_REPARACION" ? "Enviado a reparación" : "Marcado como operativo");
      else {
        toast.error(r.error);
        cliente.setQueryData(["activos"], anterior);
      }
      void cliente.invalidateQueries({ queryKey: ["activos"] });
    });
  }

  // El patrimonio cuenta solo los bienes vigentes: uno dado de baja ya no suma.
  const vigentes = activos.filter((a) => a.estado !== "BAJA");
  const costoTotal = vigentes.reduce((s, a) => s + a.costo, 0);
  const valorTotal = vigentes.reduce((s, a) => s + valorDe(a, hoy), 0);
  const enReparacion = vigentes.filter((a) => a.estado === "EN_REPARACION");
  const categorias = [...new Set(activos.map((a) => a.categoria))];
  const porCategoria = [...new Set(vigentes.map((a) => a.categoria))]
    .map((c) => ({ c, v: vigentes.filter((a) => a.categoria === c).reduce((s, a) => s + valorDe(a, hoy), 0) }))
    .sort((x, y) => y.v - x.v);

  const texto = busqueda.trim().toLowerCase();
  const visibles = activos
    .filter(
      (a) =>
        (categoria === "todas" || a.categoria === categoria) &&
        (estado === "todos" || a.estado === estado) &&
        (!texto || `${a.nombre} ${a.codigo ?? ""} ${a.ubicacion ?? ""}`.toLowerCase().includes(texto))
    )
    .sort((x, y) => (orden === "valor" ? valorDe(y, hoy) - valorDe(x, hoy) : orden === "nombre" ? x.nombre.localeCompare(y.nombre, "es") : y.fechaAdquisicion.localeCompare(x.fechaAdquisicion)));

  // El detalle muestra el bien elegido; mientras no se elige ninguno, el primero de la lista.
  const actual = activos.find((a) => a.id === sel) ?? visibles[0] ?? null;

  useEffect(() => {
    if (!movil) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creando && !editando) setMovil(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [movil, creando, editando]);

  function programar(a: ActivoFila) {
    iniciar(async () => {
      const r = await programarLaborMantencion(a.id);
      if (r.ok) toast.success(`Labor L-${r.numero} programada`, { description: "La ves en Labores, con la fecha de la próxima mantención." });
      else toast.error(r.error);
    });
  }

  const detalle = (a: ActivoFila, alCerrar: () => void) => (
    <Detalle
      key={a.id}
      a={a}
      hoy={hoy}
      ocupado={ocupado}
      onCerrar={alCerrar}
      onEditar={() => setEditando(a)}
      onEstado={(e) => {
        if (e === "EN_REPARACION") {
          setMotivo("");
          setReparando(a);
        } else cambiarEstado(a, e);
      }}
      onProgramar={() => programar(a)}
    />
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Activos fijos</h1>
          <p className={cn("mt-0.5 text-[15px]", GRIS)}>Los bienes del comité: qué tienes, cuánto costó y cuánto vale hoy.</p>
        </div>
        <Button data-tour="act-nuevo" className="h-10 rounded-lg px-4 font-semibold" onClick={() => setCreando(true)}>
          <Plus />
          Nuevo bien
        </Button>
      </div>

      <section aria-label="Resumen" data-tour="act-kpis" className={cn("mt-5 grid grid-cols-2 gap-y-4 rounded-2xl bg-card p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:divide-x lg:divide-[#F0EEF6]", SOMBRA)}>
        <div className="col-span-2 lg:col-span-1 lg:pr-6">
          <p className={cn("text-[13px]", GRIS)}>Valor actual del patrimonio</p>
          <p className="mt-1 text-[32px] leading-none font-semibold tabular-nums">{clp.format(valorTotal)}</p>
          {valorTotal > 0 ? (
            <>
              <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={porCategoria.map((c) => `${textoCategoriaActivo(c.c)} ${clp.format(c.v)}`).join(", ")}>
                {porCategoria
                  .filter((c) => c.v > 0)
                  .map((c, i) => (
                    <span key={c.c} className={COLORES[i % COLORES.length]} style={{ width: `${(c.v / valorTotal) * 100}%` }} />
                  ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {porCategoria
                  .filter((c) => c.v > 0)
                  .map((c, i) => (
                    <li key={c.c} className="flex items-center gap-1.5">
                      <span aria-hidden className={cn("size-2 rounded-full", COLORES[i % COLORES.length])} />
                      <span className={GRIS}>{textoCategoriaActivo(c.c)}</span>
                      <b className="font-semibold tabular-nums">{clp.format(c.v)}</b>
                    </li>
                  ))}
              </ul>
            </>
          ) : null}
        </div>
        {(
          [
            ["Costo de adquisición", clp.format(costoTotal), `${vigentes.length} ${vigentes.length === 1 ? "bien" : "bienes"}`],
            ["Depreciación acumulada", clp.format(costoTotal - valorTotal), `${costoTotal > 0 ? Math.round(((costoTotal - valorTotal) / costoTotal) * 100) : 0}% del costo`],
            ["En reparación", String(enReparacion.length), enReparacion.length ? enReparacion.map((a) => a.nombre).join(", ") : "Todo operativo"],
          ] as const
        ).map(([k, v, d], i) => (
          <div key={k} className={cn("min-w-0 lg:px-6", i === 2 && "col-span-2 sm:col-span-1")}>
            <p className={cn("text-[13px]", GRIS)}>{k}</p>
            <p className={cn("mt-1 text-[22px] leading-tight font-semibold tabular-nums", i === 2 && enReparacion.length > 0 && "text-[#B86400]")}>{v}</p>
            <p className={cn("mt-1 truncate text-xs", GRIS)}>{d}</p>
          </div>
        ))}
      </section>

      {activos.length === 0 ? (
        <div className={cn("mt-4 rounded-2xl bg-card px-6 py-14 text-center", SOMBRA)}>
          <span aria-hidden className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#ECE8FD] text-[#3A0CE3]">
            <Package className="size-6" />
          </span>
          <p className="mt-3 font-semibold">Sin bienes registrados</p>
          <p className={cn("mx-auto mt-1 max-w-xl text-sm", GRIS)}>Registra la bomba, el estanque, el terreno y demás bienes del comité para saber qué tienes y cuánto vale.</p>
          <Button className="mt-4 h-10 rounded-lg font-semibold" onClick={() => setCreando(true)}>
            <Plus />
            Nuevo bien
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className={cn("min-w-0 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
            <div className="flex flex-col gap-2 border-b border-[#F0EEF6] p-4 sm:flex-row sm:items-center sm:px-5">
              <div data-tour="act-buscar" className="relative min-w-0 flex-1">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input aria-label="Buscar bien" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, código o ubicación" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Select value={categoria} onValueChange={(v) => setCategoria(v as string)}>
                  <SelectTrigger aria-label="Categoría" className="h-10 w-full rounded-lg border-[#E4E1F0] px-3 sm:w-[190px]">
                    <SelectValue>{(v: string | null) => (v && v !== "todas" ? textoCategoriaActivo(v) : "Todas las categorías")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las categorías</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c} value={c}>
                        {textoCategoriaActivo(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={estado} onValueChange={(v) => setEstado(v as "todos" | EstadoActivo)}>
                  <SelectTrigger aria-label="Estado" className="h-10 w-full rounded-lg border-[#E4E1F0] px-3 sm:w-[180px]">
                    <SelectValue>{(v: string | null) => (v && v !== "todos" ? TEXTO_ESTADO_ACTIVO[v as EstadoActivo] : "Todos los estados")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {ESTADOS_FILTRO.map((e) => (
                      <SelectItem key={e} value={e}>
                        {TEXTO_ESTADO_ACTIVO[e]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={orden} onValueChange={(v) => setOrden(v as string)}>
                  <SelectTrigger aria-label="Ordenar" className="col-span-2 h-10 w-full rounded-lg border-[#E4E1F0] px-3 sm:w-[150px]">
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

            {visibles.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <Package className="mx-auto size-8 text-[#B4B2C4]" aria-hidden />
                <p className="mt-2 font-semibold">Ningún bien coincide</p>
                <p className={cn("mt-1 text-sm", GRIS)}>Prueba con otro filtro o búsqueda.</p>
              </div>
            ) : (
              <>
                <div className={cn("hidden grid-cols-[minmax(0,1fr)_110px_120px_170px_130px_20px] gap-4 border-b border-[#F3F1F8] bg-[#FAFAFD] px-5 py-2.5 text-xs font-medium md:grid", GRIS)}>
                  <span>Bien</span>
                  <span>Adquirido</span>
                  <span className="text-right">Costo</span>
                  <span>Valor actual</span>
                  <span>Estado</span>
                  <span />
                </div>
                <ul className="divide-y divide-[#F3F1F8]">
                  {visibles.map((a) => {
                    const activo = actual?.id === a.id;
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSel(a.id);
                            setMovil(true);
                          }}
                          aria-current={activo ? "true" : undefined}
                          className={cn(
                            "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-4 py-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[#C4B7FA] focus-visible:outline-none focus-visible:ring-inset md:grid-cols-[minmax(0,1fr)_110px_120px_170px_130px_20px] md:px-5",
                            activo ? "bg-[#F5F3FE] shadow-[inset_3px_0_0_#3A0CE3]" : "hover:bg-[#FBFAFF]",
                            a.estado === "BAJA" && "opacity-60"
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F1EEFD] text-[#3A0CE3]">
                              <IconoCategoria categoria={a.categoria} className="size-[18px]" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[15px] font-semibold">{a.nombre}</span>
                              <span className={cn("block truncate text-[13px]", GRIS)}>
                                {a.codigo ? `${a.codigo} · ` : ""}
                                {a.ubicacion ?? textoCategoriaActivo(a.categoria)}
                              </span>
                            </span>
                          </span>
                          <span className="md:hidden">
                            <Chip e={a.estado} />
                          </span>
                          <span className="hidden text-sm tabular-nums md:block">
                            {fechaCorta(a.fechaAdquisicion)}
                            <span className={cn("block text-xs", GRIS)}>{hace(a.fechaAdquisicion, hoy)}</span>
                          </span>
                          <span className="hidden text-right text-sm tabular-nums md:block">{clp.format(a.costo)}</span>
                          <span className="col-span-2 pl-[52px] md:col-span-1 md:pl-0">
                            <Barra a={a} hoy={hoy} />
                          </span>
                          <span className="hidden md:block">
                            <Chip e={a.estado} />
                          </span>
                          <ChevronRight className="hidden size-4 text-[#B4B2C4] md:block" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className={cn("flex items-center justify-between gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3 text-sm", GRIS)}>
                  <span>
                    {visibles.length} {visibles.length === 1 ? "bien" : "bienes"}
                  </span>
                  <span>
                    Valor actual <strong className="font-semibold text-[#15132B] tabular-nums">{clp.format(visibles.reduce((s, a) => s + valorDe(a, hoy), 0))}</strong>
                  </span>
                </div>
              </>
            )}
          </div>

          {actual ? <div className={cn("hidden h-[min(700px,calc(100vh-2rem))] overflow-hidden rounded-2xl bg-card text-sm lg:sticky lg:top-4 lg:block", SOMBRA)}>{detalle(actual, () => setSel(null))}</div> : null}
        </div>
      )}

      {actual && movil ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={`Detalle de ${actual.nombre}`}>
          <button type="button" aria-label="Cerrar" onClick={() => setMovil(false)} className="absolute inset-0 bg-[#15132B]/40" />
          <div className="absolute inset-x-0 bottom-0 h-[88vh] overflow-hidden rounded-t-2xl bg-white text-sm">{detalle(actual, () => setMovil(false))}</div>
        </div>
      ) : null}

      {(creando || editando) && <ActivoDialog key={editando?.id ?? "nuevo"} activo={editando} onCerrar={cerrar} />}

      <Dialog open={reparando !== null} onOpenChange={(v) => !v && setReparando(null)}>
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium">Enviar a reparación</DialogTitle>
            <DialogDescription className="text-[0.9rem]">{reparando?.nombre}. Anota qué le pasó, así queda en su historial.</DialogDescription>
          </DialogHeader>
          <form
            className="mt-2 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (reparando) cambiarEstado(reparando, "EN_REPARACION", motivo);
              setReparando(null);
            }}
          >
            <div>
              <label htmlFor="act-motivo" className="mb-2 block text-[0.8rem] font-medium">
                Motivo (opcional)
              </label>
              <Input id="act-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: Filtración en la base" maxLength={200} className="h-10 px-3 text-[0.95rem]" autoFocus />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={() => setReparando(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="h-10 rounded-full px-5 text-[0.95rem]">
                Enviar a reparación
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
