"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  Building2,
  Check,
  CheckCircle2,
  Ellipsis,
  FileDown,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Store,
  X,
  type LucideIcon,
} from "lucide-react";
import { registrarCobro, registrarPago } from "@/app/panel/boletas/actions";
import { formatearPeriodo, saldo } from "@/lib/boletas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { BoletaParaPago } from "@/components/panel/pago-dialog";
import { MEDIOS_PAGO, textoConcepto, textoMedioPago, type ConceptoCobro } from "@/lib/pagos";
import type { OpcionSocio } from "@/components/panel/socio-buscador";
import { formatearRut, iniciales, normalizarTelefono } from "@/lib/formato";
import {
  enlaceWhatsApp,
  mensajeComprobanteCobro,
  mensajeComprobantePago,
  primerNombre,
  telefonoValidoParaWhatsApp,
  type DatosComiteWhatsApp,
} from "@/lib/whatsapp";
import { avisarCambio } from "@/lib/avisos-datos";

export type BoletaPendiente = BoletaParaPago & { socioId: string };

type Tipo = "BOLETA" | ConceptoCobro;
type Filtro = "deuda" | "dia" | "todos";

const TIPOS: { id: Tipo; nombre: string }[] = [
  { id: "BOLETA", nombre: "Boleta" },
  { id: "RECONEXION", nombre: "Reposición" },
  { id: "REPARACION", nombre: "Reparación" },
  { id: "OTRO", nombre: "Otro cobro" },
];

const ICONO_MEDIO: Record<string, LucideIcon> = {
  EFECTIVO: Banknote,
  TRANSFERENCIA: Building2,
  CAJA_VECINA: Store,
  OTRO: Ellipsis,
};

const AYUDA_DETALLE: Record<ConceptoCobro, string> = {
  RECONEXION: "Reposición del servicio tras corte",
  REPARACION: "Cambio de llave de paso",
  OTRO: "Qué se está cobrando",
};

