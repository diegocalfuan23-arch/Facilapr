"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, Banknote, CheckCircle2, Download, Landmark, Link2, Loader2, MessageCircle, MoreHorizontal, Pencil, Plus, Search, Store, Trash2, Wallet, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { eliminarPago } from "@/app/panel/boletas/actions";
import { EditarPagoDialog } from "@/components/panel/editar-pago-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatearPeriodo } from "@/lib/boletas";
import { formatearRut } from "@/lib/formato";
import { MEDIOS_PAGO, textoConcepto, textoMedioPago } from "@/lib/pagos";
import { NuevoPagoDialog, type BoletaPendiente } from "@/components/panel/nuevo-pago-dialog";
import { LinkPagoDialog } from "@/components/panel/link-pago-dialog";
import type { OpcionSocio } from "@/components/panel/socio-buscador";
import { enlaceWhatsApp, mensajeComprobanteCobro, type DatosComiteWhatsApp } from "@/lib/whatsapp";
import { enviarComprobantePorWhatsApp } from "@/app/panel/pagos/comprobante-actions";
import { CupoWhatsappInfo } from "@/components/panel/cupo-whatsapp";
import type { CupoWhatsapp } from "@/lib/whatsapp-cupo-comun";
import { useConfirmar } from "@/components/ui/confirmar";
import { avisarCambio } from "@/lib/avisos-datos";

export type PagoFila = {
  id: string;
  monto: number;
  /** ISO. */
  fecha: string;
  medio: string;
  referencia: string | null;
  /** Quien pagó, si no es el titular. */
  pagadoPor: string | null;
  /** Null en un cobro que no es una boleta. */
  periodo: string | null;
  /** BOLETA, RECONEXION, REPARACION u OTRO. */
  concepto: string;
  descripcion: string | null;
  /** El pago es parte de un acuerdo de pago (repactación). */
  repactacionId: string | null;
  socioNombre: string;
  socioRut: string | null;
  socioTelefono?: string | null;
  /** El socio aceptó recibir WhatsApp automáticos (Meta lo exige para enviar por la API). */
  socioConsentimiento?: boolean;
  /** SOCIO o USUARIO: de quién es la cuenta que se pagó. */
  socioTipo: string;
  /** El usuario del panel que registró el pago; null en los antiguos. */
  registradoPor: string | null;
  comprobanteUrl: string;
};

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const POR_PAGINA = 25;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";

const ICONO_MEDIO: Record<string, LucideIcon> = { EFECTIVO: Banknote, TRANSFERENCIA: Landmark, CAJA_VECINA: Store };
const TINTE: Record<string, string> = {
  TRANSFERENCIA: "bg-[#ECE8FD] text-[#3A0CE3]",
  EFECTIVO: "bg-[#DFF4EB] text-[#0A7A52]",
  CAJA_VECINA: "bg-[#FFEEDC] text-[#B86400]",
};
const COLOR_MEDIO: Record<string, string> = { TRANSFERENCIA: "bg-[#3A0CE3]", EFECTIVO: "bg-[#0A9B68]", CAJA_VECINA: "bg-[#E58200]" };
function IconoMedio({ medio, className }: { medio: string; className?: string }) {
  const Icono = ICONO_MEDIO[medio] ?? MoreHorizontal;
  return <Icono className={className} aria-hidden />;
}
const tinteDe = (medio: string) => TINTE[medio] ?? "bg-[#F0EFF4] text-[#6F6C82]";
const colorDe = (medio: string) => COLOR_MEDIO[medio] ?? "bg-[#A5A3B5]";

/** Lo que no es uno de los cuatro medios (Mercado Pago, Flow) cuenta como "Otro". */
const medioAgrupado = (m: string) => (MEDIOS_PAGO.some((x) => x.valor === m) ? m : "OTRO");

const claveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const mesAnteriorDe = (m: string) => {
  const [a, n] = m.split("-").map(Number);
  return n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, "0")}`;
};
const nombreMes = (m: string) => {
  const [a, n] = m.split("-").map(Number);
  return `${MESES[n - 1][0].toUpperCase()}${MESES[n - 1].slice(1, 3)} ${a}`;
};
const claveDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const diaLargo = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`;
};

