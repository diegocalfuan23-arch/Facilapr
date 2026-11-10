"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Landmark,
  Loader2,
  Lock,
  MoreHorizontal,
  PiggyBank,
  Plus,
  RefreshCw,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { cerrarCaja, consultarCaja, eliminarMovimiento, type ResultadoFinanzas } from "@/app/panel/finanzas/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoriasCajaDialog } from "@/components/panel/categorias-caja-dialog";
import { CerrarCajaDialog } from "@/components/panel/cerrar-caja-dialog";
import { NuevoMovimientoDialog } from "@/components/panel/nuevo-movimiento-dialog";
import { SaldoInicialDialog } from "@/components/panel/saldo-inicial-dialog";
import {
  diaVecino,
  hoyEnChile,
  mesVecino,
  nombreMes,
  textoCategoria,
  textoMedioLinea,
  type CategoriaMovimientoPropia,
  type DatosCaja,
  type LineaLibro,
  type PuntoTendencia,
  type ResumenPeriodo,
  type TipoMovimiento,
} from "@/lib/finanzas-comun";
import { cn } from "@/lib/utils";
import { useConfirmar } from "@/components/ui/confirmar";
import { INTERVALO_RAPIDO, avisarCambio } from "@/lib/avisos-datos";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Formato único para montos: −$500.000 */
const clp = (n: number) => (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("es-CL");
const conSigno = (n: number) => (n > 0 ? "+" : "") + clp(n);
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const diaCorto = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES_CORTOS[m - 1]}`;
};

/** Planilla con punto y coma, la que abre bien el Excel en español. */
function descargarCsv(lineas: LineaLibro[], nombre: string, propias: CategoriaMovimientoPropia[]) {
  const celda = (t: string | number | null) => `"${String(t ?? "").replace(/"/g, '""')}"`;
  const filas = [
    ["fecha", "tipo", "categoria", "concepto", "contraparte", "medio", "referencia", "ingreso", "egreso"],
    ...[...lineas]
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
      .map((l) => [
        l.fecha,
        l.tipo === "INGRESO" ? "Ingreso" : "Egreso",
        textoCategoria(l.categoria, propias),
        l.concepto,
        l.contraparte,
        textoMedioLinea(l.medio),
        l.referencia,
        l.tipo === "INGRESO" ? l.monto : "",
        l.tipo === "EGRESO" ? l.monto : "",
      ]),
  ];
  const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `caja-${nombre}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Un egreso que nació en otro módulo (Compras, Personal, Incidentes): se maneja desde ahí, no se borra desde la Caja. */
function moduloDe(l: { automatico: boolean; categoria: string; concepto: string }): string | null {
  if (l.automatico) return null;
  if (l.categoria === "COMPRAS" && /^Compra C-\d+/.test(l.concepto)) return "Compra";
  if (l.categoria === "REMUNERACIONES" && l.concepto.startsWith("Remuneración · ")) return "Remuneración";
  if (l.categoria === "REPARACIONES" && l.concepto.startsWith("Incidente I-")) return "Incidente";
  if (l.categoria === "ACTIVOS" && l.concepto.startsWith("Activo fijo · ")) return "Activo fijo";
  if (l.categoria === "REMUNERACIONES" && /^(Anticipo|Préstamo) · /.test(l.concepto)) return "Préstamo";
  return null;
}
const deCompra = (l: { automatico: boolean; categoria: string; concepto: string }) => moduloDe(l) !== null;
const origenDe = (l: LineaLibro) => (l.automatico ? "Pago de socio" : (moduloDe(l) ?? "Manual"));

/** El disponible de los últimos días, como una línea con área. */
function Tendencia({ puntos, esDia }: { puntos: PuntoTendencia[]; esDia: boolean }) {
  const W = 300;
  const H = 92;
  const P = 6;
  const vs = puntos.map((x) => x.disponible);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const pts = puntos.map((x, i) => [P + (i * (W - 2 * P)) / (puntos.length - 1), P + (1 - (x.disponible - min) / (max - min || 1)) * (H - 2 * P)] as const);
  const linea = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ux, uy] = pts[pts.length - 1];
  return (
    <figure className="hidden w-[300px] shrink-0 sm:block">
      <figcaption className={cn("mb-1 flex justify-between text-xs", GRIS)}>
        <span>{esDia ? `Últimos ${puntos.length} días` : "Día a día"}</span>
        <span className="tabular-nums">máx. {clp(max)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[92px] w-full overflow-visible" role="img" aria-label={`Disponible diario: ${puntos.map((x) => `${diaCorto(x.dia)} ${clp(x.disponible)}`).join(", ")}`}>
        <defs>
          <linearGradient id="g-disp" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3A0CE3" stopOpacity="0.16" />
            <stop offset="1" stopColor="#3A0CE3" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${linea} L${ux},${H} L${P},${H} Z`} fill="url(#g-disp)" />
        <path d={linea} fill="none" stroke="#3A0CE3" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={ux} cy={uy} r="4.5" fill="#fff" stroke="#3A0CE3" strokeWidth="2" />
      </svg>
      <div className={cn("mt-1 flex justify-between text-[11px]", GRIS)}>
        {puntos.map((x, i) => (
          <span key={x.dia} className={cn(puntos.length > 10 && i !== 0 && i !== puntos.length - 1 && i !== Math.floor((puntos.length - 1) / 2) && "invisible")}>
            {Number(x.dia.slice(8))}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Efectivo o banco: cuánto hay, cuánto cambió y, si quedó en negativo, qué hacer. */
function TarjetaLugar({ lugar, saldo, antes, onAjustarSaldo }: { lugar: "efectivo" | "banco"; saldo: number; antes: number | null; onAjustarSaldo: () => void }) {
  const efectivo = lugar === "efectivo";
  const cambio = antes === null ? 0 : saldo - antes;
  const negativo = saldo < 0;
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", efectivo ? "bg-[#FFF3E0] text-[#B86400]" : "bg-[#E2F2FC] text-[#0A5F91]")}>
          {efectivo ? <Banknote className="size-[18px]" /> : <Landmark className="size-[18px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[13px]", GRIS)}>{efectivo ? "En efectivo" : "En el banco"}</p>
          <p className={cn("text-[22px] leading-tight font-semibold tracking-tight tabular-nums", negativo && "text-[#A32020]")}>{clp(saldo)}</p>
        </div>
        {antes !== null && (
          <div className="text-right text-xs">
            <p className={cn("font-semibold tabular-nums", cambio < 0 ? "text-[#A32020]" : cambio > 0 ? "text-[#075A3C]" : GRIS)}>{cambio === 0 ? "Sin cambios" : `${conSigno(cambio)} hoy`}</p>
            <p className={cn("mt-0.5 tabular-nums", GRIS)}>Antes {clp(antes)}</p>
          </div>
        )}
      </div>
      {negativo && (
        <div role="alert" className="mt-3 rounded-xl border border-[#F6D9B8] bg-[#FFF8EF] p-3">
          <p className="flex items-start gap-2 text-[13px] leading-snug text-[#7A3B00]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-semibold">{efectivo ? "El efectivo" : "El banco"} quedó en negativo.</strong> Se pagó más de lo que había
              {efectivo ? " en caja. Si sacaste plata del banco, anota el giro." : " en la cuenta. Si depositaste efectivo, anota el depósito."}
            </span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2 pl-6">
            <Link href="/panel/giros" className={cn(buttonVariants({ size: "sm" }), "h-8 rounded-lg bg-[#15132B] px-3 text-xs font-semibold hover:bg-[#15132B]/90")}>
              <ArrowLeftRight className="size-3.5" />
              {efectivo ? "Registrar giro" : "Registrar depósito"}
            </Link>
            <Button size="sm" variant="ghost" onClick={onAjustarSaldo} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-[#7A3B00] hover:bg-[#FCEBD5]">
              Ajustar saldo inicial
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TipoPill({ tipo }: { tipo: TipoMovimiento }) {
  return tipo === "INGRESO" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F6EF] px-2 py-0.5 text-xs font-semibold text-[#075A3C]">
      <ArrowDownLeft className="size-3.5" aria-hidden />
      Ingreso
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FDEFEF] px-2 py-0.5 text-xs font-semibold text-[#A32020]">
      <ArrowUpRight className="size-3.5" aria-hidden />
      Egreso
    </span>
  );
}

/** Cuántos segundos pasaron desde un instante. */
const segundosDesde = (t: number) => Math.max(0, Math.round((Date.now() - t) / 1000));

/** «Actualizado hace 12 s» y un botón para actualizar a mano: así se ve que la Caja se mantiene al día sola. */
function Actualizado({ actualizadoEn, cargando, onActualizar }: { actualizadoEn: number; cargando: boolean; onActualizar: () => void }) {
  // Solo para que el texto se vuelva a calcular cada pocos segundos.
  const [, marcar] = useState(0);
  useEffect(() => {
    const t = setInterval(() => marcar((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const s = segundosDesde(actualizadoEn);
  const texto = s < 5 ? "ahora" : s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`;
  return (
    <span className="flex items-center gap-1.5 text-xs text-[#5B5970]">
      Actualizado {texto}
      <button type="button" onClick={onActualizar} aria-label="Actualizar la Caja" title="Actualizar ahora" className="flex size-7 items-center justify-center rounded-md hover:bg-[#F4F3F9] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <RefreshCw className={cn("size-3.5", cargando && "animate-spin")} aria-hidden />
      </button>
    </span>
  );
}

/** Contar el efectivo de la caja y cerrar el día: queda anotado lo que se contó y la diferencia con el sistema. */
function Arqueo({ resumen, onVerCierre, onDefinirSaldo }: { resumen: ResumenPeriodo; onVerCierre: () => void; onDefinirSaldo: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [contado, setContado] = useState("");
  const [estado, enviar, pendiente] = useActionState<ResultadoFinanzas | null, FormData>(cerrarCaja, null);
  const cierre = resumen.cierre;
  const sistema = resumen.bolsillos?.efectivo ?? null;
  const valor = Number(contado.replace(/\D/g, "")) || 0;
  const diferencia = sistema === null ? 0 : valor - sistema;

  const cliente = useQueryClient();
  useEffect(() => {
    if (estado?.ok) {
      toast.success("Caja cerrada");
      void cliente.invalidateQueries({ queryKey: ["caja"] });
    }
  }, [estado, cliente]);

  return (
    <div className={cn("flex flex-col rounded-2xl bg-card p-5", SOMBRA)}>
      <button type="button" aria-expanded={abierto} aria-controls="arqueo" onClick={() => setAbierto((v) => !v)} className="flex items-center justify-between gap-3 text-left lg:pointer-events-none">
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-xl bg-[#ECE8FD] text-[#3A0CE3] lg:hidden">
            <Lock className="size-4" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold">Arqueo y cierre</span>
            <span className={cn("block text-xs lg:hidden", GRIS)}>{cierre ? "Caja cerrada" : "Cuenta el efectivo antes de cerrar"}</span>
          </span>
        </span>
        <ChevronRight aria-hidden className={cn("size-5 text-[#8A8799] transition-transform lg:hidden", abierto && "rotate-90")} />
        <span className={cn("hidden text-xs lg:block", GRIS)}>{cierre ? "Cerrada" : "Antes de cerrar"}</span>
      </button>

      <div id="arqueo" className={cn("flex-1 flex-col lg:flex", abierto ? "flex" : "hidden")}>
        {cierre ? (
          <>
            <p className={cn("mt-1 text-[13px] leading-snug", GRIS)}>Cerrada{cierre.cerradoPor ? ` por ${cierre.cerradoPor}` : ""} con {clp(cierre.disponible)} disponibles.</p>
            <dl className="mt-4 mb-4 flex flex-col gap-2.5 text-sm">
              {cierre.efectivoContado !== null && cierre.diferenciaArqueo !== null ? (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className={GRIS}>Contaste</dt>
                    <dd className="font-semibold tabular-nums">{clp(cierre.efectivoContado)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-dashed border-[#E4E1F0] pt-2.5">
                    <dt className="font-medium">Diferencia</dt>
                    <dd className={cn("font-semibold tabular-nums", cierre.diferenciaArqueo === 0 ? "text-[#075A3C]" : "text-[#A32020]")}>{cierre.diferenciaArqueo === 0 ? "Cuadra" : conSigno(cierre.diferenciaArqueo)}</dd>
                  </div>
                </>
              ) : (
                <p className={GRIS}>Se cerró sin contar el efectivo.</p>
              )}
            </dl>
            <Button variant="outline" onClick={onVerCierre} className="mt-auto h-10 w-full rounded-lg border-[#E4E1F0] font-semibold">
              <Lock />
              Ver cierre o reabrir
            </Button>
          </>
        ) : sistema === null ? (
          <>
            <p className={cn("mt-1 text-[13px] leading-snug", GRIS)}>Para cerrar la caja primero hay que definir con cuánta plata partes (el saldo inicial).</p>
            <Button variant="outline" onClick={onDefinirSaldo} className="mt-4 h-10 w-full rounded-lg border-[#E4E1F0] font-semibold">
              <PiggyBank />
              Definir saldo inicial
            </Button>
          </>
        ) : (
          <form action={enviar} className="flex flex-1 flex-col">
            <input type="hidden" name="dia" value={resumen.desde} />
            <input type="hidden" name="efectivoContado" value={valor ? String(valor) : ""} />
            <p className={cn("mt-1 text-[13px] leading-snug", GRIS)}>Cuenta los billetes y monedas que hay en la caja y anótalo aquí.</p>
            <dl className="mt-4 mb-4 flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className={GRIS}>Según el sistema</dt>
                <dd className={cn("font-semibold tabular-nums", sistema < 0 && "text-[#A32020]")}>{clp(sistema)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>
                  <label htmlFor="contado" className={GRIS}>
                    Contaste
                  </label>
                </dt>
                <dd className="relative w-[140px]">
                  <span className={cn("absolute top-1/2 left-2.5 -translate-y-1/2 text-sm", GRIS)}>$</span>
                  <Input
                    id="contado"
                    inputMode="numeric"
                    value={contado}
                    onChange={(e) => {
                      const n = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setContado(n ? Number(n).toLocaleString("es-CL") : "");
                    }}
                    placeholder="0"
                    className="h-9 rounded-lg border-[#E4E1F0] pl-6 text-right tabular-nums shadow-none"
                  />
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-dashed border-[#E4E1F0] pt-2.5">
                <dt className="font-medium">Diferencia</dt>
                <dd className={cn("font-semibold tabular-nums", !contado ? GRIS : diferencia === 0 ? "text-[#075A3C]" : "text-[#A32020]")}>{!contado ? "—" : diferencia === 0 ? "Cuadra" : conSigno(diferencia)}</dd>
              </div>
            </dl>
            {estado && !estado.ok && (
              <p className="mb-2 text-[13px] text-destructive" role="alert">
                {estado.error}
              </p>
            )}
            <Button type="submit" disabled={!contado || pendiente} className="mt-auto h-10 w-full rounded-lg font-semibold">
              {pendiente ? <Loader2 className="animate-spin" /> : <Lock />}
              Cerrar caja del día
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

type Props = {
  /** El período con el que abre la pantalla. Después se cambia aquí mismo, sin recargar la página. */
  modo: "dia" | "mes";
  /** El primer día del período (AAAA-MM-DD). */
  desde: string;
  /** Lo que muestra la Caja de este período: parte con lo que trajo el servidor y se actualiza sola. */
  datos: DatosCaja;
};

type Periodo = { modo: "dia" | "mes"; desde: string };

/** La dirección que corresponde a un período, para que recargar o compartir la página caiga en el mismo lugar. */
const urlDe = (p: Periodo) => (p.modo === "dia" ? `/panel/caja?vista=dia&dia=${p.desde}` : `/panel/caja?vista=mes&mes=${p.desde.slice(0, 7)}`);

/**
 * La Caja del comité: navegador de día o mes, el disponible con su tendencia, dónde está la plata
 * (efectivo y banco), registro rápido, los movimientos y el arqueo para cerrar el día. Los pagos de
 * socios entran solos; el resto se anota a mano.
 */
export function CajaVista({ modo: modoInicial, desde: desdeInicial, datos }: Props) {
  const { confirmar, dialogo } = useConfirmar();
  const cliente = useQueryClient();
  // El día o mes que se ve vive aquí: cambiarlo no vuelve a cargar la página, solo pide los datos de ese período
  // (y mientras llegan se sigue viendo lo anterior). La dirección se actualiza para que recargar caiga en el mismo lugar.
  const [periodo, setPeriodo] = useState<Periodo>({ modo: modoInicial, desde: desdeInicial });
  const { modo, desde } = periodo;
  const mesDe = desde.slice(0, 7);
  const etiqueta = modo === "dia" ? desde : nombreMes(mesDe);
  const hrefInforme = modo === "mes" ? `/informes/caja/${mesDe}` : null;
  function irA(p: Periodo) {
    setPeriodo(p);
    window.history.replaceState(null, "", urlDe(p));
  }
  const vecino = (delta: number) => irA(modo === "dia" ? { modo, desde: diaVecino(desde, delta) } : { modo, desde: `${mesVecino(mesDe, delta)}-01` });
  const otraVista = () => {
    const hoy = hoyEnChile();
    irA(modo === "dia" ? { modo: "mes", desde: `${mesDe}-01` } : { modo: "dia", desde: mesDe === hoy.slice(0, 7) ? hoy : `${mesDe}-01` });
  };

  // Se vuelve a pedir cada 10 segundos y al volver a la pestaña: los pagos, compras y sueldos que se registran en otras
  // pantallas, o por otra persona, aparecen solos.
  const {
    data: consulta,
    dataUpdatedAt,
    isFetching,
    isPlaceholderData,
  } = useQuery({
    queryKey: ["caja", modo, desde],
    queryFn: () => consultarCaja(modo, desde),
    // Lo que trajo el servidor vale solo para el período con el que se abrió la pantalla.
    initialData: modo === modoInicial && desde === desdeInicial ? datos : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: INTERVALO_RAPIDO,
  });
  const data = consulta ?? datos;
  const { resumen, lineas, porCategoria, categoriasPropias, saldoInicial, tendencia } = data;
  /** Después de cualquier cambio hecho aquí, la Caja se vuelve a pedir enseguida. */
  const volverAPedir = useCallback(() => {
    void cliente.invalidateQueries({ queryKey: ["caja"] });
    avisarCambio("caja");
  }, [cliente]);
  const [borrando, iniciar] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroOrigen, setFiltroOrigen] = useState("todos");
  const [registrando, setRegistrando] = useState<TipoMovimiento | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [definiendoSaldo, setDefiniendoSaldo] = useState(false);
  const [gestionandoCategorias, setGestionandoCategorias] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cerrarCategorias = useCallback(() => {
    setGestionandoCategorias(false);
    volverAPedir();
  }, [volverAPedir]);
  const cerrarRegistro = useCallback(() => {
    setRegistrando(null);
    volverAPedir();
  }, [volverAPedir]);
  const cerrarCierre = useCallback(() => {
    setCerrando(false);
    volverAPedir();
  }, [volverAPedir]);
  const cerrarSaldo = useCallback(() => {
    setDefiniendoSaldo(false);
    volverAPedir();
  }, [volverAPedir]);

  useEffect(() => {
    if (!menu) return;
    const cerrar = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", cerrar);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", cerrar);
    };
  }, [menu]);

  async function borrar(l: LineaLibro) {
    if (!(await confirmar({ titulo: `¿Borrar «${l.concepto}»?`, descripcion: "No se puede deshacer.", boton: "Borrar" }))) return;
    iniciar(async () => {
      const r = await eliminarMovimiento(l.id.replace("mov:", ""));
      if (r.ok) toast.success("Movimiento borrado");
      else toast.error(r.error);
      volverAPedir();
    });
  }

  const q = busqueda.trim().toLowerCase();
  const filtradas = lineas.filter((l) => {
    if (filtroTipo !== "todos" && l.tipo !== filtroTipo) return false;
    if (filtroOrigen === "pago" && !l.automatico) return false;
    if (filtroOrigen === "manual" && (l.automatico || deCompra(l))) return false;
    if (filtroOrigen === "compra" && moduloDe(l) !== "Compra") return false;
    if (q && !l.concepto.toLowerCase().includes(q) && !l.referencia?.toLowerCase().includes(q) && !l.contraparte?.toLowerCase().includes(q)) return false;
    return true;
  });

  const esDia = modo === "dia";
  const cerrada = resumen.cierre !== null && !isPlaceholderData;
  const bloqueada = esDia && cerrada;
  const ingresosCat = porCategoria.filter((c) => c.tipo === "INGRESO");
  const egresosCat = porCategoria.filter((c) => c.tipo === "EGRESO");
  const puedeBorrar = (l: LineaLibro) => !l.automatico && !deCompra(l);
  const firmado = (l: LineaLibro) => (l.tipo === "INGRESO" ? l.monto : -l.monto);
  const neto = filtradas.reduce((t, l) => t + firmado(l), 0);
  const textoSaldo = saldoInicial ? clp(saldoInicial.monto) : null;
  const anterior = resumen.disponibleAnterior;
  const disponible = resumen.disponible;
  const cambioPeriodo = disponible !== null && anterior !== null ? disponible - anterior : null;

  const opcionesTipo = [
    { valor: "todos", texto: "Tipo: todos" },
    { valor: "INGRESO", texto: "Ingresos" },
    { valor: "EGRESO", texto: "Egresos" },
  ];
  const opcionesOrigen = [
    { valor: "todos", texto: "Origen: todos" },
    { valor: "pago", texto: "Pago de socio" },
    { valor: "manual", texto: "Manual" },
    { valor: "compra", texto: "Compras" },
  ];

  const botonBorrar = (l: LineaLibro) =>
    puedeBorrar(l) && (
      <Button variant="ghost" size="icon" aria-label={`Borrar ${l.concepto}`} disabled={borrando || bloqueada} onClick={() => borrar(l)} className="size-9 rounded-lg text-muted-foreground">
        <Trash2 />
      </Button>
    );

  const itemsMenu: { icono: typeof PiggyBank; texto: string; detalle?: string; solo?: "movil"; onClick?: () => void; href?: string; ocultar?: boolean }[] = [
    { icono: PiggyBank, texto: textoSaldo ? "Saldo inicial" : "Definir saldo inicial", detalle: textoSaldo ?? undefined, onClick: () => setDefiniendoSaldo(true) },
    ...(resumen.bolsillos ? [{ icono: ArrowLeftRight, texto: "Giros", solo: "movil" as const, href: "/panel/giros" }] : []),
    ...(esDia ? [{ icono: Lock, texto: cerrada ? "Caja cerrada" : "Cerrar caja", solo: "movil" as const, onClick: () => setCerrando(true) }] : []),
    { icono: Tags, texto: "Categorías", onClick: () => setGestionandoCategorias(true) },
    ...(hrefInforme ? [{ icono: FileText, texto: "Informe del mes", href: hrefInforme }] : []),
    { icono: Download, texto: "Exportar a Excel", onClick: () => descargarCsv(lineas, desde, categoriasPropias) },
  ];

  const botonRapido = (t: { titulo: string; detalle: string; icono: typeof ArrowDownLeft; color: string; tipo?: TipoMovimiento; href?: string }) => {
    const contenido = (
      <>
        <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10", t.color)}>
          <t.icono className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold sm:text-sm">{t.titulo}</span>
          <span className={cn("hidden truncate text-xs sm:block", GRIS)}>{t.detalle}</span>
        </span>
      </>
    );
    const clase = cn("flex flex-col items-center gap-1.5 rounded-2xl bg-card px-1 py-2.5 text-center transition-colors hover:bg-[#FBFAFF] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-row sm:gap-3 sm:p-3 sm:text-left", SOMBRA);
    return t.href ? (
      <Link key={t.titulo} href={t.href} className={clase}>
        {contenido}
      </Link>
    ) : (
      <button key={t.titulo} type="button" disabled={bloqueada} title={bloqueada ? "La caja de este día está cerrada. Reábrela para anotar movimientos." : undefined} onClick={() => setRegistrando(t.tipo ?? "EGRESO")} className={cn(clase, "disabled:opacity-50")}>
        {contenido}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-white/90 p-1 shadow-[0_2px_8px_rgba(58,12,227,0.05)]">
            <button type="button" onClick={() => vecino(-1)} aria-label={esDia ? "Día anterior" : "Mes anterior"} className="flex size-9 items-center justify-center rounded-lg hover:bg-[#F5F4FA]">
              <ChevronLeft className="size-4" />
            </button>
            {esDia ? (
              <Input
                type="date"
                value={desde}
                onChange={(e) => e.target.value && irA({ modo: "dia", desde: e.target.value })}
                className="h-9 w-[150px] border-0 bg-transparent px-2 text-sm font-semibold shadow-none focus-visible:ring-0"
                aria-label="Día"
              />
            ) : (
              <span className="flex h-9 min-w-36 items-center justify-center px-2.5 text-sm font-semibold capitalize">{etiqueta}</span>
            )}
            <button type="button" onClick={() => vecino(1)} aria-label={esDia ? "Día siguiente" : "Mes siguiente"} className="flex size-9 items-center justify-center rounded-lg hover:bg-[#F5F4FA]">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div role="group" aria-label="Ver por" className="flex rounded-xl bg-white/90 p-1 shadow-[0_2px_8px_rgba(58,12,227,0.05)]">
            {(
              [
                ["dia", "Día"],
                ["mes", "Mes"],
              ] as const
            ).map(([v, t]) =>
              v === modo ? (
                <span key={v} aria-current="true" className="flex h-9 items-center rounded-lg bg-[#ECE8FD] px-3 text-sm font-semibold text-[#2A07A8] sm:px-4">
                  {t}
                </span>
              ) : (
                <button key={v} type="button" onClick={otraVista} className={cn("flex h-9 items-center rounded-lg px-3 text-sm font-semibold hover:bg-[#F5F4FA] sm:px-4", GRIS)}>
                  {t}
                </button>
              )
            )}
          </div>
          {esDia && (
            <span className={cn("ml-1 hidden items-center gap-1.5 text-[13px] md:flex", GRIS)}>
              <span className={cn("size-2 rounded-full", cerrada ? "bg-[#A19FB2]" : "bg-[#0A9B68]")} aria-hidden />
              {cerrada ? "Caja cerrada" : "Caja abierta"}
            </span>
          )}
        </div>

        <div className="flex w-full gap-2 lg:w-auto">
          {resumen.bolsillos && (
            <Link href="/panel/giros" className={cn(buttonVariants({ variant: "outline" }), "hidden h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold sm:inline-flex")} title="Sacar plata del banco o depositar efectivo">
              <ArrowLeftRight />
              Giros
            </Link>
          )}
          {esDia && (
            <Button variant="outline" onClick={() => setCerrando(true)} className="hidden h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold sm:inline-flex">
              <Lock />
              {cerrada ? "Caja cerrada" : "Cerrar caja"}
            </Button>
          )}
          <div ref={menuRef} className="relative">
            <Button variant="outline" size="icon" aria-label="Más opciones" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="size-10 rounded-lg border-[#E4E1F0] bg-white">
              <MoreHorizontal />
            </Button>
            {menu && (
              <div role="menu" className="absolute top-12 left-0 z-30 w-[250px] rounded-xl border border-[#ECEAF4] bg-white p-1.5 shadow-[0_12px_32px_rgba(21,19,43,0.14)] sm:right-0 sm:left-auto">
                {itemsMenu.map((o) => {
                  const clase = cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium hover:bg-[#F5F4FA] focus-visible:bg-[#F5F4FA] focus-visible:outline-none", o.solo === "movil" && "sm:hidden");
                  const interior = (
                    <>
                      <o.icono className="size-4 text-[#6F6C82]" aria-hidden />
                      <span className="flex-1">{o.texto}</span>
                      {o.detalle && <span className={cn("text-xs tabular-nums", GRIS)}>{o.detalle}</span>}
                    </>
                  );
                  return o.href ? (
                    <Link key={o.texto} role="menuitem" href={o.href} target={o.href.startsWith("/informes") ? "_blank" : undefined} onClick={() => setMenu(false)} className={clase}>
                      {interior}
                    </Link>
                  ) : (
                    <button
                      key={o.texto}
                      type="button"
                      role="menuitem"
                      disabled={o.texto === "Exportar a Excel" && lineas.length === 0}
                      onClick={() => {
                        setMenu(false);
                        o.onClick?.();
                      }}
                      className={clase}
                    >
                      {interior}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Button onClick={() => setRegistrando("EGRESO")} disabled={bloqueada} title={bloqueada ? "La caja de este día está cerrada. Reábrela para anotar movimientos." : undefined} className="h-10 flex-1 rounded-lg px-4 font-semibold sm:flex-none">
            <Plus />
            Registrar movimiento
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={cn("flex flex-col gap-6 rounded-2xl bg-card p-5 sm:p-6 lg:col-span-7", SOMBRA)}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col">
              <p className={cn("text-[13px] font-medium", GRIS)}>{esDia ? "Disponible del día" : "Disponible al cierre del mes"}</p>
              <p className={cn("mt-1.5 text-[38px] leading-none font-semibold tracking-tight tabular-nums sm:text-[48px]", disponible === null && "text-[#A19FB2]")}>{disponible === null ? "—" : clp(disponible)}</p>
              <p className={cn("mt-2.5 text-[13px]", GRIS)}>
                {cambioPeriodo === null ? (
                  saldoInicial ? "No se sabe con cuánta plata partías este período." : "Define el saldo inicial para ver el disponible."
                ) : (
                  <>
                    <span className={cn("font-semibold tabular-nums", cambioPeriodo < 0 ? "text-[#A32020]" : "text-[#075A3C]")}>{conSigno(cambioPeriodo)}</span> respecto a {esDia ? "ayer" : "el mes anterior"}
                  </>
                )}
              </p>
              {cerrada && resumen.cierre && disponible !== null && disponible !== resumen.cierre.disponible && (
                <button type="button" onClick={() => setCerrando(true)} className="mt-1.5 text-left text-[13px] font-medium text-[#A32020] hover:underline">
                  Cambió desde el cierre ({clp(resumen.cierre.disponible)}). Ver
                </button>
              )}
            </div>
            {tendencia && tendencia.length >= 2 && <Tendencia puntos={tendencia} esDia={esDia} />}
          </div>
          <p className={cn("-mt-2 flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-[#F8F7FC] px-3 py-2.5 text-[13px] tabular-nums sm:hidden", GRIS)}>
            <span>
              Anterior <b className="font-semibold text-[#15132B]">{anterior === null ? "—" : clp(anterior)}</b>
            </span>
            <span>
              + <b className="font-semibold text-[#15132B]">{clp(resumen.ingresos)}</b>
            </span>
            <span>
              − <b className="font-semibold text-[#15132B]">{clp(resumen.egresos)}</b>
            </span>
          </p>
          <dl className="mt-auto hidden rounded-xl bg-[#F8F7FC] p-4 text-sm sm:block sm:px-5">
            {[
              { k: "Disponible anterior", v: anterior === null ? "—" : clp(anterior), s: "", i: null },
              { k: "Ingresos", v: clp(resumen.ingresos), s: "+", i: <ArrowDownLeft key="i" className="size-3.5 text-[#0A9B68]" aria-hidden /> },
              { k: "Egresos", v: clp(resumen.egresos), s: "−", i: <ArrowUpRight key="e" className="size-3.5 text-[#D6403D]" aria-hidden /> },
            ].map((x) => (
              <div key={x.k} className="flex items-center justify-between gap-3 py-1.5">
                <dt className={cn("flex items-center gap-1.5", GRIS)}>
                  {x.i}
                  {x.k}
                </dt>
                <dd className="font-semibold tabular-nums">
                  <span aria-hidden className="mr-1 text-[#A19FB2]">
                    {x.s}
                  </span>
                  {x.v}
                </dd>
              </div>
            ))}
            <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-dashed border-[#DCD9E8] pt-3">
              <dt className="font-semibold">{esDia ? "Disponible del día" : "Disponible al cierre"}</dt>
              <dd className="font-semibold text-[#2A07A8] tabular-nums">
                <span aria-hidden className="mr-1 text-[#A19FB2]">
                  =
                </span>
                {disponible === null ? "—" : clp(disponible)}
              </dd>
            </div>
          </dl>
        </div>

        <div className={cn("flex flex-col gap-4 rounded-2xl bg-card p-5 sm:p-6 lg:col-span-5", SOMBRA)}>
          <p className={cn("text-[13px] font-medium", GRIS)}>Dónde está la plata</p>
          {resumen.bolsillos ? (
            <>
              <div className="divide-y divide-[#F0EEF6]">
                <TarjetaLugar lugar="efectivo" saldo={resumen.bolsillos.efectivo} antes={resumen.bolsillosAnterior?.efectivo ?? null} onAjustarSaldo={() => setDefiniendoSaldo(true)} />
                <TarjetaLugar lugar="banco" saldo={resumen.bolsillos.banco} antes={resumen.bolsillosAnterior?.banco ?? null} onAjustarSaldo={() => setDefiniendoSaldo(true)} />
              </div>
              <div className="mt-auto hidden items-center justify-between gap-3 rounded-xl bg-[#F8F7FC] px-4 py-3 text-sm sm:flex">
                <span className={GRIS}>Efectivo + banco</span>
                <span className="font-semibold tabular-nums">{clp(resumen.bolsillos.efectivo + resumen.bolsillos.banco)}</span>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-start justify-center gap-3 rounded-xl bg-[#F8F7FC] p-4">
              <p className={cn("text-sm", GRIS)}>{saldoInicial ? `Antes del ${fechaCorta(saldoInicial.fecha)} (la fecha de tu saldo inicial) no se sabe con cuánta plata partías.` : "Define con cuánta plata partes para ver cuánto hay en efectivo y cuánto en el banco."}</p>
              <Button variant="outline" onClick={() => setDefiniendoSaldo(true)} className="h-9 rounded-lg border-[#E4E1F0] bg-white font-semibold">
                <PiggyBank />
                {saldoInicial ? "Cambiar saldo inicial" : "Definir saldo inicial"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {!esDia && (ingresosCat.length > 0 || egresosCat.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {[
            { titulo: "De dónde vino", filas: ingresosCat },
            { titulo: "A dónde fue", filas: egresosCat },
          ].map((bloque) => (
            <div key={bloque.titulo} className={cn("rounded-2xl bg-card p-5 sm:p-6", SOMBRA)}>
              <h2 className={cn("text-[13px] font-medium", GRIS)}>{bloque.titulo}</h2>
              {bloque.filas.length === 0 ? (
                <p className={cn("mt-4 text-sm", GRIS)}>Nada este mes.</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2.5">
                  {bloque.filas.map((c) => (
                    <li key={`${c.tipo}${c.categoria}`} className="flex items-baseline justify-between gap-4 text-sm">
                      <span>{c.texto}</span>
                      <span className="font-semibold tabular-nums">{clp(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      <div className={cn("grid grid-cols-1 gap-4", esDia && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        <div className="flex min-w-0 flex-col gap-4">
          <div role="group" aria-label="Registrar rápido" className="grid grid-cols-4 gap-2 sm:gap-3">
            {botonRapido({ titulo: "Ingreso", detalle: "Entra plata", icono: ArrowDownLeft, color: "bg-[#E6F6EF] text-[#075A3C]", tipo: "INGRESO" })}
            {botonRapido({ titulo: "Egreso", detalle: "Sale plata", icono: ArrowUpRight, color: "bg-[#FDEFEF] text-[#A32020]", tipo: "EGRESO" })}
            {botonRapido({ titulo: "Giro", detalle: "Banco → caja", icono: ArrowLeftRight, color: "bg-[#ECE8FD] text-[#3A0CE3]", href: "/panel/giros" })}
            {botonRapido({ titulo: "Depósito", detalle: "Caja → banco", icono: Landmark, color: "bg-[#E2F2FC] text-[#0A5F91]", href: "/panel/giros" })}
          </div>

          <div className={cn("flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card", SOMBRA)}>
            <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4 sm:px-5 xl:flex-row xl:items-center">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[15px] font-semibold">
                  Movimientos <span className={cn("font-normal", GRIS)}>· {filtradas.length}</span>
                </h2>
                <Actualizado actualizadoEn={dataUpdatedAt} cargando={isFetching} onActualizar={volverAPedir} />
              </div>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row xl:justify-end">
                <div className="relative min-w-0 sm:flex-1 xl:max-w-[260px]">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input aria-label="Buscar movimientos" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Descripción o referencia" className="h-10 rounded-lg border-[#E4E1F0] bg-white pl-9 shadow-none" />
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                  <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as string)}>
                    <SelectTrigger aria-label="Tipo" className="h-10 w-full min-w-0 rounded-lg border-[#E4E1F0] bg-white px-3 sm:w-[150px]">
                      <SelectValue>{(v) => opcionesTipo.find((o) => o.valor === v)?.texto ?? ""}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {opcionesTipo.map((o) => (
                        <SelectItem key={o.valor} value={o.valor}>
                          {o.texto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filtroOrigen} onValueChange={(v) => setFiltroOrigen(v as string)}>
                    <SelectTrigger aria-label="Origen" className="h-10 w-full min-w-0 rounded-lg border-[#E4E1F0] bg-white px-3 sm:w-[165px]">
                      <SelectValue>{(v) => opcionesOrigen.find((o) => o.valor === v)?.texto ?? ""}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {opcionesOrigen.map((o) => (
                        <SelectItem key={o.valor} value={o.valor}>
                          {o.texto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" aria-label="Descargar en Excel" title="Descargar en Excel" disabled={lineas.length === 0} onClick={() => descargarCsv(lineas, desde, categoriasPropias)} className="size-10 rounded-lg border-[#E4E1F0] bg-white">
                    <Download />
                  </Button>
                </div>
              </div>
            </div>

            {filtradas.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="font-semibold">Sin movimientos de caja</p>
                <p className={cn("mx-auto mt-1 max-w-xl text-sm", GRIS)}>
                  {lineas.length === 0 ? "Los pagos de socios aparecerán aquí al registrarlos, y los ingresos y egresos manuales al anotarlos." : "Ningún movimiento coincide con la búsqueda o los filtros."}
                </p>
              </div>
            ) : (
              <>
                <div className="scroll-fino hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className={cn("text-left text-xs font-medium", GRIS)}>
                        <th scope="col" className="w-[84px] px-5 py-2.5 font-medium">
                          {esDia ? "Hora" : "Fecha"}
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          Descripción
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          Tipo
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          Medio
                        </th>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          Registró
                        </th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">
                          Monto
                        </th>
                        <th scope="col" aria-label="Acciones" className="w-[60px] px-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.map((l) => (
                        <tr key={l.id} className="border-t border-[#F3F1F8] hover:bg-[#FBFAFF]">
                          <td className={cn("px-5 py-3.5 tabular-nums", GRIS)}>{esDia ? (l.hora ?? "—") : fechaCorta(l.fecha).slice(0, 5)}</td>
                          <td className="px-3 py-3.5">
                            <p className="font-semibold">{l.concepto}</p>
                            <p className={cn("text-xs", GRIS)}>{[l.contraparte, l.referencia ? `N.° ${l.referencia}` : null, origenDe(l)].filter(Boolean).join(" · ")}</p>
                          </td>
                          <td className="px-3 py-3.5">
                            <TipoPill tipo={l.tipo} />
                          </td>
                          <td className="px-3 py-3.5">{textoMedioLinea(l.medio)}</td>
                          <td className={cn("px-3 py-3.5", GRIS)}>{l.registradoPor ?? "—"}</td>
                          <td className={cn("px-3 py-3.5 text-right text-[15px] font-semibold tabular-nums", l.tipo === "EGRESO" ? "text-[#A32020]" : "text-[#075A3C]")}>{conSigno(firmado(l))}</td>
                          <td className="px-3 py-3.5 text-right">{botonBorrar(l)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="md:hidden">
                  {filtradas.map((l) => (
                    <li key={l.id} className="flex items-start gap-3 border-t border-[#F3F1F8] px-4 py-3.5 first:border-0">
                      <span aria-hidden className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", l.tipo === "EGRESO" ? "bg-[#FDEFEF] text-[#A32020]" : "bg-[#E6F6EF] text-[#075A3C]")}>
                        {l.tipo === "EGRESO" ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{l.concepto}</p>
                        <p className={cn("truncate text-[13px]", GRIS)}>
                          {[l.contraparte, textoMedioLinea(l.medio), esDia ? l.hora : fechaCorta(l.fecha).slice(0, 5)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end">
                        <p className={cn("text-[15px] font-semibold tabular-nums", l.tipo === "EGRESO" ? "text-[#A32020]" : "text-[#075A3C]")}>{conSigno(firmado(l))}</p>
                        {botonBorrar(l)}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className={cn("mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[#F0EEF6] bg-[#FAFAFD] px-4 py-3 text-sm sm:px-5", GRIS)}>
              <span>
                {filtradas.length} movimiento{filtradas.length === 1 ? "" : "s"}
              </span>
              <span>
                Neto <strong className={cn("font-semibold tabular-nums", neto < 0 ? "text-[#A32020]" : "text-[#15132B]")}>{clp(neto)}</strong>
              </span>
            </div>
          </div>
        </div>

        {esDia && (
          <div className="flex flex-col gap-4">
            <Arqueo key={resumen.desde + String(cerrada)} resumen={resumen} onVerCierre={() => setCerrando(true)} onDefinirSaldo={() => setDefiniendoSaldo(true)} />
          </div>
        )}
      </div>

      {registrando && <NuevoMovimientoDialog tipoInicial={registrando} fecha={esDia ? desde : undefined} categoriasPropias={categoriasPropias} onCerrar={cerrarRegistro} />}
      {dialogo}
      {gestionandoCategorias && <CategoriasCajaDialog propias={categoriasPropias} onCerrar={cerrarCategorias} />}
      {cerrando && (
        <CerrarCajaDialog
          resumen={resumen}
          movimientos={lineas.length}
          saldoInicial={saldoInicial}
          onDefinirSaldo={() => {
            setCerrando(false);
            setDefiniendoSaldo(true);
          }}
          onCerrar={cerrarCierre}
        />
      )}
      {definiendoSaldo && <SaldoInicialDialog actual={saldoInicial} onCerrar={cerrarSaldo} />}
    </div>
  );
}