const GRIS = "text-[#5B5970]";
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const fechaCorta = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}`;
};
const fechaCL = (iso: string) => iso.split("-").reverse().join("-");

const CAMPO = "h-11 rounded-xl border-[#E4E1F0] bg-white shadow-none";

type Cuenta = OpcionSocio & { pendientes: BoletaPendiente[]; deuda: number; vencidas: number };

type Resultado = {
  socioNombre: string;
  telefono: string | null;
  consentimiento: boolean;
  total: number;
  medio: string;
  fecha: string;
  pagadoPor: string | null;
  pagadoPorTelefono: string | null;
  /** Lo que queda por pagar de las boletas, si el pago fue parcial. */
  saldo: number;
  pagos: { titulo: string; periodo: string | null; monto: number; montoPagado: number; montoTotal: number; comprobanteUrl: string }[];
  concepto: Tipo;
  detalle: string | null;
};

/**
 * Registrar un pago sin pasar por Boletas, en dos pasos: elegir al socio (con quién debe y cuánto) y decir qué paga y cómo.
 * Varias boletas se pagan de una vez: el monto se reparte desde la más antigua.
 */
export function NuevoPagoDialog({
  socios,
  todosLosSocios,
  costoReconexion,
  boletas,
  comite,
  onCerrar,
}: {
  /** Los que tienen boletas con saldo: solo ellos pueden pagar una boleta. */
  socios: OpcionSocio[];
  /** Todos los socios: cualquiera puede pagar una reposición, una reparación u otro cobro. */
  todosLosSocios: OpcionSocio[];
  costoReconexion: number | null;
  boletas: BoletaPendiente[];
  comite: DatosComiteWhatsApp;
  onCerrar: () => void;
}) {
  const [hoyFecha] = useState(() => new Date());
  const hoy = hoyFecha.toISOString().slice(0, 10);

  const [tipo, setTipo] = useState<Tipo>("BOLETA");
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("deuda");
  const [socioId, setSocioId] = useState<string | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [fecha, setFecha] = useState(hoy);
  const [medio, setMedio] = useState<string>("EFECTIVO");
  const [referencia, setReferencia] = useState("");
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [otraPersona, setOtraPersona] = useState(false);
  const [pagador, setPagador] = useState("");
  const [telPagador, setTelPagador] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pendiente, iniciar] = useTransition();

  // Cada cuenta con lo que debe: la boleta más reciente primero, como se lee en la lista.
  const cuentas = useMemo(() => {
    const porSocio = new Map<string, BoletaPendiente[]>();
    for (const b of boletas) porSocio.set(b.socioId, [...(porSocio.get(b.socioId) ?? []), b]);
    const base = new Map<string, OpcionSocio>();
    for (const s of todosLosSocios) base.set(s.id, s);
    for (const s of socios) if (!base.has(s.id)) base.set(s.id, s);
    return [...base.values()].map<Cuenta>((s) => {
      const pendientes = (porSocio.get(s.id) ?? []).sort((a, b) => b.periodo.localeCompare(a.periodo));
      return {
        ...s,
        pendientes,
        deuda: pendientes.reduce((t, b) => t + saldo(b.montoTotal, b.montoPagado), 0),
        vencidas: pendientes.filter((b) => b.vence && b.vence.slice(0, 10) < hoy).length,
      };
    });
  }, [boletas, socios, todosLosSocios, hoy]);

  const conDeuda = cuentas.filter((c) => c.deuda > 0).length;
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.\-]/g, "");
    return cuentas
      .filter((c) => filtro === "todos" || (filtro === "deuda" ? c.deuda > 0 : c.deuda === 0))
      .filter((c) => !t || `${c.nombre} ${c.rut ?? ""} ${c.numeroCliente ?? ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.\-]/g, "").includes(t))
      .sort((a, z) => z.vencidas - a.vencidas || z.deuda - a.deuda || a.nombre.localeCompare(z.nombre));
  }, [cuentas, filtro, q]);

  const socio = cuentas.find((c) => c.id === socioId) ?? null;
  const esBoleta = tipo === "BOLETA";
  const elegidas = socio ? socio.pendientes.filter((b) => marcadas.includes(b.id)) : [];
  const total = elegidas.reduce((t, b) => t + saldo(b.montoTotal, b.montoPagado), 0);
  const recibido = esBoleta ? (monto ? Number(monto) : total) : Number(monto || 0);
  const parcial = esBoleta && recibido > 0 && recibido < total;
  const excede = esBoleta && recibido > total;
  const valido =
    Boolean(socio) &&
    recibido > 0 &&
    !excede &&
    (esBoleta ? elegidas.length > 0 : tipo !== "OTRO" || detalle.trim().length > 0) &&
    fecha <= hoy &&
    !pendiente;

  function reiniciar() {
    setSocioId(null);
    setQ("");
    setMarcadas([]);
    setMonto("");
    setDetalle("");
    setReferencia("");
    setFecha(hoy);
    setOtraPersona(false);
    setPagador("");
    setTelPagador("");
    setError(null);
    setResultado(null);
    setFiltro(tipo === "BOLETA" ? "deuda" : "todos");
  }

  function elegir(c: Cuenta) {
    setSocioId(c.id);
    setMarcadas(c.pendientes.map((b) => b.id));
    setMonto(tipo === "RECONEXION" && costoReconexion ? String(costoReconexion) : "");
    setError(null);
  }

  function cambiarTipo(t: Tipo) {
    setTipo(t);
    setError(null);
    setMonto(t === "RECONEXION" && costoReconexion ? String(costoReconexion) : "");
    setDetalle("");
    if (socio) setMarcadas(socio.pendientes.map((b) => b.id));
    if (!socio) setFiltro(t === "BOLETA" ? "deuda" : "todos");
  }

  function registrar() {
    if (!socio) return;
    iniciar(async () => {
      setError(null);
      const comun = {
        fecha,
        medio,
        referencia: referencia.trim() || undefined,
        pagadoPor: otraPersona ? pagador.trim() || undefined : undefined,
        pagadoPorTelefono: otraPersona ? telPagador.trim() || undefined : undefined,
      };
      const base = {
        socioNombre: socio.nombre,
        telefono: socio.telefono ?? null,
        consentimiento: false,
        medio,
        fecha,
        pagadoPor: otraPersona ? pagador.trim() || null : null,
        pagadoPorTelefono: otraPersona && telPagador.trim() ? normalizarTelefono(telPagador.trim()) : null,
        concepto: tipo,
      };

      if (!esBoleta) {
        const r = await registrarCobro(socio.id, {
          concepto: tipo,
          monto: recibido,
          descripcion: detalle.trim() || undefined,
          ...comun,
        });
        if (!r.ok) {
          setError(r.error);
          toast.error(r.error);
          return;
        }
        toast.success("Pago registrado");
        avisarCambio("caja", "pagos");
        setResultado({
          ...base,
          total: recibido,
          saldo: 0,
          detalle: detalle.trim() || null,
          pagos: [{ titulo: textoConcepto(tipo), periodo: null, monto: recibido, montoPagado: recibido, montoTotal: recibido, comprobanteUrl: r.comprobanteUrl }],
        });
        return;
      }

      // El monto se reparte desde la boleta más antigua: así se salda primero lo que lleva más tiempo debiéndose.
      const orden = [...elegidas].sort((a, b) => a.periodo.localeCompare(b.periodo));
      let resto = recibido;
      const hechos: Resultado["pagos"] = [];
      let falla: string | null = null;
      for (const b of orden) {
        const porcion = Math.min(resto, saldo(b.montoTotal, b.montoPagado));
        if (porcion <= 0) break;
        const r = await registrarPago(b.id, { monto: porcion, ...comun });
        if (!r.ok) {
          falla = r.error;
          break;
        }
        hechos.push({ titulo: formatearPeriodo(b.periodo), periodo: b.periodo, monto: porcion, montoPagado: r.montoPagado, montoTotal: r.montoTotal, comprobanteUrl: r.comprobanteUrl });
        resto -= porcion;
      }

      if (hechos.length > 0) avisarCambio("caja", "pagos");
      if (falla) {
        toast.error(hechos.length ? `Se registraron ${hechos.length} pago${hechos.length === 1 ? "" : "s"} y falló el siguiente: ${falla}` : falla);
        if (hechos.length === 0) {
          setError(falla);
          return;
        }
      } else {
        toast.success("Pago registrado");
      }
      const pagado = hechos.reduce((t, h) => t + h.monto, 0);
      setResultado({
        ...base,
        telefono: elegidas[0]?.socioTelefono ?? socio.telefono ?? null,
        consentimiento: Boolean(elegidas[0]?.socioConsentimiento),
        total: pagado,
        saldo: Math.max(0, total - pagado),
        detalle: null,
        pagos: hechos,
      });
    });
  }

  function enviarPorWhatsApp(r: Resultado, p: Resultado["pagos"][number]) {
    const destino = r.pagadoPorTelefono ?? r.telefono;
    if (!destino) return;
    const texto =
      r.concepto === "BOLETA" && p.periodo
        ? mensajeComprobantePago(comite.nombre, {
            socioNombre: r.socioNombre,
            periodo: p.periodo,
            monto: p.monto,
            montoTotal: p.montoTotal,
            montoPagado: p.montoPagado,
            comprobanteUrl: p.comprobanteUrl,
            pagadoPor: r.pagadoPor,
          })
        : mensajeComprobanteCobro(comite.nombre, {
            socioNombre: r.socioNombre,
            concepto: textoConcepto(r.concepto),
            descripcion: r.detalle,
            monto: p.monto,
            comprobanteUrl: p.comprobanteUrl,
            pagadoPor: r.pagadoPor,
          });
    window.open(enlaceWhatsApp(destino, texto), "_blank", "noopener");
  }

  const PIE = "flex items-center gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-4 sm:px-6";

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex h-[94dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:h-[min(760px,92vh)] sm:w-[640px] sm:max-w-[640px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0"
      >
        {resultado ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-8 text-center">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#E6F6EF] text-[#0A7A52]">
                <Check className="size-7" strokeWidth={2.5} />
              </span>
              <DialogTitle className="mt-4 text-xl font-semibold">Pago registrado</DialogTitle>
              <p className={cn("mt-1 text-[15px]", GRIS)}>
                {clp(resultado.total)} de {resultado.socioNombre} · {textoMedioPago(resultado.medio)} · {fechaCL(resultado.fecha)}
              </p>
              {resultado.saldo > 0 ? (
                <p className="mt-2 rounded-lg bg-[#FFF3E0] px-3 py-1.5 text-[13px] text-[#7A4A00]">Queda un saldo de {clp(resultado.saldo)}</p>
              ) : null}

              <ul className="mt-6 w-full max-w-[440px] divide-y divide-[#F3F1F8] overflow-hidden rounded-xl border border-[#EFEDF6] text-left">
                {resultado.pagos.map((p) => {
                  const destino = resultado.pagadoPorTelefono ?? resultado.telefono;
                  const automatico =
                    Boolean(comite.comprobanteAutomatico) &&
                    resultado.concepto === "BOLETA" &&
                    resultado.consentimiento &&
                    telefonoValidoParaWhatsApp(resultado.telefono) &&
                    !resultado.pagadoPorTelefono;
                  return (
                    <li key={p.comprobanteUrl} className="flex items-center gap-3 px-3.5 py-3">
                      <CheckCircle2 className="size-[18px] shrink-0 text-[#2FB386]" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.titulo}</span>
                        <span className={cn("block text-xs tabular-nums", GRIS)}>{clp(p.monto)}</span>
                      </span>
                      {automatico ? (
                        <span className={cn("text-xs", GRIS)}>Le llega por WhatsApp</span>
                      ) : telefonoValidoParaWhatsApp(destino) ? (
                        <button
                          type="button"
                          onClick={() => enviarPorWhatsApp(resultado, p)}
                          aria-label={`Enviar el comprobante de ${p.titulo} por WhatsApp`}
                          className="flex size-9 items-center justify-center rounded-lg text-[#2A07A8] hover:bg-[#F4F1FF]"
                        >
                          <MessageCircle className="size-[18px]" />
                        </button>
                      ) : null}
                      <a
                        href={p.comprobanteUrl}
                        target="_blank"
                        rel="noopener"
                        aria-label={`Ver el comprobante de ${p.titulo}`}
                        className="flex size-9 items-center justify-center rounded-lg text-[#2A07A8] hover:bg-[#F4F1FF]"
                      >
                        <FileDown className="size-[18px]" />
                      </a>
                    </li>
                  );
                })}
              </ul>
              {resultado.pagos.length > 0 && !telefonoValidoParaWhatsApp(resultado.pagadoPorTelefono ?? resultado.telefono) ? (
                <p className={cn("mt-3 text-xs", GRIS)}>{primerNombre(resultado.socioNombre)} no tiene un teléfono válido para WhatsApp.</p>
              ) : null}
            </div>
            <div className={cn(PIE, "justify-end")}>
              <Button variant="outline" onClick={onCerrar} className="h-11 rounded-xl border-[#E4E1F0] bg-white font-semibold">
                Listo
              </Button>
              <Button onClick={reiniciar} className="h-11 rounded-xl px-5 font-semibold">
                <Plus className="size-4" />
                Registrar otro
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Encabezado */}
            <div className="border-b border-[#F0EEF6] px-5 pt-5 pb-4 sm:px-6">
              <div className="flex items-start gap-3">
                {socio ? (
                  <Button variant="ghost" size="icon" aria-label="Volver a la lista" onClick={() => setSocioId(null)} className="-ml-2 size-9 shrink-0 rounded-lg">
                    <ArrowLeft className="size-[18px]" />
                  </Button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-lg leading-tight font-semibold">Registrar pago</DialogTitle>
                  <p className={cn("mt-0.5 text-[13px]", GRIS)}>{socio ? "Paso 2 de 2 · Qué paga y cómo" : "Paso 1 de 2 · Elige al socio"}</p>
                </div>
                <DialogClose aria-label="Cerrar" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
                  <X className="size-[18px]" />
                </DialogClose>
              </div>
              <div role="radiogroup" aria-label="Qué está pagando" className="mt-4 grid grid-cols-4 gap-1 rounded-lg bg-[#F4F3F9] p-1">
                {TIPOS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={tipo === t.id}
                    onClick={() => cambiarTipo(t.id)}
                    className={cn("h-8 truncate rounded-md px-1 text-[13px] font-semibold", tipo === t.id ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}
                  >
                    {t.nombre}
                  </button>
                ))}
              </div>
            </div>

            {!socio ? (
              /* Paso 1 */
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex flex-col gap-3 px-5 pt-4 sm:px-6">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8A8799]" aria-hidden />
                    <Input autoFocus aria-label="Buscar socio" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, RUT o N.º de arranque" className={cn(CAMPO, "pl-9")} />
                  </div>
                  <div className="flex gap-2">
                    {(
                      [
                        ["deuda", "Con deuda", conDeuda],
                        ["dia", "Al día", cuentas.length - conDeuda],
                        ["todos", "Todos", cuentas.length],
                      ] as const
                    ).map(([k, t, n]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setFiltro(k)}
                        aria-pressed={filtro === k}
                        className={cn(
                          "h-8 rounded-full border px-3 text-[13px] font-medium",
                          filtro === k ? "border-[#3A0CE3] bg-[#F4F1FF] text-[#2A07A8]" : "border-[#E4E1F0] text-[#46435C] hover:bg-[#F8F7FC]"
                        )}
                      >
                        {t} <span className="text-xs opacity-70">{n}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-4">
                  {lista.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => elegir(c)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-[#F8F7FC] focus-visible:bg-[#F4F1FF] focus-visible:outline-none"
                      >
                        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F1EEFD] text-xs font-bold text-[#2A07A8]">
                          {iniciales(c.nombre)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{c.nombre}</span>
                          <span className={cn("block truncate text-xs", GRIS)}>
                            {[c.rut ? formatearRut(c.rut) : "Sin RUT", c.numeroCliente ? `N.º ${c.numeroCliente}` : null].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {c.deuda > 0 ? (
                          <span className="text-right">
                            <span className="block text-sm font-semibold tabular-nums">{clp(c.deuda)}</span>
                            <span className={cn("block text-xs font-medium", c.vencidas ? "text-[#A32020]" : "text-[#8A4B00]")}>
                              {c.pendientes.length} boleta{c.pendientes.length === 1 ? "" : "s"}
                              {c.vencidas
                                ? ` · ${c.vencidas} vencida${c.vencidas === 1 ? "" : "s"}`
                                : c.pendientes[0]?.vence
                                  ? ` · vence ${fechaCorta(c.pendientes[0].vence)}`
                                  : ""}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#075A3C]">
                            <CheckCircle2 className="size-3.5" aria-hidden />
                            Al día
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                  {lista.length === 0 ? <li className={cn("px-4 py-12 text-center text-sm", GRIS)}>Ningún socio coincide con la búsqueda.</li> : null}
                </ul>
              </div>
            ) : (
              /* Paso 2 */
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3 rounded-xl bg-[#F8F7FC] px-3 py-2.5">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#2A07A8] shadow-sm">
                    {iniciales(socio.nombre)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{socio.nombre}</span>
                    <span className={cn("block truncate text-xs", GRIS)}>
                      {[socio.rut ? formatearRut(socio.rut) : "Sin RUT", socio.numeroCliente ? `N.º ${socio.numeroCliente}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <button type="button" onClick={() => setSocioId(null)} className="text-[13px] font-semibold text-[#2A07A8] hover:underline">
                    Cambiar
                  </button>
                </div>

                {esBoleta ? (
                  <section className="mt-6">
                    <p className="text-[13px] font-semibold">Boletas a pagar</p>
                    {socio.pendientes.length ? (
                      <ul className="mt-2 divide-y divide-[#F3F1F8] overflow-hidden rounded-xl border border-[#EFEDF6]">
                        {socio.pendientes.map((b) => {
                          const on = marcadas.includes(b.id);
                          const vencida = Boolean(b.vence && b.vence.slice(0, 10) < hoy);
                          return (
                            <li key={b.id}>
                              <label className={cn("flex cursor-pointer items-center gap-3 px-3.5 py-3", on && "bg-[#FAF8FF]")}>
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => {
                                    setMonto("");
                                    setMarcadas((m) => (on ? m.filter((y) => y !== b.id) : [...m, b.id]));
                                  }}
                                  className="size-[18px] rounded accent-[#3A0CE3]"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-semibold">{formatearPeriodo(b.periodo)}</span>
                                  {b.vence ? (
                                    <span className={cn("block text-xs", vencida ? "text-[#A32020]" : GRIS)}>
                                      {vencida ? "Venció" : "Vence"} el {fechaCorta(b.vence)}
                                    </span>
                                  ) : null}
                                </span>
                                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", vencida ? "bg-[#FDEFEF] text-[#A32020]" : "bg-[#FFF3E0] text-[#8A4B00]")}>
                                  {vencida ? "Vencida" : "Pendiente"}
                                </span>
                                <span className="w-[72px] text-right text-sm font-semibold tabular-nums">{clp(saldo(b.montoTotal, b.montoPagado))}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 flex items-center gap-2 rounded-xl bg-[#F3FBF7] px-3.5 py-3 text-sm text-[#075A3C]">
                        <CheckCircle2 className="size-4" aria-hidden />
                        Este socio no tiene boletas pendientes.
                      </p>
                    )}
                  </section>
                ) : (
                  <section className="mt-6 grid gap-3 sm:grid-cols-[1fr_160px]">
                    <label className="block">
                      <span className="text-[13px] font-semibold">Detalle{tipo === "OTRO" ? "" : " (opcional)"}</span>
                      <Input value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder={AYUDA_DETALLE[tipo]} maxLength={200} className={cn(CAMPO, "mt-2")} />
                    </label>
                    <label className="block">
                      <span className="text-[13px] font-semibold">Monto</span>
                      <Input
                        inputMode="numeric"
                        value={monto ? clp(Number(monto)) : ""}
                        onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").slice(0, 9))}
                        placeholder="$0"
                        className={cn(CAMPO, "mt-2 text-right font-semibold tabular-nums")}
                      />
                    </label>
                  </section>
                )}

                <section className="mt-6">
                  <p className="text-[13px] font-semibold">Datos del pago</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {MEDIOS_PAGO.map((m) => {
                      const Icono = ICONO_MEDIO[m.valor] ?? Ellipsis;
                      return (
                        <button
                          key={m.valor}
                          type="button"
                          onClick={() => setMedio(m.valor)}
                          aria-pressed={medio === m.valor}
                          className={cn(
                            "flex h-11 items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold",
                            medio === m.valor ? "border-[#3A0CE3] bg-[#F4F1FF] text-[#2A07A8]" : "border-[#E4E1F0] text-[#46435C] hover:bg-[#F8F7FC]"
                          )}
                        >
                          <Icono className="size-4" aria-hidden />
                          {m.texto}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={cn("text-xs font-medium", GRIS)}>Fecha del pago</span>
                      <div className="mt-1 flex gap-2">
                        <Input type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={cn(CAMPO, "min-w-0 flex-1")} />
                        <button
                          type="button"
                          onClick={() => setFecha(hoy)}
                          className={cn("h-11 shrink-0 rounded-xl border px-3 text-xs font-semibold", fecha === hoy ? "border-[#3A0CE3] bg-[#F4F1FF] text-[#2A07A8]" : "border-[#E4E1F0] text-[#46435C]")}
                        >
                          Hoy
                        </button>
                      </div>
                    </label>
                    {esBoleta ? (
                      <label className="block">
                        <span className={cn("text-xs font-medium", GRIS)}>Monto recibido</span>
                        <Input
                          inputMode="numeric"
                          value={clp(recibido)}
                          onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").slice(0, 9) || "0")}
                          aria-invalid={excede}
                          className={cn(CAMPO, "mt-1 text-right font-semibold tabular-nums", excede && "border-[#A32020]")}
                        />
                        {parcial ? <span className="mt-1 block text-[11px] text-[#8A4B00]">Queda un saldo de {clp(total - recibido)}</span> : null}
                        {excede ? <span className="mt-1 block text-[11px] text-[#A32020]">Máximo {clp(total)}</span> : null}
                      </label>
                    ) : null}
                    {medio !== "EFECTIVO" ? (
                      <label className="block">
                        <span className={cn("text-xs font-medium", GRIS)}>N.º de operación</span>
                        <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Opcional" maxLength={80} className={cn(CAMPO, "mt-1")} />
                      </label>
                    ) : null}
                  </div>

                  <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                    <input type="checkbox" checked={otraPersona} onChange={(e) => setOtraPersona(e.target.checked)} className="size-4 rounded accent-[#3A0CE3]" />
                    Pagó otra persona
                  </label>
                  {otraPersona ? (
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className={cn("text-xs font-medium", GRIS)}>Quién pagó</span>
                        <Input value={pagador} onChange={(e) => setPagador(e.target.value)} placeholder="Nombre" maxLength={120} className={cn(CAMPO, "mt-1")} />
                      </label>
                      <label className="block">
                        <span className={cn("text-xs font-medium", GRIS)}>Su teléfono</span>
                        <Input value={telPagador} onChange={(e) => setTelPagador(e.target.value)} placeholder="Opcional" maxLength={30} className={cn(CAMPO, "mt-1")} />
                      </label>
                    </div>
                  ) : null}
                </section>

                {error ? (
                  <p role="alert" className="mt-4 rounded-xl bg-[#FDECEC] px-3 py-2.5 text-sm font-medium text-[#A32020]">
                    {error}
                  </p>
                ) : null}
              </div>
            )}

            {/* Pie */}
            <div className={PIE}>
              {socio ? (
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs", GRIS)}>
                    {esBoleta ? `${elegidas.length} boleta${elegidas.length === 1 ? "" : "s"}` : "Total"}
                    {parcial ? " · pago parcial" : ""}
                  </p>
                  <p className="text-lg leading-tight font-semibold tabular-nums">{clp(recibido)}</p>
                </div>
              ) : (
                <span className="flex-1" />
              )}
              <DialogClose render={<Button variant="outline" className={cn("h-11 rounded-xl border-[#E4E1F0] bg-white font-semibold", socio && "hidden sm:inline-flex")} />}>Cancelar</DialogClose>
              {socio ? (
                <Button disabled={!valido} onClick={registrar} className="h-11 rounded-xl px-5 font-semibold">
                  {pendiente && <Loader2 className="animate-spin" />}
                  Registrar pago
                </Button>
              ) : null}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