/** Qué se pagó: el mes de la boleta, o el concepto (con su detalle) si no fue una boleta. */
function queSePago(p: PagoFila) {
  if (p.periodo) return `${formatearPeriodo(p.periodo)}${p.repactacionId ? " · repactación" : ""}`;
  return p.descripcion ? `${textoConcepto(p.concepto)} (${p.descripcion})` : textoConcepto(p.concepto);
}

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** El comprobante de un pago: encabezado con el monto y el detalle, y sus acciones. */
function Comprobante({ p, onCerrar, onCorregir, onEliminar, onVerSocio, onEnviar, enviando, porApi }: { p: PagoFila; onCerrar: () => void; onCorregir: () => void; onEliminar: () => void; onVerSocio: () => void; onEnviar: () => void; enviando: boolean; porApi: boolean }) {
  const filas: [string, string][] = [
    ["Socio", p.socioNombre],
    ["Tipo", p.socioTipo === "USUARIO" ? "Usuario" : "Socio"],
    ["RUT", p.socioRut ? formatearRut(p.socioRut) : "Sin RUT"],
    ["Concepto", queSePago(p)],
    ["Pagó", p.pagadoPor ?? "El titular"],
    ["Registró", p.registradoPor ?? "—"],
    ["N.° de operación", p.referencia ?? "—"],
  ];
  const sinTelefono = !p.socioTelefono;
  return (
    <div className="flex h-full flex-col">
      <div className="relative bg-gradient-to-br from-[#3A0CE3] to-[#6B46F5] px-5 pt-5 pb-6 text-white">
        <Button variant="ghost" size="icon" aria-label="Cerrar comprobante" onClick={onCerrar} className="absolute top-3 right-3 size-9 rounded-lg text-white hover:bg-white/15 hover:text-white lg:hidden">
          <X />
        </Button>
        <div className="flex items-center justify-between pr-10 text-[13px] font-medium text-white/80 lg:pr-0">
          <span>Comprobante de pago</span>
          <span className="tabular-nums">N.° {p.id.slice(-5).toUpperCase()}</span>
        </div>
        <p className="mt-1 text-[36px] leading-none font-semibold tracking-tight tabular-nums">{clp.format(p.monto)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-semibold">
            <IconoMedio medio={p.medio} className="size-3.5" />
            {textoMedioPago(p.medio)}
          </span>
          <span className="text-white/75">{diaLargo(p.fecha)}</span>
          {p.repactacionId && <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold">Repactación</span>}
        </div>
      </div>
      <div aria-hidden className="h-3 bg-[radial-gradient(circle_at_8px_0,transparent_7px,#fff_7.5px)] bg-[length:16px_12px] bg-repeat-x" />
      <dl className="flex-1 px-5 pb-2">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-dashed border-[#E4E1F0] py-2.5 text-sm last:border-0">
            <dt className={GRIS}>{k}</dt>
            <dd className="min-w-0 truncate text-right font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={onVerSocio} className="mx-5 mb-3 flex items-center justify-between rounded-lg bg-[#F7F6FB] px-3 py-2.5 text-left text-[13px] font-semibold text-[#2A07A8] hover:bg-[#F0EDFC] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span className="min-w-0 truncate">Ver todos los pagos de {p.socioNombre}</span>
        <ArrowRight className="size-4 shrink-0" aria-hidden />
      </button>
      <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 border-t border-[#F0EEF6] p-4">
        <Button className="h-10 rounded-lg px-3 font-semibold" render={<a href={p.comprobanteUrl} target="_blank" rel="noopener" />}>
          <Download />
          Descargar
        </Button>
        <Button
          variant="outline"
          disabled={enviando || (sinTelefono && !porApi)}
          onClick={onEnviar}
          title={sinTelefono ? "El socio no tiene teléfono" : porApi ? "Sale solo por WhatsApp (mensaje automático)" : "Se abre WhatsApp para enviarlo a mano"}
          className="h-10 rounded-lg border-[#E4E1F0] px-3 font-semibold"
        >
          {enviando ? <Loader2 className="animate-spin" /> : <MessageCircle />}
          Enviar
        </Button>
        <Button variant="outline" size="icon" aria-label={`Corregir el pago de ${p.socioNombre}`} title="Corregir este pago" onClick={onCorregir} className="size-10 rounded-lg border-[#E4E1F0]">
          <Pencil />
        </Button>
        <Button variant="outline" size="icon" aria-label={`Eliminar el pago de ${p.socioNombre}`} title="Eliminar este pago" onClick={onEliminar} className="size-10 rounded-lg border-[#E4E1F0] text-[#A32020] hover:bg-[#FDECEC] hover:text-[#A32020]">
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

/** Todos los pagos que ha registrado el comité, con búsqueda y filtro por medio. */
export function PagosTabla({
  pagos,
  socios,
  todosLosSocios,
  costoReconexion,
  resumen,
  boletasPendientes,
  comite,
  mpConectado = false,
  mpHabilitado = false,
  estadoMp,
  mpModo = "prueba",
  cupoWhatsapp = null,
}: {
  pagos: PagoFila[];
  /** Cuántos socios están al día y cuántos tienen deuda vencida (y por cuánto). */
  resumen: { morosos: number; deudaVencida: number; alDia: number };
  socios: OpcionSocio[];
  todosLosSocios: OpcionSocio[];
  costoReconexion: number | null;
  boletasPendientes: BoletaPendiente[];
  comite: DatosComiteWhatsApp;
  /** El comité conectó su cuenta de Mercado Pago: se puede cobrar con link de pago. */
  mpConectado?: boolean;
  /** El comité tiene prendida la conexión con Mercado Pago (aunque aún no la haya hecho). */
  mpHabilitado?: boolean;
  /** Franja de estado de Mercado Pago (aviso tras conectar, cuenta conectada), bajo el encabezado. */
  estadoMp?: React.ReactNode;
  mpModo?: "prueba" | "produccion";
  /** Mensajes automáticos del mes (null si el envío por API no está activo). */
  cupoWhatsapp?: CupoWhatsapp | null;
}) {
  const { confirmar, dialogo } = useConfirmar();
  const router = useRouter();
  const [registrando, setRegistrando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState<PagoFila | null>(null);
  const [conLink, setConLink] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [medio, setMedio] = useState<string>("todos");
  const [limiteDe, setLimiteDe] = useState({ clave: "", n: POR_PAGINA });
  const [sel, setSel] = useState<string | null>(null);
  const [movil, setMovil] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

  const ahora = new Date();
  const mesActualClave = claveMes(ahora);
  const [mes, setMes] = useState<string>(mesActualClave);

  /** Los meses con pagos (y el actual, aunque aún no tenga), del más reciente al más antiguo. */
  const meses = useMemo(() => [...new Set([mesActualClave, ...pagos.map((p) => claveMes(new Date(p.fecha)))])].sort().reverse(), [pagos, mesActualClave]);
  const base = useMemo(() => pagos.filter((p) => mes === "todos" || claveMes(new Date(p.fecha)) === mes), [pagos, mes]);

  // El mes de referencia del resumen y del gráfico: el elegido, o el actual si se ven todos.
  const mesRef = mes === "todos" ? mesActualClave : mes;
  const mesPrev = mesAnteriorDe(mesRef);
  const [anioRef, numRef] = mesRef.split("-").map(Number);
  const delMes = pagos.filter((p) => claveMes(new Date(p.fecha)) === mesRef);
  const delMesAnterior = pagos.filter((p) => claveMes(new Date(p.fecha)) === mesPrev);
  const totalMes = delMes.reduce((acc, p) => acc + p.monto, 0);
  const totalAnterior = delMesAnterior.reduce((acc, p) => acc + p.monto, 0);
  const diferencia = totalMes - totalAnterior;
  const nombreMesAnterior = MESES[Number(mesPrev.slice(5)) - 1];

  const filtrados = useMemo(() => {
    const t = sinTildes(busqueda.trim());
    const numero = t.replace(/[$.\s]/g, "");
    return base.filter((p) => {
      if (medio !== "todos" && medioAgrupado(p.medio) !== medio) return false;
      if (!t) return true;
      return (
        sinTildes(`${p.socioNombre} ${p.socioRut ?? ""} ${p.referencia ?? ""} ${queSePago(p)} ${p.pagadoPor ?? ""} ${p.registradoPor ?? ""}`).includes(t) ||
        (/^\d+$/.test(numero) && String(p.monto).includes(numero))
      );
    });
  }, [base, busqueda, medio]);

  const totalFiltrado = filtrados.reduce((acc, p) => acc + p.monto, 0);
  // Cada vez que cambia un filtro se vuelve a la primera página.
  const claveFiltro = `${busqueda}|${medio}|${mes}`;
  const limite = limiteDe.clave === claveFiltro ? limiteDe.n : POR_PAGINA;
  const mostrados = filtrados.slice(0, limite);

  const grupos = useMemo(() => {
    const m = new Map<string, PagoFila[]>();
    for (const p of mostrados) {
      const k = claveDia(new Date(p.fecha));
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, limite]);

  const porMedio = useMemo(
    () =>
      MEDIOS_PAGO.map((m) => {
        const ps = base.filter((p) => medioAgrupado(p.medio) === m.valor);
        return { m: m.valor as string, v: ps.reduce((t, p) => t + p.monto, 0), n: ps.length };
      }),
    [base]
  );
  const totalBase = base.reduce((t, p) => t + p.monto, 0);

  // El mes entero, un día por barra; los días que aún no llegan se ven más claros.
  const largoMes = new Date(anioRef, numRef, 0).getDate();
  const dias = (() => {
    const hoy = new Date();
    return Array.from({ length: largoMes }, (_, i) => {
      const d = new Date(anioRef, numRef - 1, i + 1);
      const k = claveDia(d);
      return { k, d, futuro: d > hoy, v: pagos.filter((p) => claveDia(new Date(p.fecha)) === k).reduce((t, p) => t + p.monto, 0) };
    });
  })();
  const maxDia = Math.max(...dias.map((x) => x.v), 1);
  const etiquetaDia = (d: Date) => `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;

  const pago = filtrados.find((p) => p.id === sel) ?? filtrados[0] ?? null;

  /** Recorrer la lista con ↑ ↓. */
  function mover(dir: 1 | -1) {
    const i = mostrados.findIndex((p) => p.id === pago?.id);
    const sig = mostrados[Math.min(Math.max(i + dir, 0), mostrados.length - 1)];
    if (sig) {
      setSel(sig.id);
      listaRef.current?.querySelector<HTMLButtonElement>(`[data-id="${sig.id}"]`)?.focus();
    }
  }

  /** Todos los pagos de un socio, de cualquier mes. */
  function verPagosDe(p: PagoFila) {
    setBusqueda(p.socioRut ?? p.socioNombre);
    setMes("todos");
    setMedio("todos");
    setMovil(false);
  }

  const hayFiltro = busqueda.trim() !== "" || medio !== "todos";

  const [enviandoId, setEnviandoId] = useState<string | null>(null);

  /** ¿Este comprobante puede salir por la API? Envío activo, cupo, consentimiento, teléfono y pago de una boleta. */
  const sale_por_api = (p: PagoFila) =>
    Boolean(cupoWhatsapp?.disponible && p.socioConsentimiento && p.socioTelefono && p.concepto === "BOLETA" && p.periodo);

  /** Abre WhatsApp con el comprobante ya escrito: el envío manual, que no gasta mensajes del plan. */
  function enviarAMano(p: PagoFila) {
    if (!p.socioTelefono) return;
    const texto = mensajeComprobanteCobro(comite.nombre, {
      socioNombre: p.socioNombre,
      concepto: p.periodo ? `la boleta de ${formatearPeriodo(p.periodo)}` : textoConcepto(p.concepto),
      descripcion: p.periodo ? null : p.descripcion,
      monto: p.monto,
      comprobanteUrl: p.comprobanteUrl,
      pagadoPor: p.pagadoPor,
    });
    window.open(enlaceWhatsApp(p.socioTelefono, texto), "_blank", "noopener");
  }

  async function enviarComprobante(p: PagoFila) {
    if (!sale_por_api(p)) return enviarAMano(p);
    setEnviandoId(p.id);
    const r = await enviarComprobantePorWhatsApp(p.id).catch(() => ({ ok: false, error: "No pudimos enviar el mensaje. Vuelve a intentarlo." }) as const);
    setEnviandoId(null);
    if (r.ok) {
      toast.success("Comprobante enviado por WhatsApp");
      router.refresh();
      return;
    }
    // Se acabaron los mensajes del plan este mes: se manda a mano.
    if ("sinCupo" in r && r.sinCupo) {
      toast.info(r.error);
      enviarAMano(p);
      router.refresh();
      return;
    }
    toast.error(r.error);
  }

  async function borrar(p: PagoFila) {
    const aviso = p.periodo ? "La boleta volverá a deber ese monto." : "Se quita también de la Caja.";
    if (!(await confirmar({ titulo: `¿Eliminar el pago de ${clp.format(p.monto)}?`, descripcion: `${p.socioNombre}. ${aviso}`, boton: "Eliminar" }))) return;
    const r = await eliminarPago(p.id);
    if (r.ok) {
      toast.success("Pago eliminado");
      avisarCambio("caja");
      setMovil(false);
      router.refresh();
    } else {
      toast.error(r.error);
    }
  }

  const filtros = [
    { valor: "todos", texto: "Todos", n: base.length },
    ...MEDIOS_PAGO.map((m) => ({ valor: m.valor as string, texto: m.texto as string, n: porMedio.find((x) => x.m === m.valor)?.n ?? 0 })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Pagos</h1>
          <p className={cn("mt-0.5 text-[15px]", GRIS)}>Todo lo que han pagado tus socios, con su comprobante.</p>
        </div>
        <div className="flex gap-2">
          {mpConectado ? (
            <Button variant="outline" onClick={() => setConLink(true)} title="Mercado Pago conectado" className="h-10 flex-1 rounded-lg border-[#E4E1F0] bg-white font-semibold sm:flex-none">
              <CheckCircle2 className="text-emerald-600" />
              Link de pago
            </Button>
          ) : (
            mpHabilitado && (
              <Button variant="outline" render={<a href="/api/mercadopago/conectar" />} className="h-10 flex-1 rounded-lg border-[#E4E1F0] bg-white font-semibold sm:flex-none">
                <Link2 />
                Conectar Mercado Pago
              </Button>
            )
          )}
          <Button data-tour="pag-registrar" onClick={() => setRegistrando(true)} className="h-10 flex-1 rounded-lg px-4 font-semibold sm:flex-none">
            <Plus />
            Registrar pago
          </Button>
        </div>
      </div>

      {estadoMp}

      {cupoWhatsapp && <CupoWhatsappInfo cupo={cupoWhatsapp} compacto />}

      {pagos.length === 0 ? (
        <div className={cn("flex flex-col items-center rounded-2xl bg-card px-6 py-14 text-center", SOMBRA)}>
          <span className="flex size-11 items-center justify-center rounded-full bg-[#F4F3F9]">
            <Wallet className="size-5 text-[#5B5970]" />
          </span>
          <h2 className="mt-4 text-[1rem] font-semibold">Aún no hay pagos registrados</h2>
          <p className={cn("mt-2 max-w-[48ch] text-[0.92rem] leading-relaxed", GRIS)}>
            Cuando un socio pague, toca “Registrar pago”, busca al socio y elige su
            boleta, o una reposición, reparación u otro cobro. Aquí quedará el historial y el comprobante para enviarle.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className={cn("flex flex-col rounded-2xl bg-card p-5 sm:p-6 lg:col-span-8", SOMBRA)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={cn("text-[13px] font-medium", GRIS)}>Recaudado en {MESES[numRef - 1]}</p>
                  <p className="mt-1.5 text-[34px] leading-none font-semibold tracking-tight tabular-nums sm:text-[40px]">{clp.format(totalMes)}</p>
                  <p className={cn("mt-2 flex items-center gap-1.5 text-[13px]", GRIS)}>
                    <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold", diferencia >= 0 ? "bg-[#DFF4EB] text-[#075A3C]" : "bg-[#FDECEC] text-[#A32020]")}>
                      {diferencia >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
                      {clp.format(Math.abs(diferencia))}
                    </span>
                    {diferencia >= 0 ? "más" : "menos"} que {nombreMesAnterior}
                  </p>
                </div>
                <span className={cn("hidden rounded-full bg-[#F4F3F9] px-3 py-1 text-xs font-medium sm:inline", GRIS)}>Por día · {MESES[numRef - 1]}</span>
              </div>
              <div className="relative mt-6 flex-1">
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[96px] border-t border-dashed border-[#ECEAF4]" />
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[48px] border-t border-dashed border-[#ECEAF4]" />
                <div role="img" aria-label={`Recaudación diaria de ${MESES[numRef - 1]}`} className="relative flex h-[96px] items-end gap-[3px] border-b border-[#E4E1F0]">
                  {dias.map((x) => (
                    <span
                      key={x.k}
                      title={`${etiquetaDia(x.d)}: ${clp.format(x.v)}`}
                      className={cn("relative min-w-0 flex-1 rounded-t-[4px]", x.v ? (x.v === maxDia ? "bg-primary" : "bg-[#8F78F2]") : x.futuro ? "bg-[#F7F6FB]" : "bg-[#ECE9F5]")}
                      style={{ height: x.v ? `${Math.max((x.v / maxDia) * 100, 8)}%` : "3px" }}
                    >
                      {x.v === maxDia && x.v > 0 ? (
                        <span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded-md bg-[#15132B] px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white sm:block">{clp.format(x.v)}</span>
                      ) : null}
                    </span>
                  ))}
                </div>
                <div className={cn("mt-1.5 flex justify-between text-[11px]", GRIS)}>
                  <span>{etiquetaDia(dias[0].d)}</span>
                  <span>{etiquetaDia(dias[14].d)}</span>
                  <span>{etiquetaDia(dias[largoMes - 1].d)}</span>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-y-3 border-t border-[#F0EEF6] pt-4 sm:grid-cols-4">
                {[
                  { k: "Pagos del mes", v: String(delMes.length), nota: null as string | null },
                  { k: nombreMesAnterior[0].toUpperCase() + nombreMesAnterior.slice(1), v: clp.format(totalAnterior), nota: null },
                  { k: "Socios al día", v: String(resumen.alDia), nota: null },
                  { k: "Morosos", v: String(resumen.morosos), nota: resumen.morosos > 0 ? `${clp.format(resumen.deudaVencida)} vencidos` : null },
                ].map((x, i) => (
                  <div key={x.k} className={cn("min-w-0", i % 2 ? "pl-4 sm:pl-5" : "", i > 0 ? "sm:border-l sm:border-[#F0EEF6] sm:pl-5" : "")}>
                    <dt className={cn("text-xs", GRIS)}>{x.k}</dt>
                    <dd className={cn("mt-0.5 text-[17px] font-semibold tabular-nums", x.k === "Morosos" && resumen.morosos > 0 && "text-destructive")}>{x.v}</dd>
                    {x.nota && <p className={cn("text-xs tabular-nums", GRIS)}>{x.nota}</p>}
                  </div>
                ))}
              </dl>
            </div>

            <div className={cn("rounded-2xl bg-card p-5 sm:p-6 lg:col-span-4", SOMBRA)}>
              <div className="flex items-center justify-between">
                <p className={cn("text-[13px] font-medium", GRIS)}>Por medio de pago</p>
                {medio !== "todos" ? (
                  <button type="button" onClick={() => setMedio("todos")} className="text-xs font-semibold text-[#2A07A8] hover:underline">
                    Quitar filtro
                  </button>
                ) : (
                  <span className={cn("text-xs", GRIS)}>{mes === "todos" ? "Todos los meses" : MESES[numRef - 1]}</span>
                )}
              </div>
              <div aria-hidden className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full bg-[#F0EEF7]">
                {porMedio
                  .filter((x) => x.v > 0)
                  .map((x) => (
                    <span key={x.m} className={cn(colorDe(x.m), "transition-opacity", medio !== "todos" && medio !== x.m && "opacity-25")} style={{ width: `${(x.v / (totalBase || 1)) * 100}%`, minWidth: 6 }} />
                  ))}
              </div>
              <ul className="-mx-2 mt-4 flex flex-col gap-1">
                {porMedio.map((x) => (
                  <li key={x.m} className={cn(!x.n && "max-sm:hidden")}>
                    <button
                      type="button"
                      disabled={!x.n}
                      aria-pressed={medio === x.m}
                      onClick={() => setMedio(medio === x.m ? "todos" : x.m)}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:opacity-50", medio === x.m ? "bg-[#F3F0FE]" : "enabled:hover:bg-[#F8F7FC]")}
                    >
                      <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tinteDe(x.m))}>
                        <IconoMedio medio={x.m} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{textoMedioPago(x.m)}</span>
                        <span className={cn("block text-xs", GRIS)}>
                          {x.n} pago{x.n === 1 ? "" : "s"} · {!totalBase ? 0 : x.v && x.v / totalBase < 0.01 ? "<1" : Math.round((x.v / totalBase) * 100)}%
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{clp.format(x.v)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2">
              <Select value={mes} onValueChange={(v) => setMes(v as string)}>
                <SelectTrigger aria-label="Mes" className="h-10 w-[128px] shrink-0 rounded-lg border-[#E4E1F0] bg-white px-3 font-semibold sm:w-[140px]">
                  <SelectValue>{(v) => (v === "todos" ? "Todos" : v ? nombreMes(String(v)) : "")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m} value={m}>
                      {nombreMes(m)}
                    </SelectItem>
                  ))}
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative min-w-0 flex-1 lg:w-[320px] lg:flex-none">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  aria-label="Buscar pagos"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Socio, RUT, monto u operación"
                  className="h-10 rounded-lg border-[#E4E1F0] bg-white pr-8 pl-9 shadow-none"
                />
                {busqueda && (
                  <button type="button" aria-label="Limpiar búsqueda" onClick={() => setBusqueda("")} className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-[#8A8799] hover:bg-[#F2F1F7]">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
            <Select
              value={medio}
              onValueChange={(v) => setMedio(v as string)}
            >
              <SelectTrigger aria-label="Filtrar por medio" className="h-10 w-full rounded-lg border-[#E4E1F0] bg-white px-3 sm:hidden">
                <SelectValue>
                  {(v) => {
                    const f = filtros.find((x) => x.valor === v);
                    return f ? `${f.valor === "todos" ? "Todos los medios" : f.texto} (${f.n})` : "";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {filtros.map((f) => (
                  <SelectItem key={f.valor} value={f.valor} disabled={!f.n}>
                    {f.valor === "todos" ? "Todos los medios" : f.texto} ({f.n})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div role="group" aria-label="Filtrar por medio" className="hidden gap-1 rounded-lg bg-white/80 p-1 sm:flex">
              {filtros.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  aria-pressed={medio === f.valor}
                  disabled={!f.n}
                  onClick={() => setMedio(f.valor)}
                  className={cn("h-9 truncate rounded-md px-3 text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40", medio === f.valor ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}
                >
                  {f.texto}
                  <span className={cn("ml-1.5 text-xs font-medium tabular-nums", medio === f.valor ? "text-[#6B46F5]" : "text-[#A19FB2]")}>{f.n}</span>
                </button>
              ))}
            </div>
          </div>

          <div data-tour="pag-lista" className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div
              ref={listaRef}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  mover(e.key === "ArrowDown" ? 1 : -1);
                }
              }}
              className={cn("min-w-0 overflow-clip rounded-2xl bg-card", SOMBRA)}
            >
              {filtrados.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <p className="font-semibold">No hay pagos</p>
                  <p className={cn("mt-1 text-sm", GRIS)}>{hayFiltro ? "Prueba con otro filtro o búsqueda." : "Este mes todavía no se registran pagos."}</p>
                  {hayFiltro && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setBusqueda("");
                        setMedio("todos");
                      }}
                      className="mt-4 h-9 rounded-lg border-[#E4E1F0] font-semibold"
                    >
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              ) : (
                grupos.map(([k, ps]) => (
                  <section key={k} aria-label={diaLargo(ps[0].fecha)}>
                    <h2 className={cn("sticky top-0 z-10 flex justify-between border-b border-[#F3F1F8] bg-[#FAFAFD]/95 px-5 py-2 text-xs font-semibold tracking-wide uppercase backdrop-blur", GRIS)}>
                      <span>{diaLargo(ps[0].fecha)}</span>
                      <span className="tabular-nums">{clp.format(ps.reduce((t, p) => t + p.monto, 0))}</span>
                    </h2>
                    <ul className="divide-y divide-[#F6F5FA]">
                      {ps.map((p) => {
                        const activo = pago?.id === p.id;
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              data-id={p.id}
                              onClick={() => {
                                setSel(p.id);
                                setMovil(true);
                              }}
                              aria-current={activo ? "true" : undefined}
                              className={cn("flex w-full items-center gap-3 px-5 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset", activo ? "bg-[#F5F3FE] shadow-[inset_3px_0_0_#3A0CE3]" : "hover:bg-[#FBFAFF]")}
                            >
                              <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tinteDe(p.medio))}>
                                <IconoMedio medio={p.medio} className="size-[18px]" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold">{p.socioNombre}</span>
                                <span className={cn("block truncate text-[13px]", GRIS)}>
                                  {queSePago(p)} · {textoMedioPago(p.medio)}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block text-[15px] font-semibold tabular-nums">{clp.format(p.monto)}</span>
                                <span className={cn("block text-xs", GRIS)}>{p.pagadoPor ?? "Titular"}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
              {filtrados.length > limite && (
                <div className="border-t border-[#F0EEF6] p-2.5 text-center">
                  <Button variant="ghost" onClick={() => setLimiteDe({ clave: claveFiltro, n: limite + POR_PAGINA })} className="h-9 rounded-lg font-semibold text-[#2A07A8]">
                    <ChevronDown />
                    Mostrar {Math.min(POR_PAGINA, filtrados.length - limite)} más · quedan {filtrados.length - limite}
                  </Button>
                </div>
              )}
              <div className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3 text-sm", GRIS)}>
                <span>
                  {filtrados.length} pago{filtrados.length === 1 ? "" : "s"}
                  {mes !== "todos" ? ` en ${MESES[numRef - 1]}` : ""}
                  <span className="hidden lg:inline"> · usa ↑ ↓ para recorrer</span>
                </span>
                <span>
                  Total <strong className="font-semibold text-[#15132B] tabular-nums">{clp.format(totalFiltrado)}</strong>
                </span>
              </div>
            </div>

            {pago && (
              <div className={cn("hidden overflow-hidden rounded-2xl bg-card lg:sticky lg:top-4 lg:block", SOMBRA)}>
                <Comprobante p={pago} onCerrar={() => setMovil(false)} onCorregir={() => setCorrigiendo(pago)} onEliminar={() => void borrar(pago)} onVerSocio={() => verPagosDe(pago)} onEnviar={() => void enviarComprobante(pago)} enviando={enviandoId === pago.id} porApi={sale_por_api(pago)} />
              </div>
            )}
          </div>

          {pago && movil && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button type="button" aria-label="Cerrar comprobante" onClick={() => setMovil(false)} className="absolute inset-0 bg-[#15132B]/40" />
              <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white">
                <Comprobante p={pago} onCerrar={() => setMovil(false)} onCorregir={() => setCorrigiendo(pago)} onEliminar={() => void borrar(pago)} onVerSocio={() => verPagosDe(pago)} onEnviar={() => void enviarComprobante(pago)} enviando={enviandoId === pago.id} porApi={sale_por_api(pago)} />
              </div>
            </div>
          )}
        </>
      )}

      {conLink && (
        <LinkPagoDialog socios={socios} boletas={boletasPendientes} comite={comite} modo={mpModo} onCerrar={() => setConLink(false)} />
      )}

      {dialogo}
      {corrigiendo && <EditarPagoDialog key={corrigiendo.id} pago={corrigiendo} onCerrar={() => setCorrigiendo(null)} />}

      {registrando && (
        <NuevoPagoDialog
          socios={socios}
          todosLosSocios={todosLosSocios}
          costoReconexion={costoReconexion}
          boletas={boletasPendientes}
          comite={comite}
          onCerrar={() => setRegistrando(false)}
        />
      )}
    </div>
  );
}
