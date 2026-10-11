"use client";

import { toast } from "sonner";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  FileUp,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  Search,
  Smartphone,
  Users,
  X,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatearPeriodo } from "@/lib/boletas";
import { SocioBuscador, type OpcionSocio } from "@/components/panel/socio-buscador";
import { LecturasMasivasDialog } from "@/components/panel/lecturas-masivas-dialog";

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
  /** Aprobada como punto de partida: no generó boleta. */
  inicial: boolean;
};

type Motivo = "primera" | "menor";

export type SocioOpcion = OpcionSocio;

const POR_PAGINA = 12;

const numero = new Intl.NumberFormat("es-CL");

const fechaHora = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const ESTILO_ESTADO: Record<
  Estado,
  { texto: string; clase: string; icono: typeof Clock }
> = {
  PENDIENTE: {
    texto: "Por revisar",
    clase: "bg-tertiary/15 text-tertiary",
    icono: Clock,
  },
  APROBADA: {
    texto: "Aprobada",
    clase: "bg-forest/10 text-forest",
    icono: CheckCircle2,
  },
  RECHAZADA: {
    texto: "Rechazada",
    clase: "bg-destructive/10 text-destructive",
    icono: XCircle,
  },
};

function TarjetaResumen({
  icono,
  color,
  etiqueta,
  valor,
}: {
  icono: React.ReactNode;
  color: string;
  etiqueta: string;
  valor: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg [&_svg]:size-4.5",
          color
        )}
      >
        {icono}
      </span>
      <div className="mt-4 text-[0.87rem] text-muted-foreground">{etiqueta}</div>
      <div className="mt-1 text-[1.6rem] leading-none font-semibold tabular-nums">
        {valor}
      </div>
    </div>
  );
}

