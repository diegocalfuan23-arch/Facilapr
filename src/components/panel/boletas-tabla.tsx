"use client";

import { toast } from "sonner";
import {
  useActionState,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  FileText,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  anularBoleta,
  eliminarBoleta,
  guardarBoleta,
  importarBoletas,
  registrarPago,
  type ResultadoAccion,
  type ResultadoImportacion,
} from "@/app/panel/boletas/actions";
import { Button } from "@/components/ui/button";
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
  DropdownMenuSeparator,
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
import { formatearPeriodo, saldo } from "@/lib/boletas";
import { formatearRut, formatearTelefono } from "@/lib/formato";
import { SocioBuscador, type OpcionSocio } from "@/components/panel/socio-buscador";
import {
  enlaceWhatsApp,
  mensajeBoleta,
  PLANTILLA_POR_DEFECTO,
  telefonoValidoParaWhatsApp,
  VARIABLES_PLANTILLA,
  type DatosComiteWhatsApp,
} from "@/lib/whatsapp";

type Estado = "PENDIENTE" | "PAGADA" | "VENCIDA" | "ANULADA";

export type BoletaFila = {
  id: string;
  socioId: string;
  socioNombre: string;
  socioRut: string | null;
  socioTelefono: string | null;
  periodo: string;
  montoTotal: number;
  montoPagado: number;
  estado: Estado;
  fechaEmision: Date;
  fechaVencimiento: Date;
  lecturaAnterior: number | null;
  lecturaActual: number | null;
  consumoM3: number | null;
  observacion: string | null;
  /** Enlace firmado al recibo en PDF. */
  reciboUrl: string;
};

export type SocioOpcion = OpcionSocio;

const POR_PAGINA = 12;

/**
 * wa.me no avisa si el mensaje salió, así que "enviada" es lo que la directiva
 * tocó desde este navegador. Se guarda aquí (no en la base) para no exigir un
 * cambio de esquema; si hace falta compartirlo entre usuarios, pasa a columna.
 */
const CLAVE_ENVIADAS = "facilapr-boletas-wa-enviadas";

/** El mensaje editado se recuerda en este navegador, igual que las enviadas. */
const CLAVE_PLANTILLA = "facilapr-boletas-wa-plantilla";

function leerPlantilla(): string {
  if (typeof window === "undefined") return PLANTILLA_POR_DEFECTO;
  try {
    return localStorage.getItem(CLAVE_PLANTILLA) ?? PLANTILLA_POR_DEFECTO;
  } catch {
    return PLANTILLA_POR_DEFECTO;
  }
}

