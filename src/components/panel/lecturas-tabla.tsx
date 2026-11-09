"use client";

import { toast } from "sonner";
import { useActionState, useCallback, useMemo, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Droplets,
  FileUp,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  MapPinned,
  Search,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import {
  aprobarComoLecturaInicial,
  aprobarLectura,
  aprobarLecturasListas,
  editarLectura,
  eliminarLectura,
  rechazarLectura,
  registrarLectura,
  type ResultadoAccion,
} from "@/app/panel/lecturas/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatearPeriodo } from "@/lib/boletas";
import { AvatarSocio } from "@/components/panel/avatar-socio";
import { PanelCargaLectura, type ItemRuta } from "@/components/panel/panel-carga-lectura";
import { SelectorMesLecturas, largoDeMes } from "@/components/panel/selector-mes-lecturas";
import { aprobadasPorSocio, anteriorDe, consumoContra, consumoDe, ordenarRuta, promedioDe, type SocioDeRuta } from "@/lib/lecturas-calculos";
import { SocioBuscador, type OpcionSocio } from "@/components/panel/socio-buscador";
import { LecturasMasivasDialog } from "@/components/panel/lecturas-masivas-dialog";
import { INTERVALO_RAPIDO } from "@/lib/avisos-datos";
import { consultarLecturas } from "@/app/panel/lecturas/consulta-actions";
import type { DatosLecturas } from "@/lib/lecturas-datos";

type Estado = "PENDIENTE" | "APROBADA" | "RECHAZADA";

export type LecturaFila = {
  id: string;
  socio: string;
  rut: string;
  periodo: string;
  valor: number;
  observacion: string | null;
  estado: Estado;
  motivoRechazo: string | null;
  registradaPor: string | null;
  createdAt: Date;
  /** Última lectura aprobada del arranque (la base del consumo); null si es la primera. */
  anterior: number | null;
  socioId: string;
  /** Aprobada como punto de partida: no generó boleta. */
  inicial: boolean;
  /** Cambio de medidor: `valor` es lo que lleva el nuevo (parte en 0) y `finalAnterior` lo que marcaba el viejo. */
  medidorCambiado: boolean;
  finalAnterior: number | null;
};

type Motivo = "primera" | "menor";

export type SocioOpcion = OpcionSocio;

const LIMITE = 15;

const numero = new Intl.NumberFormat("es-CL");

const fechaHora = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ORDEN_ESTADO: Record<Estado, number> = { PENDIENTE: 0, RECHAZADA: 1, APROBADA: 2 };
const ETIQUETA_ESTADO: Record<Estado, string> = { PENDIENTE: "Por revisar", APROBADA: "Aprobada", RECHAZADA: "Rechazada" };

/** Las acciones de una lectura: corregirla, rechazarla (si espera revisión) o borrarla. */
function MenuAccionesLectura({
  l,
  onEditar,
  onRechazar,
  onEliminar,
}: {
  l: LecturaFila;
  onEditar: () => void;
  onRechazar: () => void;
  onEliminar: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Acciones para la lectura de ${l.socio}`} className="size-8 rounded-lg">
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {l.estado !== "RECHAZADA" && (
          <DropdownMenuItem onClick={onEditar}>
            <Pencil />
            Editar
          </DropdownMenuItem>
        )}
        {l.estado === "PENDIENTE" && (
          <DropdownMenuItem onClick={onRechazar}>
            <XCircle />
            Rechazar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={onEliminar}>
          <Trash2 />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type AccionesFila = {
  lectura: LecturaFila;
  /** El consumo en m³ contra la lectura anterior; null si es la primera. */
  consumo: number | null;
  /** La lectura anterior contra la que se midió. */
  anteriorMedida: number | null;
  onRechazar: () => void;
  onAprobada: () => void;
  onConfirmar: (motivo: Motivo) => void;
  onEditar: () => void;
  onEliminar: () => void;
};

function FilaLectura({ lectura: l, consumo, anteriorMedida, onRechazar, onAprobada, onConfirmar, onEditar, onEliminar }: AccionesFila) {
  const { aprobando, error, aprobar } = useAprobarLectura(l, onAprobada, onConfirmar);
  const pendiente = l.estado === "PENDIENTE";
  const inicial = l.estado === "APROBADA" ? l.inicial : consumo === null;
  const atras = consumo !== null && consumo < 0;

  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 md:grid-cols-[minmax(0,1fr)_104px_88px_132px_36px] md:px-5",
        pendiente ? "bg-[#FFFCF7]" : l.estado === "RECHAZADA" ? "bg-[#FFFAFA]" : "hover:bg-[#FBFAFF]"
      )}
    >
      <span className="flex min-w-0 items-start gap-3">
        <AvatarSocio id={l.socioId} nombre={l.socio} className="mt-0.5 size-9" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{l.socio}</span>
          <span className={cn("block text-xs", GRIS)}>
            {[l.rut, formatearPeriodo(l.periodo), anteriorMedida !== null ? `ant. ${numero.format(anteriorMedida)}` : null].filter(Boolean).join(" · ")}
          </span>
          {l.observacion && l.observacion !== "Lectura inicial" && (
            <span title={l.observacion} className={cn("mt-0.5 block max-w-xs truncate text-xs", GRIS)}>
              &ldquo;{l.observacion}&rdquo;
            </span>
          )}
          {l.estado === "RECHAZADA" && l.motivoRechazo && <span className="mt-1 block text-xs text-[#A32020]">Motivo: {l.motivoRechazo}</span>}
          <span className={cn("mt-0.5 block text-[11px]", GRIS)}>
            Registrada por {l.registradaPor ?? "—"} · {fechaHora.format(l.createdAt)}
          </span>
        </span>
      </span>

      <span className="text-right">
        {inicial ? (
          <span className="inline-flex rounded-md bg-[#F0EFF4] px-1.5 py-0.5 text-xs font-semibold text-[#4A4760]" title={l.estado === "APROBADA" ? "Punto de partida del medidor: no genera boleta." : "Primera lectura del arranque: al aprobarla se usa como inicial."}>
            {l.estado === "APROBADA" ? "Inicial" : "Primera"}
          </span>
        ) : (
          <span className={cn("block text-[15px] font-semibold tabular-nums", atras && "text-[#A32020]")}>
            {consumo! > 0 ? "+" : ""}
            {numero.format(consumo!)} <span className={cn("text-xs font-medium", GRIS)}>m³</span>
          </span>
        )}
        {atras && <span className="block text-[11px] font-semibold text-[#A32020]">Retrocede</span>}
        <span className={cn("block text-xs tabular-nums md:hidden", GRIS)}>lectura {numero.format(l.valor)}</span>
      </span>

      <span className={cn("hidden text-right text-sm tabular-nums md:block", GRIS)}>{numero.format(l.valor)}</span>

      <span className="flex flex-col items-start gap-1 md:items-end">
        {pendiente ? (
          <Button size="sm" aria-label={`Aprobar lectura de ${l.socio}`} disabled={aprobando} onClick={aprobar} className="h-8 rounded-lg bg-[#0A9B68] px-2.5 text-xs font-semibold hover:bg-[#0A9B68]/90">
            {aprobando ? <Loader2 className="animate-spin" /> : <Check className="size-3.5" />}
            Aprobar
          </Button>
        ) : (
          <span className={cn("inline-flex items-center gap-1 text-[13px] font-medium", l.estado === "APROBADA" ? "text-[#075A3C]" : "text-[#A32020]")}>
            {l.estado === "APROBADA" ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
            {ETIQUETA_ESTADO[l.estado]}
          </span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </span>

      <span className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto">
        <MenuAccionesLectura l={l} onEditar={onEditar} onRechazar={onRechazar} onEliminar={onEliminar} />
      </span>
    </li>
  );
}

/** Las lecturas del comité: carga siguiendo la ruta del mes (panel lateral) y revisión con filtros por mes y estado. */
export function LecturasTabla({ datos }: { datos: DatosLecturas }) {
  const cliente = useQueryClient();
  // Parte con lo que trajo el servidor y se actualiza sola: cada 10 segundos y al volver a la pestaña.
  const { data } = useQuery({ queryKey: ["lecturas"], queryFn: () => consultarLecturas(), initialData: datos, refetchInterval: INTERVALO_RAPIDO });
  const { lecturas, socios, arranquePorSocio } = data;
  /** Después de cualquier cambio (aprobar, rechazar, editar, cargar), la lista se vuelve a pedir enseguida. */
  const volverAPedir = useCallback(() => void cliente.invalidateQueries({ queryKey: ["lecturas"] }), [cliente]);
  const [hoy] = useState(() => new Date());
  const actual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  const [mes, setMes] = useState(actual);
  const [filtro, setFiltro] = useState<"todas" | Estado>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [limiteDe, setLimiteDe] = useState({ clave: "", n: LIMITE });
  const [panel, setPanel] = useState(false);
  const [creando, setCreando] = useState(false);
  const [rechazando, setRechazando] = useState<LecturaFila | null>(null);
  const [iniciales, setIniciales] = useState(false);
  const [aprobandoListas, setAprobandoListas] = useState(false);
  const [editando, setEditando] = useState<LecturaFila | null>(null);
  const [eliminando, setEliminando] = useState<LecturaFila | null>(null);
  const [confirmando, setConfirmando] = useState<{
    lectura: LecturaFila;
    motivo: Motivo;
  } | null>(null);
  // La ruta: a quién se saltó (va al final), a quién se eligió ir primero y a quién ya se le cargó (mientras llega la lista nueva).
  const [saltos, setSaltos] = useState<string[]>([]);
  const [primero, setPrimero] = useState<string | null>(null);
  const [registrados, setRegistrados] = useState<string[]>([]);

  const aprobadas = useMemo(() => aprobadasPorSocio(lecturas), [lecturas]);

  const conteoPorMes = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lecturas) m.set(l.periodo, (m.get(l.periodo) ?? 0) + 1);
    return m;
  }, [lecturas]);

  const enMes = useMemo(() => lecturas.filter((l) => mes === "todos" || l.periodo === mes), [lecturas, mes]);
  const cuenta = (e: Estado) => enMes.filter((l) => l.estado === e).length;
  const porRevisar = cuenta("PENDIENTE");
  const pendientesFuera = mes === "todos" ? 0 : lecturas.filter((l) => l.estado === "PENDIENTE" && l.periodo !== mes).length;

  const filtradas = useMemo(() => {
    const t = sinTildes(busqueda.trim());
    return enMes
      .filter((l) => (filtro === "todas" || l.estado === filtro) && (!t || sinTildes([l.socio, l.rut, l.periodo].join(" ")).includes(t)))
      .sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]);
  }, [enMes, filtro, busqueda]);

  // Las que se pueden aprobar sin preguntar: tienen una anterior y no retroceden.
  const listas = enMes.filter((l) => l.estado === "PENDIENTE" && l.anterior !== null && (l.medidorCambiado || l.valor >= l.anterior));
  const claveFiltro = `${mes}|${filtro}|${busqueda}`;
  const limite = limiteDe.clave === claveFiltro ? limiteDe.n : LIMITE;

  // La ruta del mes: los socios que todavía no tienen lectura este mes, por arranque y número.
  const leidosSet = useMemo(() => {
    const s = new Set(lecturas.filter((l) => l.periodo === actual && l.estado !== "RECHAZADA").map((l) => l.socioId));
    for (const id of registrados) s.add(id);
    return s;
  }, [lecturas, actual, registrados]);
  const leidos = socios.filter((s) => leidosSet.has(s.id)).length;
  const pct = socios.length ? Math.round((leidos / socios.length) * 100) : 0;

  const ruta: ItemRuta[] = useMemo(() => {
    const sinLeer: SocioDeRuta[] = socios
      .filter((s) => !leidosSet.has(s.id))
      .map((s) => ({ id: s.id, nombre: s.nombre, numeroCliente: s.numeroCliente ?? null, rut: s.rut, arranque: arranquePorSocio[s.id] ?? null }));
    const ordenada = ordenarRuta(sinLeer);
    const porId = new Map(ordenada.map((s) => [s.id, s]));
    const alFinal = saltos.map((id) => porId.get(id)).filter((s): s is SocioDeRuta => Boolean(s));
    const ini = primero ? porId.get(primero) : undefined;
    const resto = ordenada.filter((s) => s.id !== primero && !saltos.includes(s.id));
    const anteriorDe = new Map(socios.map((s) => [s.id, s.ultimaLectura ?? null]));
    return [...(ini ? [ini] : []), ...resto, ...alFinal].map((s) => {
      const previas = aprobadas.get(s.id);
      return {
        id: s.id,
        nombre: s.nombre,
        numeroCliente: s.numeroCliente,
        rut: s.rut,
        anterior: anteriorDe.get(s.id) ?? null,
        periodoAnterior: previas?.length ? previas[previas.length - 1].periodo : null,
        promedio: promedioDe(s.id, aprobadas),
      };
    });
  }, [socios, leidosSet, arranquePorSocio, saltos, primero, aprobadas]);

  function abrirPanel() {
    setMes(actual);
    setPanel(true);
  }

  const cerrarPanel = useCallback(() => setPanel(false), []);

  function saltar(id: string) {
    setSaltos((s) => [...s.filter((x) => x !== id), id]);
    setPrimero((p) => (p === id ? null : p));
  }

  function irA(id: string) {
    setSaltos((s) => s.filter((x) => x !== id));
    setPrimero(id);
  }

  function registrada(id: string) {
    setRegistrados((r) => [...r, id]);
    setPrimero((p) => (p === id ? null : p));
    toast.success("Lectura registrada");
    volverAPedir();
  }

  const tarjetas = [
    ["PENDIENTE", "Por revisar", Clock, "bg-[#FFF3E5] text-[#B86400]"],
    ["APROBADA", "Aprobadas", CheckCircle2, "bg-[#E6F6EF] text-[#0A7A52]"],
    ["RECHAZADA", "Rechazadas", XCircle, "bg-[#FDEFEF] text-[#C03A37]"],
  ] as const;

  const pestanas = [
    ["todas", "Todas", enMes.length],
    ["PENDIENTE", "Por revisar", porRevisar],
    ["APROBADA", "Aprobadas", cuenta("APROBADA")],
    ["RECHAZADA", "Rechazadas", cuenta("RECHAZADA")],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Lecturas</h1>
          <p className={cn("mt-0.5 hidden text-[15px] sm:block", GRIS)}>Revisa y aprueba las lecturas del mes. Al aprobar se genera la boleta.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link data-tour="lec-tecnicos" href="/panel/tecnicos" className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold")}>
            <UserCog />
            Operadores
          </Link>
          <Link data-tour="lec-terreno" href="/panel/lecturas/terreno" className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold")}>
            <MapPinned />
            Modo terreno
          </Link>
          <Button variant="outline" data-tour="lec-archivo" onClick={() => setIniciales(true)} className="h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold">
            <FileUp />
            Cargar desde archivo
          </Button>
          <Button data-tour="lec-nueva" onClick={abrirPanel} disabled={socios.length === 0} className="h-10 rounded-lg px-4 font-semibold">
            <Plus />
            Nueva lectura
          </Button>
        </div>
      </div>

      {socios.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-tertiary/40 bg-tertiary/10 px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-tertiary" />
          <p className="text-[0.88rem] leading-relaxed">
            <strong>Primero carga a tus socios.</strong> Las lecturas se toman por arranque.{" "}
            <Link href="/panel/socios" className="font-medium text-primary hover:underline">
              Ir a Socios
            </Link>
          </p>
        </div>
      )}

      <div data-tour="lec-kpis" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,1fr))]">
        <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-1">
          <SelectorMesLecturas mes={mes} actual={actual} onCambio={setMes} conteo={(k) => conteoPorMes.get(k) ?? 0} total={lecturas.length} />
          <div className="flex items-center gap-3 rounded-xl bg-white/80 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className={cn("flex justify-between text-xs", GRIS)}>
                <span>
                  Ruta de {largoDeMes(actual)} · <b className="font-semibold text-[#15132B] tabular-nums">{leidos}</b> de {socios.length}
                </span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div role="progressbar" aria-label="Avance de la ruta" aria-valuenow={leidos} aria-valuemin={0} aria-valuemax={socios.length} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEEBF7]">
                <span className="block h-full rounded-full bg-[#6B46F5]" style={{ width: `${leidos > 0 ? Math.max(pct, 2) : 0}%` }} />
              </div>
            </div>
            {ruta.length > 0 && (
              <Button size="sm" variant="ghost" onClick={abrirPanel} className="h-8 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-[#2A07A8] hover:bg-[#F1EEFD]">
                Continuar ruta
                <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        {tarjetas.map(([e, t, Icono, c]) => (
          <button key={e} type="button" onClick={() => setFiltro(filtro === e ? "todas" : e)} aria-pressed={filtro === e} className={cn("flex items-center gap-3 rounded-2xl bg-card p-4 text-left transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", SOMBRA, filtro === e ? "ring-2 ring-[#B9A9F8]" : "hover:shadow-[0_10px_28px_rgba(58,12,227,0.12)]")}>
            <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", c)}>
              <Icono className="size-5" />
            </span>
            <span>
              <span className={cn("block text-[13px]", GRIS)}>{t}</span>
              <span className="block text-[24px] leading-tight font-semibold tabular-nums">{cuenta(e)}</span>
            </span>
          </button>
        ))}
      </div>

      {pendientesFuera > 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FFF3E5] px-4 py-2.5 text-[13px] text-[#8F4400]">
          <Clock className="size-4 shrink-0" aria-hidden />
          Hay {pendientesFuera} lectura{pendientesFuera === 1 ? "" : "s"} por revisar en otros meses.
          <button type="button" onClick={() => { setMes("todos"); setFiltro("PENDIENTE"); }} className="font-semibold underline underline-offset-2">
            Verlas
          </button>
        </p>
      )}

      {lecturas.length === 0 ? (
        <div className={cn("flex flex-col items-center rounded-2xl bg-card px-6 py-14 text-center", SOMBRA)}>
          <span className="flex size-11 items-center justify-center rounded-full bg-[#F4F3F9]">
            <Droplets className="size-5 text-[#5B5970]" />
          </span>
          <h2 className="mt-4 text-[1rem] font-semibold">Aún no hay lecturas</h2>
          <p className={cn("mt-2 max-w-[48ch] text-[0.92rem] leading-relaxed", GRIS)}>
            Los operadores cargan las lecturas desde terreno y llegan aquí para tu revisión. También puedes cargar una tú misma.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/panel/tecnicos" className={cn(buttonVariants({ variant: "outline" }), "rounded-lg border-[#E4E1F0] font-semibold")}>
              <Users />
              Invitar operador
            </Link>
            <Button onClick={abrirPanel} disabled={socios.length === 0} className="rounded-lg font-semibold">
              <Plus />
              Nueva lectura
            </Button>
          </div>
        </div>
      ) : (
        <div className={cn("min-w-0 overflow-hidden rounded-2xl bg-card", SOMBRA)}>
          <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">{mes === "todos" ? "Lecturas de todos los meses" : `Lecturas de ${largoDeMes(mes)}`}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCreando(true)} disabled={socios.length === 0} className="h-9 rounded-lg px-3 font-semibold text-[#2A07A8]">
                  Lectura de otro mes
                </Button>
                {listas.length > 0 && (
                  <Button size="sm" onClick={() => setAprobandoListas(true)} className="h-9 rounded-lg bg-[#0A9B68] px-3 font-semibold hover:bg-[#0A9B68]/90">
                    <Check className="size-4" />
                    Aprobar las {listas.length} listas
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div data-tour="lec-pestanas" role="tablist" aria-label="Estado" className="grid grid-cols-4 gap-1 rounded-lg bg-[#F4F3F9] p-1 sm:w-[440px]">
                {pestanas.map(([k, t, n]) => (
                  <button key={k} type="button" role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)} className={cn("h-8 truncate rounded-md px-1 text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", filtro === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}>
                    {t} <span className={cn("text-xs font-medium tabular-nums", filtro === k ? "text-[#6B46F5]" : "text-[#A19FB2]")}>{n}</span>
                  </button>
                ))}
              </div>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input aria-label="Buscar lecturas" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Socio, RUT o período" className="h-10 rounded-lg border-[#E4E1F0] bg-white pl-9 shadow-none" />
              </div>
            </div>
            {porRevisar > listas.length && (
              <p className={cn("text-xs", GRIS)}>
                {porRevisar - listas.length} por revisar no entran en «listas»: no tienen anterior o retroceden. Revísalas una a una.
              </p>
            )}
          </div>

          {filtradas.length === 0 ? (
            <p className={cn("px-6 py-14 text-center text-sm", GRIS)}>{enMes.length === 0 ? `Sin lecturas en ${mes === "todos" ? "este comité" : largoDeMes(mes)}.` : "Ninguna lectura coincide con el filtro."}</p>
          ) : (
            <>
              <div data-tour="lec-tabla" className={cn("hidden grid-cols-[minmax(0,1fr)_104px_88px_132px_36px] gap-3 border-b border-[#F3F1F8] bg-[#FAFAFD] px-5 py-2 text-xs font-medium md:grid", GRIS)}>
                <span>Socio</span>
                <span className="text-right">Consumo</span>
                <span className="text-right">Lectura</span>
                <span className="text-right">Estado</span>
                <span />
              </div>
              <ul className="divide-y divide-[#F3F1F8]">
                {filtradas.slice(0, limite).map((l) => (
                  <FilaLectura
                    key={l.id}
                    lectura={l}
                    consumo={consumoDe(l, aprobadas)}
                    anteriorMedida={anteriorDe(l, aprobadas)}
                    onRechazar={() => setRechazando(l)}
                    onAprobada={() => volverAPedir()}
                    onConfirmar={(motivo) => setConfirmando({ lectura: l, motivo })}
                    onEditar={() => setEditando(l)}
                    onEliminar={() => setEliminando(l)}
                  />
                ))}
              </ul>
              {filtradas.length > limite && (
                <div className="border-t border-[#F0EEF6] p-2.5 text-center">
                  <Button variant="ghost" onClick={() => setLimiteDe({ clave: claveFiltro, n: limite + LIMITE })} className="h-9 rounded-lg font-semibold text-[#2A07A8]">
                    <ChevronDown />
                    Mostrar {Math.min(LIMITE, filtradas.length - limite)} más · quedan {filtradas.length - limite}
                  </Button>
                </div>
              )}
              <div className={cn("border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3 text-sm", GRIS)}>
                <span className="font-medium text-foreground tabular-nums">{filtradas.length}</span> {filtradas.length === 1 ? "lectura" : "lecturas"}
              </div>
            </>
          )}
        </div>
      )}

      {panel && (
        <PanelCargaLectura periodo={actual} totalSocios={socios.length} leidos={leidos} ruta={ruta} onCerrar={cerrarPanel} onSaltar={saltar} onIrA={irA} onRegistrada={registrada} />
      )}

      <NuevaLecturaDialog abierto={creando} onAbiertoChange={setCreando} socios={socios} onRegistrada={() => volverAPedir()} />

      <LecturasMasivasDialog abierto={iniciales} onAbiertoChange={setIniciales} />

      <AprobarListasDialog abierto={aprobandoListas} onAbiertoChange={setAprobandoListas} listas={listas} onHecho={() => volverAPedir()} />

      <EditarLecturaDialog
        lectura={editando}
        onCerrar={() => setEditando(null)}
        onHecho={() => {
          setEditando(null);
          volverAPedir();
        }}
      />

      <EliminarLecturaDialog
        lectura={eliminando}
        onCerrar={() => setEliminando(null)}
        onHecho={() => {
          setEliminando(null);
          volverAPedir();
        }}
      />

      <PrimeraLecturaDialog
        pendiente={confirmando}
        onCerrar={() => setConfirmando(null)}
        onHecho={() => {
          setConfirmando(null);
          volverAPedir();
        }}
      />

      <RechazarDialog lectura={rechazando} onOpenChange={(abierto) => !abierto && setRechazando(null)} onRechazada={() => volverAPedir()} />
    </div>
  );
}

/** Aprobar una lectura; sin anterior (o con una menor) se pregunta qué hacer. */
function useAprobarLectura(
  l: LecturaFila,
  onAprobada: () => void,
  onConfirmar: (motivo: Motivo) => void
) {
  const [aprobando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function aprobar() {
    // Sin lectura anterior (o con una menor) no se aprueba de golpe:
    // cobraría el medidor completo. Se pregunta qué hacer.
    if (l.anterior === null) return onConfirmar("primera");
    if (!l.medidorCambiado && l.valor < l.anterior) return onConfirmar("menor");
    iniciar(async () => {
      setError(null);
      const r = await aprobarLectura(l.id);
      if (r.ok) {
        toast.success("Lectura aprobada");
        onAprobada();
      } else if (r.codigo === "PRIMERA_LECTURA") onConfirmar("primera");
      else if (r.codigo === "LECTURA_MENOR") onConfirmar("menor");
      else setError(r.error);
    });
  }

  return { aprobando, error, aprobar };
}

/**
 * Aprobar en bloque las lecturas que no ofrecen dudas (con anterior y que no
 * retroceden): genera de una vez sus boletas. Las dudosas (primera lectura,
 * menor que la anterior) no entran: se resuelven de a una.
 */
function AprobarListasDialog({
  abierto,
  onAbiertoChange,
  listas,
  onHecho,
}: {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
  listas: LecturaFila[];
  onHecho: () => void;
}) {
  const [trabajando, iniciar] = useTransition();
  const [resultado, setResultado] = useState<{
    aprobadas: number;
    fallidas: { id: string; error: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalM3 = listas.reduce((s, l) => s + consumoContra(l, l.anterior ?? 0), 0);

  function cambiar(v: boolean) {
    onAbiertoChange(v);
    if (!v) {
      setResultado(null);
      setError(null);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogContent className="rounded-2xl p-6 sm:max-w-110">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Aprobar y generar boletas</DialogTitle>
          <DialogDescription>
            {resultado
              ? "Listo."
              : `${listas.length} ${listas.length === 1 ? "lectura" : "lecturas"} · ${numero.format(totalM3)} m³ en total.`}
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="flex flex-col gap-3 text-[0.9rem]">
            <p>
              <strong>{resultado.aprobadas}</strong> boletas generadas.
              {resultado.fallidas.length > 0 &&
                ` ${resultado.fallidas.length} no se pudieron aprobar y siguen por revisar.`}
            </p>
            {resultado.fallidas.length > 0 && (
              <ul className="max-h-40 overflow-y-auto text-[0.82rem] text-destructive">
                {resultado.fallidas.map((f) => (
                  <li key={f.id}>{f.error}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-[0.9rem] leading-relaxed">
            Se aprobarán estas lecturas y se creará la boleta de cada una, con el consumo calculado
            contra su lectura anterior. Las lecturas dudosas (primera lectura de un arranque o menor
            que la anterior) quedan fuera, para revisarlas de a una.
          </p>
        )}
        {error && <p className="text-[0.88rem] text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => cambiar(false)} disabled={trabajando} className="h-10 rounded-lg px-4 font-semibold">
            {resultado ? "Cerrar" : "Cancelar"}
          </Button>
          {!resultado && (
            <Button
              className="h-10 rounded-lg px-4 font-semibold bg-[#0A9B68] text-white hover:bg-[#0A9B68]/90" disabled={trabajando || listas.length === 0}
              onClick={() => {
                setError(null);
                iniciar(async () => {
                  const r = await aprobarLecturasListas(listas.map((l) => l.id));
                  if (!r.ok) return setError(r.error);
                  setResultado({ aprobadas: r.aprobadas, fallidas: r.fallidas });
                  toast.success(
                    `${r.aprobadas} ${r.aprobadas === 1 ? "lectura aprobada" : "lecturas aprobadas"}`
                  );
                  onHecho();
                });
              }}
            >
              {trabajando && <Loader2 className="animate-spin" />}
              Aprobar {listas.length}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Corregir el valor (o la observación) de una lectura. Si ya generó boleta, se recalcula. */
function EditarLecturaDialog({
  lectura,
  onCerrar,
  onHecho,
}: {
  lectura: LecturaFila | null;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [trabajando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={lectura !== null} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="rounded-2xl p-6 sm:max-w-110">
        {/* key: al abrir otra lectura el formulario parte con sus datos. */}
        {lectura && (
          <form
            key={lectura.id}
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const datos = new FormData(e.currentTarget);
              setError(null);
              iniciar(async () => {
                const r = await editarLectura(
                  lectura.id,
                  Number(String(datos.get("valor") ?? "").replace(/\D/g, "")),
                  String(datos.get("observacion") ?? "")
                );
                if (r.ok) onHecho();
                else setError(r.error);
              });
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Editar lectura</DialogTitle>
              <DialogDescription>
                {lectura.socio} · {formatearPeriodo(lectura.periodo)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editar-valor">Lectura del medidor</Label>
              <Input
                id="editar-valor"
                name="valor"
                inputMode="numeric"
                defaultValue={lectura.valor}
                required
                autoFocus
              />
              {lectura.estado === "APROBADA" && (
                <p className="text-[0.8rem] text-muted-foreground">
                  Ya está aprobada: si generó una boleta, se recalcula con el nuevo
                  valor (lo ya pagado se conserva). Solo se puede editar la última
                  lectura de cada arranque.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editar-observacion">Observación</Label>
              <Textarea
                id="editar-observacion"
                name="observacion"
                rows={2}
                maxLength={300}
                defaultValue={
                  lectura.observacion === "Lectura inicial" ? "" : (lectura.observacion ?? "")
                }
              />
            </div>

            {error && <p className="text-[0.85rem] text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onCerrar} className="h-10 rounded-lg px-4 font-semibold">
                Cancelar
              </Button>
              <Button type="submit" disabled={trabajando} className="h-10 rounded-lg px-4 font-semibold">
                {trabajando && <Loader2 className="animate-spin" />}
                Guardar cambios
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Eliminar una lectura; si generó una boleta, pide confirmar que se elimina también. */
function EliminarLecturaDialog({
  lectura,
  onCerrar,
  onHecho,
}: {
  lectura: LecturaFila | null;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [trabajando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conBoleta, setConBoleta] = useState(false);

  function cerrar() {
    setError(null);
    setConBoleta(false);
    onCerrar();
  }

  function eliminar() {
    if (!lectura) return;
    setError(null);
    iniciar(async () => {
      const r = await eliminarLectura(lectura.id, { tambienBoleta: conBoleta });
      if (r.ok) {
        setConBoleta(false);
        toast.success("Lectura eliminada");
        onHecho();
      } else if (r.codigo === "TIENE_BOLETA") {
        setConBoleta(true);
        setError(r.error);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <Dialog open={lectura !== null} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="rounded-2xl p-6 sm:max-w-110">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Eliminar lectura</DialogTitle>
          <DialogDescription>
            {lectura &&
              `${lectura.socio} · ${formatearPeriodo(lectura.periodo)} · lectura ${numero.format(lectura.valor)}`}
          </DialogDescription>
        </DialogHeader>

        <p className="text-[0.9rem] leading-relaxed">
          Se borrará la lectura y no se puede deshacer.
          {lectura?.estado === "APROBADA" &&
            " Al ser una lectura aprobada, la anterior vuelve a ser la base del próximo consumo."}
        </p>
        {error && (
          <p className="text-[0.85rem] text-destructive">
            {error}
            {conBoleta && " Confirma para eliminar la lectura y su boleta."}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={cerrar} disabled={trabajando} className="h-10 rounded-lg px-4 font-semibold">
            Cancelar
          </Button>
          <Button onClick={eliminar} disabled={trabajando} className="h-10 rounded-lg px-4 font-semibold bg-[#C03A37] text-white hover:bg-[#C03A37]/90">
            {trabajando && <Loader2 className="animate-spin" />}
            {conBoleta ? "Eliminar lectura y boleta" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Cuando no se puede aprobar de golpe: no hay lectura anterior (la primera de un
 * arranque) o la lectura es menor que la anterior (medidor nuevo). La salida
 * segura es usarla como PUNTO DE PARTIDA: queda registrada, no cobra nada, y
 * la próxima lectura calcula el consumo desde ella.
 */
function PrimeraLecturaDialog({
  pendiente,
  onCerrar,
  onHecho,
}: {
  pendiente: { lectura: LecturaFila; motivo: Motivo } | null;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [trabajando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const l = pendiente?.lectura;
  const primera = pendiente?.motivo === "primera";

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (r.ok) onHecho();
      else setError(r.error ?? "No pudimos completar la acción.");
    });
  }

  return (
    <Dialog open={pendiente !== null} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="rounded-2xl p-6 sm:max-w-120">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {primera ? "Primera lectura de este arranque" : "Lectura menor que la anterior"}
          </DialogTitle>
          <DialogDescription>
            {l && `${l.socio} · ${formatearPeriodo(l.periodo)} · lectura ${numero.format(l.valor)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-[0.9rem] leading-relaxed">
          {primera ? (
            <p>
              Todavía no hay una lectura anterior para calcular el consumo. Si la apruebas sin más, se
              cobraría <strong>el medidor completo ({l && numero.format(l.valor)} m³)</strong> como si
              fuera consumo de este mes.
            </p>
          ) : (
            <p>
              Un medidor no retrocede. Si se cambió por uno nuevo, usa esta lectura como punto de
              partida; si fue un error de digitación, recházala.
            </p>
          )}
          <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-[0.85rem]">
            <strong>Usarla como lectura inicial</strong> la deja registrada sin cobrar nada: la próxima
            lectura de este arranque calculará el consumo desde aquí.
          </p>
          {error && <p className="text-destructive">{error}</p>}
        </div>

        <DialogFooter className="sm:flex-wrap">
          <Button variant="ghost" onClick={onCerrar} disabled={trabajando} className="h-10 rounded-lg px-4 font-semibold">
            Cancelar
          </Button>
          {primera && (
            <Button
              variant="outline"
              className="h-10 rounded-lg px-4 font-semibold border-[#E4E1F0]" disabled={trabajando}
              onClick={() => l && correr(() => aprobarLectura(l.id, { cobrarDesdeCero: true }))}
            >
              Cobrar desde 0
            </Button>
          )}
          <Button
            className="h-10 rounded-lg px-4 font-semibold" disabled={trabajando}
            onClick={() => l && correr(() => aprobarComoLecturaInicial(l.id))}
          >
            {trabajando && <Loader2 className="animate-spin" />}
            Usar como lectura inicial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevaLecturaDialog({
  abierto,
  onAbiertoChange,
  socios,
  onRegistrada,
}: {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
  socios: SocioOpcion[];
  onRegistrada: () => void;
}) {
  // La lectura anterior del arranque elegido, para mostrar cuánto consumió.
  const [anterior, setAnterior] = useState<number | null>(null);
  const [valor, setValor] = useState("");
  const [cambioMedidor, setCambioMedidor] = useState(false);
  const [finalViejo, setFinalViejo] = useState("");
  const lectura = valor === "" ? null : Number(valor);
  const final = finalViejo === "" ? null : Number(finalViejo);
  const consumo =
    lectura === null || anterior === null
      ? null
      : cambioMedidor
        ? (final !== null ? final - anterior : 0) + lectura
        : lectura - anterior;
  const finalMenor = cambioMedidor && final !== null && anterior !== null && final < anterior;

  const [estado, accion, pendiente] = useActionState<
    ResultadoAccion | null,
    FormData
  >(async (prev, formData) => {
    const r = await registrarLectura(prev, formData);
    if (r.ok) {
      setValor("");
      setFinalViejo("");
      setCambioMedidor(false);
      setAnterior(null);
      onAbiertoChange(false);
      onRegistrada();
    }
    return r;
  }, null);

  // El reloj se lee una vez al montar, no en cada render.
  const [hoy] = useState(() => new Date());
  const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="rounded-2xl p-6 sm:max-w-130">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Nueva lectura</DialogTitle>
          <DialogDescription>
            Queda por revisar hasta que la apruebes; recién ahí se genera la
            boleta.
          </DialogDescription>
        </DialogHeader>

        <form action={accion} className="flex min-w-0 flex-col gap-4">
          <SocioBuscador socios={socios} onElegir={(s) => setAnterior(s?.ultimaLectura ?? null)} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nl-periodo">Período</Label>
              <Input
                id="nl-periodo"
                name="periodo"
                defaultValue={periodoActual}
                placeholder="2026-07"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nl-valor">{cambioMedidor ? "Lectura del medidor nuevo (m³)" : "Lectura actual del medidor (m³)"}</Label>
              <Input
                id="nl-valor"
                name="valor"
                inputMode="numeric"
                placeholder={cambioMedidor ? "0" : "1250"}
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^\d]/g, ""))}
                required
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[0.88rem] font-medium">
            <input
              type="checkbox"
              name="medidorCambiado"
              value="1"
              checked={cambioMedidor}
              onChange={(e) => setCambioMedidor(e.target.checked)}
              className="size-4 accent-primary"
            />
            Cambiaron el medidor este mes
          </label>
          {cambioMedidor && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nl-final">Lo que marcaba el medidor viejo al retirarlo (m³)</Label>
              <Input
                id="nl-final"
                name="lecturaFinalAnterior"
                inputMode="numeric"
                placeholder={anterior !== null ? `${anterior} o más` : "Ej.: 1420"}
                value={finalViejo}
                onChange={(e) => setFinalViejo(e.target.value.replace(/[^\d]/g, ""))}
              />
              <p className="text-xs text-muted-foreground">
                El medidor nuevo parte en 0. El consumo del mes es lo que consumió el viejo hasta retirarlo más lo que lleva el nuevo.
              </p>
            </div>
          )}

          {/* Lo que marca el medidor hoy es el total acumulado, no el consumo: el consumo es la diferencia con la lectura anterior. */}
          <p
            className={
              finalMenor || (consumo !== null && consumo < 0)
                ? "rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-[0.84rem] text-destructive"
                : "rounded-lg bg-muted/60 px-3.5 py-2.5 text-[0.84rem] text-muted-foreground"
            }
          >
            {finalMenor ? (
              <>La lectura final del medidor viejo no puede ser menor que la anterior ({anterior} m³).</>
            ) : cambioMedidor && anterior !== null && consumo !== null ? (
              <>
                Lectura anterior <strong className="tabular-nums">{anterior} m³</strong> · consumo del período{" "}
                <strong className="tabular-nums">{consumo} m³</strong>
                {final === null && " (sin la lectura final del viejo, solo cuenta lo del medidor nuevo)"}
              </>
            ) : anterior === null ? (
              "Escribe lo que marca el medidor ahora (el número acumulado, no el consumo). Si es la primera lectura de este arranque, no hay una anterior con la que comparar."
            ) : consumo === null ? (
              <>
                Lectura anterior: <strong className="tabular-nums">{anterior} m³</strong>. Escribe lo que marca el
                medidor ahora (el número acumulado): el consumo es la diferencia.
              </>
            ) : consumo < 0 ? (
              <>
                La lectura actual es menor que la anterior ({anterior} m³). Revisa el número o registra el
                cambio de medidor.
              </>
            ) : (
              <>
                Lectura anterior <strong className="tabular-nums">{anterior} m³</strong> · consumo del período{" "}
                <strong className="tabular-nums">{consumo} m³</strong>
              </>
            )}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nl-observacion">Observación (opcional)</Label>
            <Textarea
              id="nl-observacion"
              name="observacion"
              rows={2}
              maxLength={300}
              placeholder="Medidor con humedad, difícil de leer con precisión…"
            />
          </div>

          {estado && !estado.ok && (
            <p className="text-[0.88rem] text-destructive">{estado.error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onAbiertoChange(false)} className="h-10 rounded-lg px-4 font-semibold">
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente} className="h-10 rounded-lg px-4 font-semibold">
              {pendiente && <Loader2 className="animate-spin" />}
              Registrar lectura
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RechazarDialog({
  lectura,
  onOpenChange,
  onRechazada,
}: {
  lectura: LecturaFila | null;
  onOpenChange: (abierto: boolean) => void;
  onRechazada: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function enviar() {
    if (!lectura) return;
    setError(null);
    iniciar(async () => {
      const r = await rechazarLectura(lectura.id, motivo);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMotivo("");
      onOpenChange(false);
      onRechazada();
    });
  }

  return (
    <Dialog open={lectura !== null} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl p-6 sm:max-w-110">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Rechazar lectura</DialogTitle>
          <DialogDescription>
            {lectura &&
              `${lectura.socio} · ${formatearPeriodo(lectura.periodo)} · lectura ${lectura.valor}`}
          </DialogDescription>
        </DialogHeader>

        <Textarea
          rows={3}
          maxLength={300}
          className="min-h-[88px] rounded-lg border-[#E4E1F0] text-sm shadow-none"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: la lectura anterior era 1400, esta parece un error de tipeo."
        />

        {error && <p className="text-[0.85rem] text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-10 rounded-lg px-4 font-semibold">
            Cancelar
          </Button>
          <Button type="button" disabled={pendiente || motivo.trim() === ""} onClick={enviar} className="h-10 rounded-lg px-4 font-semibold bg-[#C03A37] text-white hover:bg-[#C03A37]/90">
            {pendiente && <Loader2 className="animate-spin" />}
            Rechazar lectura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