export function LecturasTabla({
  lecturas,
  socios,
}: {
  lecturas: LecturaFila[];
  socios: SocioOpcion[];
}) {
  const router = useRouter();
  const porRevisar = lecturas.filter((l) => l.estado === "PENDIENTE").length;

  const [busqueda, setBusqueda] = useState("");
  // Lo primero que necesita la directiva es lo que espera su revisión.
  const [pestana, setPestana] = useState<"todas" | Estado>(
    porRevisar > 0 ? "PENDIENTE" : "todas"
  );
  const [periodo, setPeriodo] = useState("todos");
  const [pagina, setPagina] = useState(1);
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

  const periodos = useMemo(
    () => [...new Set(lecturas.map((l) => l.periodo))].sort().reverse(),
    [lecturas]
  );

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return lecturas.filter((l) => {
      if (pestana !== "todas" && l.estado !== pestana) return false;
      if (periodo !== "todos" && l.periodo !== periodo) return false;
      if (!termino) return true;
      return [l.socio, l.rut, l.periodo].join(" ").toLowerCase().includes(termino);
    });
  }, [lecturas, busqueda, pestana, periodo]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA
  );

  // Las que se pueden aprobar sin preguntar: tienen una anterior y no retroceden.
  const listas = lecturas.filter(
    (l) => l.estado === "PENDIENTE" && l.anterior !== null && l.valor >= l.anterior
  );
  const aprobadas = lecturas.filter((l) => l.estado === "APROBADA").length;
  const rechazadas = lecturas.filter((l) => l.estado === "RECHAZADA").length;

  const pestanas: { id: "todas" | Estado; label: string; cuenta?: number }[] = [
    { id: "todas", label: "Todas" },
    { id: "PENDIENTE", label: "Por revisar", cuenta: porRevisar },
    { id: "APROBADA", label: "Aprobadas" },
    { id: "RECHAZADA", label: "Rechazadas" },
  ];

  function cambiarFiltro(fn: () => void) {
    fn();
    setPagina(1);
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight">
            Lecturas
          </h1>
          <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
            Cada lectura aprobada genera o actualiza la boleta del período.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            data-tour="lec-tecnicos"
            href="/panel/tecnicos"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Users />
            Técnicos
          </Link>
          <Link
            data-tour="lec-terreno"
            href="/panel/lecturas/terreno"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Smartphone />
            Modo terreno
          </Link>
          <Button variant="outline" data-tour="lec-archivo" onClick={() => setIniciales(true)}>
            <FileUp />
            Cargar desde archivo
          </Button>
          <Button data-tour="lec-nueva" onClick={() => setCreando(true)} disabled={socios.length === 0}>
            <Plus />
            Nueva lectura
          </Button>
        </div>
      </div>

      {socios.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-tertiary/40 bg-tertiary/10 px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-tertiary" />
          <p className="text-[0.88rem] leading-relaxed">
            <strong>Primero carga a tus socios.</strong> Las lecturas se toman
            por arranque.{" "}
            <Link
              href="/panel/socios"
              className="font-medium text-primary hover:underline"
            >
              Ir a Socios
            </Link>
          </p>
        </div>
      )}

      {porRevisar > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-tertiary/40 bg-tertiary/10 px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-tertiary" />
          <p className="text-[0.88rem] leading-relaxed">
            <strong>
              {porRevisar}{" "}
              {porRevisar === 1
                ? "lectura espera tu revisión."
                : "lecturas esperan tu revisión."}
            </strong>{" "}
            Hasta que no se aprueben, no se genera la boleta del socio.
          </p>
          {listas.length > 0 && (
            <Button
              size="sm"
              className="ml-auto shrink-0"
              onClick={() => setAprobandoListas(true)}
            >
              <Check />
              Aprobar las {listas.length} listas
            </Button>
          )}
        </div>
      )}

      <div data-tour="lec-kpis" className="grid gap-4 sm:grid-cols-3">
        <TarjetaResumen
          icono={<Clock />}
          color="bg-tertiary/15 text-tertiary"
          etiqueta="Por revisar"
          valor={porRevisar}
        />
        <TarjetaResumen
          icono={<CheckCircle2 />}
          color="bg-forest/10 text-forest"
          etiqueta="Aprobadas"
          valor={aprobadas}
        />
        <TarjetaResumen
          icono={<XCircle />}
          color="bg-destructive/10 text-destructive"
          etiqueta="Rechazadas"
          valor={rechazadas}
        />
      </div>

      {lecturas.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted">
            <Droplets className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-[1rem] font-semibold">
            Aún no hay lecturas
          </h2>
          <p className="mt-2 max-w-[48ch] text-[0.92rem] leading-relaxed text-muted-foreground">
            Los técnicos cargan las lecturas desde terreno y llegan aquí para
            tu revisión. También puedes cargar una tú misma.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/panel/tecnicos"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Users />
              Invitar técnico
            </Link>
            <Button onClick={() => setCreando(true)} disabled={socios.length === 0}>
              <Plus />
              Nueva lectura
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div data-tour="lec-pestanas" className="flex gap-6 overflow-x-auto overflow-y-hidden border-b border-border/60 px-5">
            {pestanas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => cambiarFiltro(() => setPestana(p.id))}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 py-3.5 text-[0.9rem] font-medium transition-colors",
                  pestana === p.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
                {p.cuenta !== undefined && p.cuenta > 0 && (
                  <span className="rounded-full bg-tertiary/20 px-1.5 text-[0.72rem] font-semibold tabular-nums text-tertiary">
                    {p.cuenta}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 p-5">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => cambiarFiltro(() => setBusqueda(e.target.value))}
                placeholder="Buscar por socio, RUT o período…"
                aria-label="Buscar lecturas"
                className="h-10 border-transparent bg-muted/60 pl-10"
              />
            </div>
            <select
              value={periodo}
              onChange={(e) => cambiarFiltro(() => setPeriodo(e.target.value))}
              aria-label="Filtrar por período"
              className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="todos">Todos los períodos</option>
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {formatearPeriodo(p)}
                </option>
              ))}
            </select>
          </div>

          <div data-tour="lec-tabla" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-border/50 hover:bg-transparent">
                  {["Socio", "Período", "Lectura", "Registrada por", "Estado"].map(
                    (h) => (
                      <TableHead
                        key={h}
                        className="h-11 px-4 text-[0.87rem] font-medium text-muted-foreground"
                      >
                        {h}
                      </TableHead>
                    )
                  )}
                  <TableHead className="h-11 pr-5 text-right text-[0.87rem] font-medium text-muted-foreground">
                    Acción
                  </TableHead>
                  <TableHead className="h-11 w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-[0.92rem] text-muted-foreground"
                    >
                      Ninguna lectura coincide con el filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibles.map((l) => (
                    <FilaLectura
                      key={l.id}
                      lectura={l}
                      onRechazar={() => setRechazando(l)}
                      onAprobada={() => router.refresh()}
                      onConfirmar={(motivo) => setConfirmando({ lectura: l, motivo })}
                      onEditar={() => setEditando(l)}
                      onEliminar={() => setEliminando(l)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <p className="text-[0.87rem] text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">
                {filtradas.length}
              </span>{" "}
              {filtradas.length === 1 ? "lectura" : "lecturas"}
            </p>
            <div className="flex items-center gap-1 text-[0.87rem] text-muted-foreground">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={paginaActual === 1}
                onClick={() => setPagina(paginaActual - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft />
              </Button>
              <span className="rounded-md bg-muted px-2.5 py-1 font-medium tabular-nums text-foreground">
                {paginaActual}
              </span>
              <span className="px-1">de</span>
              <span className="tabular-nums">{totalPaginas}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPagina(paginaActual + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      )}

      <NuevaLecturaDialog
        abierto={creando}
        onAbiertoChange={setCreando}
        socios={socios}
        onRegistrada={() => router.refresh()}
      />

      <LecturasMasivasDialog abierto={iniciales} onAbiertoChange={setIniciales} />

      <AprobarListasDialog
        abierto={aprobandoListas}
        onAbiertoChange={setAprobandoListas}
        listas={listas}
        onHecho={() => router.refresh()}
      />

      <EditarLecturaDialog
        lectura={editando}
        onCerrar={() => setEditando(null)}
        onHecho={() => {
          setEditando(null);
          router.refresh();
        }}
      />

      <EliminarLecturaDialog
        lectura={eliminando}
        onCerrar={() => setEliminando(null)}
        onHecho={() => {
          setEliminando(null);
          router.refresh();
        }}
      />

      <PrimeraLecturaDialog
        pendiente={confirmando}
        onCerrar={() => setConfirmando(null)}
        onHecho={() => {
          setConfirmando(null);
          router.refresh();
        }}
      />

      <RechazarDialog
        lectura={rechazando}
        onOpenChange={(abierto) => !abierto && setRechazando(null)}
        onRechazada={() => router.refresh()}
      />
    </>
  );
}

function FilaLectura({
  lectura: l,
  onRechazar,
  onAprobada,
  onConfirmar,
  onEditar,
  onEliminar,
}: {
  lectura: LecturaFila;
  onRechazar: () => void;
  onAprobada: () => void;
  onConfirmar: (motivo: Motivo) => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const [aprobando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const estilo = ESTILO_ESTADO[l.estado];
  const Icono = estilo.icono;

  return (
    <TableRow>
      <TableCell className="px-4 py-3.5">
        <div className="font-medium">{l.socio}</div>
        <div className="text-[0.78rem] tabular-nums text-muted-foreground">
          {l.rut}
        </div>
      </TableCell>
      <TableCell className="px-4 py-3.5 whitespace-nowrap">
        {formatearPeriodo(l.periodo)}
      </TableCell>
      <TableCell className="px-4 py-3.5 tabular-nums">
        <div className="font-medium">{numero.format(l.valor)}</div>
        {l.estado === "PENDIENTE" && (
          <div
            className={cn(
              "text-[0.78rem]",
              l.anterior === null
                ? "text-tertiary-texto"
                : l.valor < l.anterior
                  ? "text-destructive"
                  : "text-muted-foreground"
            )}
          >
            {l.anterior === null
              ? "Primera lectura: sin anterior"
              : l.valor < l.anterior
                ? `Menor que la anterior (${numero.format(l.anterior)})`
                : `Anterior ${numero.format(l.anterior)} · +${numero.format(l.valor - l.anterior)} m³`}
          </div>
        )}
        {l.inicial && (
          <div className="text-[0.78rem] text-muted-foreground">
            Lectura inicial (sin boleta)
          </div>
        )}
        {l.observacion && l.observacion !== "Lectura inicial" && (
          <div
            title={l.observacion}
            className="max-w-48 truncate text-[0.78rem] text-muted-foreground"
          >
            &ldquo;{l.observacion}&rdquo;
          </div>
        )}
      </TableCell>
      <TableCell className="px-4 py-3.5">
        <div>{l.registradaPor ?? "—"}</div>
        <div className="text-[0.78rem] text-muted-foreground">
          {fechaHora.format(l.createdAt)}
        </div>
      </TableCell>
      <TableCell className="px-4 py-3.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.78rem] font-medium whitespace-nowrap",
            estilo.clase
          )}
        >
          <Icono className="size-3.5" />
          {estilo.texto}
        </span>
        {l.estado === "RECHAZADA" && l.motivoRechazo && (
          <div
            title={l.motivoRechazo}
            className="mt-1 max-w-52 truncate text-[0.78rem] text-muted-foreground"
          >
            {l.motivoRechazo}
          </div>
        )}
      </TableCell>
      <TableCell className="py-3.5 pr-5 text-right">
        {l.estado === "PENDIENTE" ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={aprobando}
              onClick={onRechazar}
            >
              <X />
              Rechazar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={aprobando}
              onClick={() => {
                // Sin lectura anterior (o con una menor) no se aprueba de golpe:
                // cobraría el medidor completo. Se pregunta qué hacer.
                if (l.anterior === null) return onConfirmar("primera");
                if (l.valor < l.anterior) return onConfirmar("menor");
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
              }}
            >
              {aprobando ? <Loader2 className="animate-spin" /> : <Check />}
              Aprobar
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {error && (
          <p className="mt-1 text-[0.78rem] text-destructive">{error}</p>
        )}
      </TableCell>
      <TableCell className="w-12 py-3.5 pr-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Acciones para la lectura de ${l.socio}`}
              >
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
            <DropdownMenuItem variant="destructive" onClick={onEliminar}>
              <Trash2 />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
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

  const totalM3 = listas.reduce((s, l) => s + (l.valor - (l.anterior ?? 0)), 0);

  function cambiar(v: boolean) {
    onAbiertoChange(v);
    if (!v) {
      setResultado(null);
      setError(null);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogContent className="sm:max-w-110">
        <DialogHeader>
          <DialogTitle>Aprobar y generar boletas</DialogTitle>
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
          <Button variant="outline" onClick={() => cambiar(false)} disabled={trabajando}>
            {resultado ? "Cerrar" : "Cancelar"}
          </Button>
          {!resultado && (
            <Button
              disabled={trabajando || listas.length === 0}
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
      <DialogContent className="sm:max-w-110">
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
              <DialogTitle>Editar lectura</DialogTitle>
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
              <Button type="button" variant="outline" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={trabajando}>
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
      <DialogContent className="sm:max-w-110">
        <DialogHeader>
          <DialogTitle>Eliminar lectura</DialogTitle>
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
          <Button variant="outline" onClick={cerrar} disabled={trabajando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={eliminar} disabled={trabajando}>
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
      <DialogContent className="sm:max-w-120">
        <DialogHeader>
          <DialogTitle>
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
          <Button variant="outline" onClick={onCerrar} disabled={trabajando}>
            Cancelar
          </Button>
          {primera && (
            <Button
              variant="outline"
              disabled={trabajando}
              onClick={() => l && correr(() => aprobarLectura(l.id, { cobrarDesdeCero: true }))}
            >
              Cobrar desde 0
            </Button>
          )}
          <Button
            disabled={trabajando}
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
  const [estado, accion, pendiente] = useActionState<
    ResultadoAccion | null,
    FormData
  >(async (prev, formData) => {
    const r = await registrarLectura(prev, formData);
    if (r.ok) {
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
      <DialogContent className="sm:max-w-130">
        <DialogHeader>
          <DialogTitle>Nueva lectura</DialogTitle>
          <DialogDescription>
            Queda por revisar hasta que la apruebes; recién ahí se genera la
            boleta.
          </DialogDescription>
        </DialogHeader>

        <form action={accion} className="flex min-w-0 flex-col gap-4">
          <SocioBuscador socios={socios} />

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
              <Label htmlFor="nl-valor">Lectura del medidor</Label>
              <Input
                id="nl-valor"
                name="valor"
                inputMode="numeric"
                placeholder="1250"
                required
              />
            </div>
          </div>

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
            <Button
              type="button"
              variant="outline"
              onClick={() => onAbiertoChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente}>
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
      <DialogContent className="sm:max-w-110">
        <DialogHeader>
          <DialogTitle>Rechazar lectura</DialogTitle>
          <DialogDescription>
            {lectura &&
              `${lectura.socio} · ${formatearPeriodo(lectura.periodo)} · lectura ${lectura.valor}`}
          </DialogDescription>
        </DialogHeader>

        <Textarea
          rows={3}
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: la lectura anterior era 1400, esta parece un error de tipeo."
        />

        {error && <p className="text-[0.85rem] text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={pendiente} onClick={enviar}>
            {pendiente && <Loader2 className="animate-spin" />}
            Rechazar lectura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