function leerEnviadas(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const crudo = localStorage.getItem(CLAVE_ENVIADAS);
    return new Set(crudo ? (JSON.parse(crudo) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Una boleta sin saldo por pagar no se cobra por WhatsApp. */
function cobrable(b: BoletaFila) {
  return (
    (b.estado === "PENDIENTE" || b.estado === "VENCIDA") &&
    saldo(b.montoTotal, b.montoPagado) > 0
  );
}

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const fecha = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const ESTILO_ESTADO: Record<
  Estado,
  { texto: string; clase: string; icono: typeof CheckCircle2 }
> = {
  PAGADA: {
    texto: "Pagada",
    clase: "bg-forest/10 text-forest",
    icono: CheckCircle2,
  },
  PENDIENTE: {
    texto: "Pendiente",
    clase: "bg-tertiary/15 text-tertiary",
    icono: Clock,
  },
  VENCIDA: {
    texto: "Vencida",
    clase: "bg-destructive/10 text-destructive",
    icono: AlertCircle,
  },
  ANULADA: {
    texto: "Anulada",
    clase: "bg-muted text-muted-foreground",
    icono: Ban,
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
  valor: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-4">
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-lg sm:size-9 [&_svg]:size-4 sm:[&_svg]:size-4.5",
          color
        )}
      >
        {icono}
      </span>
      <div className="mt-2 truncate text-[0.74rem] text-muted-foreground sm:mt-4 sm:text-[0.87rem]">
        {etiqueta}
      </div>
      <div className="mt-0.5 truncate text-[1.25rem] leading-none font-semibold tabular-nums sm:mt-1 sm:text-[1.6rem]">
        {valor}
      </div>
    </div>
  );
}

export function BoletasTabla({
  boletas,
  socios,
  tarifas,
  comite,
}: {
  boletas: BoletaFila[];
  socios: SocioOpcion[];
  tarifas: { cargoFijo: number; valorM3: number } | null;
  comite: DatosComiteWhatsApp;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [pestana, setPestana] = useState<"todas" | Estado>("todas");
  const [periodo, setPeriodo] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<BoletaFila | null>(null);
  const [cobrando, setCobrando] = useState<BoletaFila | null>(null);
  const [porEliminar, setPorEliminar] = useState<BoletaFila | null>(null);
  const [importando, setImportando] = useState(false);
  // Boletas que se están por enviar; null = modal cerrado. Una sola desde el
  // menú de la fila, o todas las por cobrar del filtro desde el botón de arriba.
  const [paraEnviar, setParaEnviar] = useState<BoletaFila[] | null>(null);
  const [plantilla, setPlantillaEstado] = useState<string>(leerPlantilla);
  const [enviadas, setEnviadas] = useState<Set<string>>(leerEnviadas);

  function cambiarPlantilla(texto: string) {
    setPlantillaEstado(texto);
    try {
      localStorage.setItem(CLAVE_PLANTILLA, texto);
    } catch {
      // Sin almacenamiento el cambio vale solo mientras la página siga abierta.
    }
  }
  const [pendiente, iniciar] = useTransition();

  function enviarPorWhatsApp(b: BoletaFila) {
    if (!b.socioTelefono) return;
    window.open(
      enlaceWhatsApp(b.socioTelefono, mensajeBoleta(comite, b, plantilla)),
      "_blank",
      "noopener"
    );
    setEnviadas((prev) => {
      const sig = new Set(prev).add(b.id);
      try {
        localStorage.setItem(CLAVE_ENVIADAS, JSON.stringify([...sig]));
      } catch {
        // Sin almacenamiento: el estado vive solo mientras la página siga abierta.
      }
      return sig;
    });
  }

  const periodos = useMemo(
    () => [...new Set(boletas.map((b) => b.periodo))].sort().reverse(),
    [boletas]
  );

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return boletas.filter((b) => {
      if (pestana !== "todas" && b.estado !== pestana) return false;
      if (periodo !== "todos" && b.periodo !== periodo) return false;
      if (!termino) return true;
      return [b.socioNombre, b.socioRut, b.periodo]
        .join(" ")
        .toLowerCase()
        .includes(termino);
    });
  }, [boletas, busqueda, pestana, periodo]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA
  );

  // Los totales se calculan sobre lo filtrado: si miras un período, el
  // resumen debe ser de ese período.
  const vigentes = filtradas.filter((b) => b.estado !== "ANULADA");
  const porCobrar = vigentes.reduce(
    (s, b) => s + saldo(b.montoTotal, b.montoPagado),
    0
  );
  const cobrado = vigentes.reduce((s, b) => s + b.montoPagado, 0);
  const vencidas = filtradas.filter((b) => b.estado === "VENCIDA").length;

  const pestanas: { id: "todas" | Estado; label: string }[] = [
    { id: "todas", label: "Todas" },
    { id: "PENDIENTE", label: "Pendientes" },
    { id: "VENCIDA", label: "Vencidas" },
    { id: "PAGADA", label: "Pagadas" },
  ];

  function cambiarFiltro(fn: () => void) {
    fn();
    setPagina(1);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[1.35rem] font-semibold tracking-tight">Boletas</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            data-tour="bol-imprimir"
            disabled={periodos.length === 0}
            title="Hoja de recibos para imprimir: el período filtrado, o el más reciente"
            onClick={() =>
              window.open(
                `/recibos/periodo/${periodo !== "todos" ? periodo : periodos[0]}`,
                "_blank",
                "noopener"
              )
            }
          >
            <Printer />
            Imprimir recibos
          </Button>
          <Button
            variant="outline"
            data-tour="bol-whatsapp"
            onClick={() => setParaEnviar(filtradas.filter(cobrable))}
            disabled={boletas.length === 0}
          >
            <MessageCircle />
            Enviar por WhatsApp
          </Button>
          <Button variant="outline" data-tour="bol-importar" onClick={() => setImportando(true)}>
            <Upload />
            Importar CSV
          </Button>
          <Button
            data-tour="bol-nueva"
            onClick={() => setCreando(true)}
            disabled={socios.length === 0}
          >
            <Plus />
            Nueva boleta
          </Button>
        </div>
      </div>

      {socios.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-tertiary/40 bg-tertiary/10 px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-tertiary" />
          <p className="text-[0.88rem] leading-relaxed">
            <strong>Primero carga a tus socios.</strong> Una boleta siempre
            pertenece a un socio del padrón.
          </p>
        </div>
      )}

      <div data-tour="bol-kpis" className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <TarjetaResumen
          icono={<ReceiptText />}
          color="bg-primary/10 text-primary"
          etiqueta="Boletas"
          valor={String(filtradas.length)}
        />
        <TarjetaResumen
          icono={<Coins />}
          color="bg-secondary/10 text-secondary"
          etiqueta="Por cobrar"
          valor={clp.format(porCobrar)}
        />
        <TarjetaResumen
          icono={<CheckCircle2 />}
          color="bg-forest/10 text-forest"
          etiqueta="Cobrado"
          valor={clp.format(cobrado)}
        />
        <TarjetaResumen
          icono={<AlertCircle />}
          color="bg-destructive/10 text-destructive"
          etiqueta="Vencidas"
          valor={String(vencidas)}
        />
      </div>

      {boletas.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-[1rem] font-semibold">
            Aún no has emitido boletas
          </h2>
          <p className="mt-2 max-w-[48ch] text-[0.92rem] leading-relaxed text-muted-foreground">
            Sube la planilla del período con el RUT del socio y el monto, o
            crea una boleta a mano. El bot usa estos datos para responder
            cuánto debe cada socio.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => setImportando(true)}>
              <Upload />
              Importar CSV
            </Button>
            <Button
              onClick={() => setCreando(true)}
              disabled={socios.length === 0}
            >
              <Plus />
              Nueva boleta
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div data-tour="bol-pestanas" className="flex gap-4 overflow-x-auto overflow-y-hidden border-b border-border/60 px-3 sm:gap-6 sm:px-5">
            {pestanas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => cambiarFiltro(() => setPestana(p.id))}
                className={cn(
                  "shrink-0 border-b-2 py-3.5 text-[0.82rem] font-medium transition-colors sm:text-[0.9rem]",
                  pestana === p.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 p-3 sm:p-5">
            <div className="relative w-full sm:min-w-60 sm:flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) =>
                  cambiarFiltro(() => setBusqueda(e.target.value))
                }
                placeholder="Buscar por socio, RUT o período…"
                aria-label="Buscar boletas"
                className="h-10 border-transparent bg-muted/60 pl-10"
              />
            </div>
            <select
              value={periodo}
              onChange={(e) => cambiarFiltro(() => setPeriodo(e.target.value))}
              aria-label="Filtrar por período"
              className="w-full sm:w-auto h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="todos">Todos los períodos</option>
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {formatearPeriodo(p)}
                </option>
              ))}
            </select>
          </div>

          {/* TableHeader y TableRow apilan sus bordes en la misma fila: un
              solo borde suave declarado aquí gana a ambos. */}
          <div data-tour="bol-tabla" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-border/50 hover:bg-transparent">
                  {[
                    "Socio",
                    "Período",
                    "Consumo",
                    "Monto",
                    "Pagado",
                    "Estado",
                    "Vence",
                  ].map((h) => (
                    <TableHead
                      key={h}
                      className="h-11 px-4 text-[0.87rem] font-medium text-muted-foreground"
                    >
                      {h}
                    </TableHead>
                  ))}
                  <TableHead className="h-11 w-12 pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={8}
                      className="py-12 text-center text-[0.92rem] text-muted-foreground"
                    >
                      Ninguna boleta coincide con el filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibles.map((b) => {
                    const estilo = ESTILO_ESTADO[b.estado];
                    const Icono = estilo.icono;
                    const pendienteDePago = saldo(b.montoTotal, b.montoPagado);

                    return (
                      <TableRow key={b.id}>
                        <TableCell className="px-4 py-3.5">
                          <div className="font-medium">{b.socioNombre}</div>
                          <div className="text-[0.78rem] tabular-nums text-muted-foreground">
                            {formatearRut(b.socioRut)}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 whitespace-nowrap">
                          {formatearPeriodo(b.periodo)}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 tabular-nums text-muted-foreground">
                          {b.consumoM3 !== null ? (
                            <>
                              <div>{b.consumoM3} m³</div>
                              {b.lecturaAnterior !== null && b.lecturaActual !== null && (
                                <div className="text-[0.76rem]">
                                  {b.lecturaAnterior} → {b.lecturaActual}
                                </div>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 font-medium tabular-nums">
                          {clp.format(b.montoTotal)}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 tabular-nums">
                          {b.montoPagado > 0 ? (
                            <>
                              <div>{clp.format(b.montoPagado)}</div>
                              {pendienteDePago > 0 && b.estado !== "ANULADA" && (
                                <div className="text-[0.78rem] text-destructive">
                                  faltan {clp.format(pendienteDePago)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
                        </TableCell>
                        <TableCell className="px-4 py-3.5 tabular-nums whitespace-nowrap text-muted-foreground">
                          {fecha.format(b.fechaVencimiento)}
                        </TableCell>
                        <TableCell className="w-12 py-3.5 pr-5">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Acciones para la boleta de ${b.socioNombre}`}
                                >
                                  <MoreHorizontal />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              {cobrable(b) &&
                                telefonoValidoParaWhatsApp(b.socioTelefono) && (
                                  <DropdownMenuItem
                                    onClick={() => setParaEnviar([b])}
                                  >
                                    <MessageCircle />
                                    {enviadas.has(b.id)
                                      ? "Reenviar por WhatsApp"
                                      : "Enviar por WhatsApp"}
                                  </DropdownMenuItem>
                                )}
                              <DropdownMenuItem
                                onClick={() =>
                                  window.open(`/recibos/${b.id}`, "_blank", "noopener")
                                }
                              >
                                <FileText />
                                Ver recibo
                              </DropdownMenuItem>
                              {b.estado !== "ANULADA" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    window.open(b.reciboUrl, "_blank", "noopener")
                                  }
                                >
                                  <FileDown />
                                  Descargar PDF
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => setCobrando(b)}>
                                <Coins />
                                Registrar pago
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditando(b)}>
                                <Pencil />
                                Editar
                              </DropdownMenuItem>
                              {b.estado !== "ANULADA" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    iniciar(async () => {
                                      await anularBoleta(b.id);
                                      toast.success("Boleta anulada");
                                    })
                                  }
                                >
                                  <Ban />
                                  Anular
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setPorEliminar(b)}
                              >
                                <Trash2 />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <p className="text-[0.87rem] text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">
                {filtradas.length}
              </span>{" "}
              {filtradas.length === 1 ? "boleta" : "boletas"}
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

      <BoletaDialog
        abierto={creando}
        onAbiertoChange={setCreando}
        socios={socios}
        tarifas={tarifas}
      />

      {editando && (
        <BoletaDialog
          abierto
          onAbiertoChange={(v) => !v && setEditando(null)}
          socios={socios}
          tarifas={tarifas}
          boleta={editando}
        />
      )}

      {cobrando && (
        <PagoDialog
          boleta={cobrando}
          onCerrar={() => setCobrando(null)}
        />
      )}

      <ImportarDialog abierto={importando} onAbiertoChange={setImportando} />

      <EnviarWhatsAppDialog
        abierto={paraEnviar !== null}
        onAbiertoChange={(v) => !v && setParaEnviar(null)}
        boletas={paraEnviar ?? []}
        enviadas={enviadas}
        onEnviar={enviarPorWhatsApp}
        comite={comite}
        plantilla={plantilla}
        onPlantilla={cambiarPlantilla}
      />

      <Dialog
        open={Boolean(porEliminar)}
        onOpenChange={(v) => !v && setPorEliminar(null)}
      >
        <DialogContent className="sm:max-w-100">
          <DialogHeader>
            <DialogTitle>Eliminar boleta</DialogTitle>
            <DialogDescription>
              Se borrará la boleta de {porEliminar?.socioNombre} del período{" "}
              {porEliminar && formatearPeriodo(porEliminar.periodo)}. Si solo
              quieres dejarla sin efecto conservando el registro, usa Anular.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPorEliminar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  if (porEliminar) {
                    await eliminarBoleta(porEliminar.id);
                    toast.success("Boleta eliminada");
                  }
                  setPorEliminar(null);
                })
              }
            >
              {pendiente ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BoletaDialog({
  abierto,
  onAbiertoChange,
  socios,
  tarifas,
  boleta,
}: {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
  socios: SocioOpcion[];
  tarifas: { cargoFijo: number; valorM3: number } | null;
  boleta?: BoletaFila;
}) {
  // Las lecturas se controlan para mostrar el consumo y el monto mientras se escribe.
  const [lecAnt, setLecAnt] = useState(String(boleta?.lecturaAnterior ?? ""));
  const [lecAct, setLecAct] = useState(String(boleta?.lecturaActual ?? ""));
  const soloDigitos = (v: string) => v.replace(/[^\d]/g, "");
  const consumo =
    lecAnt !== "" && lecAct !== "" ? Number(lecAct) - Number(lecAnt) : null;
  const [estado, accion, pendiente] = useActionState<
    ResultadoAccion | null,
    FormData
  >(async (prev, formData) => {
    const r = await guardarBoleta(prev, formData);
    if (r.ok) onAbiertoChange(false);
    return r;
  }, null);

  const paraInput = (d: Date) => new Date(d).toISOString().slice(0, 10);

  // El reloj se lee una vez al montar, no en cada render: leerlo durante el
  // render hace que los valores por defecto del formulario cambien solos.
  const [hoy] = useState(() => new Date());
  const en30 = new Date(hoy.getTime() + 30 * 86_400_000);

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {boleta ? "Editar boleta" : "Nueva boleta"}
          </DialogTitle>
          <DialogDescription>
            {tarifas
              ? "Escribe las lecturas del medidor y el monto se calcula solo, o ingrésalo directamente."
              : "Escribe las lecturas del medidor para registrar los m³ y el monto de la boleta."}
          </DialogDescription>
        </DialogHeader>

        <form action={accion} className="flex flex-col gap-4">
          {boleta && <input type="hidden" name="boletaId" value={boleta.id} />}

          <SocioBuscador
            socios={socios}
            defaultId={boleta?.socioId}
            // Al elegir un arranque en una boleta nueva, se sugiere su ultima lectura.
            onElegir={(s) => {
              if (!boleta) setLecAnt(s?.ultimaLectura != null ? String(s.ultimaLectura) : "");
            }}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="periodo">Período</Label>
              <Input
                id="periodo"
                name="periodo"
                defaultValue={boleta?.periodo}
                placeholder="2026-07"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fechaEmision">Emisión</Label>
              <Input
                id="fechaEmision"
                name="fechaEmision"
                type="date"
                defaultValue={paraInput(boleta?.fechaEmision ?? hoy)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fechaVencimiento">Vence</Label>
              <Input
                id="fechaVencimiento"
                name="fechaVencimiento"
                type="date"
                defaultValue={paraInput(boleta?.fechaVencimiento ?? en30)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lecturaAnterior">Lectura anterior</Label>
              <Input
                id="lecturaAnterior"
                name="lecturaAnterior"
                inputMode="numeric"
                value={lecAnt}
                onChange={(e) => setLecAnt(soloDigitos(e.target.value))}
                placeholder="1200"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lecturaActual">Lectura actual</Label>
              <Input
                id="lecturaActual"
                name="lecturaActual"
                inputMode="numeric"
                value={lecAct}
                onChange={(e) => setLecAct(soloDigitos(e.target.value))}
                placeholder="1215"
              />
            </div>
          </div>

          {consumo !== null &&
            (consumo < 0 ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-[0.85rem] text-destructive">
                La lectura actual es menor que la anterior. Revisa los valores.
              </p>
            ) : (
              <p className="rounded-lg border border-forest/30 bg-forest/5 px-3.5 py-2.5 text-[0.85rem] text-forest">
                Consumo: <strong className="tabular-nums">{consumo} m³</strong>
                {tarifas && (
                  <>
                    {" "}
                    · monto{" "}
                    <strong className="tabular-nums">
                      {clp.format(tarifas.cargoFijo + consumo * tarifas.valorM3)}
                    </strong>{" "}
                    (se calcula solo)
                  </>
                )}
              </p>
            ))}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="montoTotal">
              Monto {tarifas && "(si no usas lecturas)"}
            </Label>
            <Input
              id="montoTotal"
              name="montoTotal"
              inputMode="numeric"
              defaultValue={boleta?.montoTotal ?? ""}
              placeholder="9250"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="observacion">Observación</Label>
            <Textarea
              id="observacion"
              name="observacion"
              rows={2}
              maxLength={300}
              defaultValue={boleta?.observacion ?? ""}
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
              {boleta ? "Guardar cambios" : "Crear boleta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PagoDialog({
  boleta,
  onCerrar,
}: {
  boleta: BoletaFila;
  onCerrar: () => void;
}) {
  const [monto, setMonto] = useState(String(boleta.montoPagado || ""));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const pendienteDePago = saldo(boleta.montoTotal, boleta.montoPagado);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            {boleta.socioNombre} · {formatearPeriodo(boleta.periodo)} ·{" "}
            {clp.format(boleta.montoTotal)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="monto">Monto pagado en total</Label>
            <Input
              id="monto"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              autoFocus
            />
            <p className="text-[0.82rem] text-muted-foreground">
              {pendienteDePago > 0
                ? `Quedan ${clp.format(pendienteDePago)} por pagar.`
                : "Esta boleta está pagada."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonto(String(boleta.montoTotal))}
            >
              Pagó el total
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMonto("0")}>
              Sin pago
            </Button>
          </div>

          {error && <p className="text-[0.88rem] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={pendiente}
            onClick={() =>
              iniciar(async () => {
                const r = await registrarPago(boleta.id, Number(monto || 0));
                if (r.ok) {
                  toast.success("Pago registrado");
                  onCerrar();
                } else {
                  setError(r.error);
                  toast.error(r.error);
                }
              })
            }
          >
            {pendiente && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnviarWhatsAppDialog({
  abierto,
  onAbiertoChange,
  boletas,
  enviadas,
  onEnviar,
  comite,
  plantilla,
  onPlantilla,
}: {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
  boletas: BoletaFila[];
  enviadas: Set<string>;
  onEnviar: (b: BoletaFila) => void;
  comite: DatosComiteWhatsApp;
  plantilla: string;
  onPlantilla: (texto: string) => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const conTelefono = boletas.filter((b) =>
    telefonoValidoParaWhatsApp(b.socioTelefono)
  );
  const sinTelefono = boletas.length - conTelefono.length;
  const porEnviar = conTelefono.filter((b) => !enviadas.has(b.id)).length;
  const unica = boletas.length === 1 ? boletas[0] : null;
  const ejemplo = conTelefono[0] ?? boletas[0];

  function insertar(variable: string) {
    const area = areaRef.current;
    const token = `{${variable}}`;
    if (!area) {
      onPlantilla(plantilla + token);
      return;
    }
    const desde = area.selectionStart ?? plantilla.length;
    const hasta = area.selectionEnd ?? desde;
    onPlantilla(plantilla.slice(0, desde) + token + plantilla.slice(hasta));
    // El cursor queda justo después de lo insertado.
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(desde + token.length, desde + token.length);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-12">
          <DialogTitle>Enviar por WhatsApp</DialogTitle>
          <DialogDescription>
            {unica
              ? `Recibo de ${unica.socioNombre}. Se envía con un enlace al PDF.`
              : "Edita el mensaje una vez y se usa para todos. Cada socio recibe el suyo con su recibo en PDF."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid min-w-0 gap-5 md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="mensaje-wa">Mensaje</Label>
                {plantilla !== PLANTILLA_POR_DEFECTO && (
                  <button
                    type="button"
                    onClick={() => onPlantilla(PLANTILLA_POR_DEFECTO)}
                    className="text-[0.8rem] text-primary hover:underline"
                  >
                    Restablecer mensaje
                  </button>
                )}
              </div>
              <Textarea
                id="mensaje-wa"
                ref={areaRef}
                rows={12}
                value={plantilla}
                onChange={(e) => onPlantilla(e.target.value)}
                className="text-[0.85rem] leading-relaxed"
              />
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES_PLANTILLA.map((v) => (
                  <button
                    key={v.nombre}
                    type="button"
                    title={v.ayuda}
                    onClick={() => insertar(v.nombre)}
                    className="rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-[0.72rem] text-muted-foreground hover:bg-muted"
                  >
                    {`{${v.nombre}}`}
                  </button>
                ))}
              </div>
            </div>

            {ejemplo && (
              <div className="flex min-w-0 flex-col gap-2">
                <p className="text-[0.85rem] font-medium">
                  Así lo recibirá {ejemplo.socioNombre.split(" ")[0]}
                </p>
                <div className="rounded-xl bg-[#efeae2] p-3">
                  <div className="ml-auto max-w-full rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[0.84rem] leading-relaxed break-words whitespace-pre-wrap text-neutral-900 shadow-sm">
                    {mensajeBoleta(comite, ejemplo, plantilla)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {!unica && conTelefono.length > 0 && (
            <div className="mt-5 flex flex-col gap-2">
              <p className="text-[0.85rem] text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground">
                  {porEnviar}
                </span>{" "}
                por enviar · {conTelefono.length - porEnviar} ya enviadas
              </p>
              <div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
                {conTelefono.map((b) => {
                  const yaEnviada = enviadas.has(b.id);
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{b.socioNombre}</div>
                        <div className="text-[0.78rem] tabular-nums text-muted-foreground">
                          {b.socioTelefono && formatearTelefono(b.socioTelefono)} ·{" "}
                          {formatearPeriodo(b.periodo)} ·{" "}
                          {clp.format(saldo(b.montoTotal, b.montoPagado))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={yaEnviada ? "outline" : "default"}
                        onClick={() => onEnviar(b)}
                      >
                        {yaEnviada ? <Check /> : <MessageCircle />}
                        {yaEnviada ? "Reenviar" : "Enviar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {boletas.length > 0 && conTelefono.length === 0 && (
            <p className="mt-5 rounded-lg border border-dashed border-border px-4 py-6 text-center text-[0.9rem] text-muted-foreground">
              {unica
                ? "Este socio no tiene un teléfono válido. Agrégalo en Socios para poder enviarle el recibo."
                : "No hay boletas por cobrar con teléfono en este filtro."}
            </p>
          )}

          {!unica && sinTelefono > 0 && conTelefono.length > 0 && (
            <p className="mt-3 text-[0.82rem] text-destructive">
              {sinTelefono}{" "}
              {sinTelefono === 1 ? "socio no tiene" : "socios no tienen"} un
              teléfono válido y no aparece{sinTelefono === 1 ? "" : "n"} en la
              lista.
            </p>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-xl border-t border-border/60 px-5 py-3">
          <Button variant="outline" onClick={() => onAbiertoChange(false)}>
            Cerrar
          </Button>
          {unica && conTelefono.length === 1 && (
            <Button onClick={() => onEnviar(unica)}>
              <MessageCircle />
              Enviar por WhatsApp
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportarDialog({
  abierto,
  onAbiertoChange,
}: {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}) {
  const [estado, accion, pendiente] = useActionState<
    ResultadoImportacion | null,
    FormData
  >(importarBoletas, null);

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Importar boletas</DialogTitle>
          <DialogDescription>
            Sube la planilla del período en CSV o Excel (.xlsx).
          </DialogDescription>
        </DialogHeader>

        <form action={accion} className="flex flex-col gap-4">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-[0.85rem]">
            <p className="font-medium">Columnas del archivo</p>
            <p className="mt-1.5 text-muted-foreground">
              Obligatorias: <code className="font-mono">rut</code>,{" "}
              <code className="font-mono">periodo</code>
            </p>
            <p className="mt-1 text-muted-foreground">
              Opcionales: <code className="font-mono">monto</code>,{" "}
              <code className="font-mono">vencimiento</code>,{" "}
              <code className="font-mono">emision</code>,{" "}
              <code className="font-mono">lecturaAnterior</code>,{" "}
              <code className="font-mono">lecturaActual</code>
            </p>
            <p className="mt-2.5 text-muted-foreground">
              Si vienen las dos lecturas, el monto se calcula con tus tarifas.
              Reimportar el mismo período actualiza las boletas en vez de
              duplicarlas, y no borra los pagos ya registrados.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="archivo">Archivo (CSV o Excel)</Label>
            <Input
              id="archivo"
              name="archivo"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
            />
          </div>

          {estado && !estado.ok && (
            <p className="text-[0.88rem] text-destructive">{estado.error}</p>
          )}

          {estado?.ok && (
            <div className="rounded-lg border border-forest/30 bg-forest/5 p-4 text-[0.88rem]">
              <p className="font-medium text-forest">
                {estado.creadas} creadas · {estado.actualizadas} actualizadas
              </p>
              {estado.omitidas.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-muted-foreground">
                    {estado.omitidas.length} filas omitidas
                  </summary>
                  <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto text-[0.82rem] text-muted-foreground">
                    {estado.omitidas.map((o) => (
                      <li key={o.linea}>
                        Línea {o.linea}: {o.motivo}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onAbiertoChange(false)}
            >
              {estado?.ok ? "Cerrar" : "Cancelar"}
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente && <Loader2 className="animate-spin" />}
              Importar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
