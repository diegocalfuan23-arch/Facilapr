"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Bell, Camera, Check, CheckCircle2, Eye, FileText, Hammer, Loader2, MessageCircle, Phone, Plus, Scissors, Search, X, Zap, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  cancelarOrden,
  darDeAlta,
  deudaDeArranque,
  pedirOtraEvidencia,
  registrarAvisoCorte,
  resolverSolicitud,
  type ResultadoOrden,
} from "@/app/panel/ordenes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatearRut, iniciales } from "@/lib/formato";
import { ESTADOS_ORDEN, TIPOS_ORDEN, type TipoCampo } from "@/lib/ordenes";
import type { MorosoFila, OrdenFila } from "@/lib/ordenes-datos";
import {
  enlaceWhatsApp,
  mensajeAvisoCorte,
  mensajeCorteRealizado,
  mensajeReanudacion,
  mensajeReposicion,
  mensajeRespuestaSolicitud,
  telefonoValidoParaWhatsApp,
  type DatosComiteWhatsApp,
} from "@/lib/whatsapp";
import { SituacionSocioDialog } from "@/components/panel/situacion-socio-dialog";
import { EvidenciaDialog } from "@/components/panel/evidencia-dialog";
import { NuevaOrdenDialog } from "@/components/panel/nueva-orden-dialog";
import { LaborDialog } from "@/components/panel/labor-dialog";
import { CamposLaborReparacion, datosDeLaborReparacion, laborReparacionInicial } from "@/components/panel/labor-reparacion-campos";
import type { Insumo } from "@/lib/inventario-comun";
import type { OpcionSocio } from "@/components/panel/socio-buscador";
import { useConfirmar } from "@/components/ui/confirmar";
import {
  RepactacionesPanel,
  type RepactacionFila,
  type SocioConDeuda,
} from "@/components/panel/repactaciones-panel";

const GRIS = "text-[#5B5970]";
const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const corta = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" });
const DIA_MS = 86_400_000;

type Pestana = "morosos" | "repactados" | "terreno" | "reponer" | "solicitudes" | "cortados" | "historial";

const PESTANAS: { id: Pestana; texto: string; ayuda: string }[] = [
  { id: "morosos", texto: "Morosos", ayuda: "Socios con boletas vencidas. Avisa antes de ordenar el corte." },
  { id: "repactados", texto: "Repactados", ayuda: "Socios con acuerdo de pago. No se cortan mientras estén al día." },
  { id: "terreno", texto: "En terreno", ayuda: "Órdenes que el operador aún no termina, o con foto por dar de alta." },
  { id: "reponer", texto: "Por reponer", ayuda: "Socios cortados que ya pagaron. Ordena la reposición." },
  { id: "solicitudes", texto: "Solicitudes", ayuda: "Pedidos de los socios desde su portal." },
  { id: "cortados", texto: "Cortados", ayuda: "Servicio suspendido. Se repone cuando paguen." },
  { id: "historial", texto: "Historial", ayuda: "Órdenes cerradas: hechas, rechazadas o canceladas." },
];

type Evento = { fecha: string; texto: string; icono: LucideIcon; tono?: "ok" | "warn" | "bad" };

type Caso = {
  clave: string;
  socioId: string;
  nombre: string;
  rut: string | null;
  direccion: string | null;
  telefono: string | null;
  deuda: number | null;
  /** «3 boletas · 94 días»: lo que acompaña a la deuda. */
  sub: string;
  tab: Pestana;
  moroso?: MorosoFila;
  orden?: OrdenFila;
  eventos: Evento[];
};

const ICONO_TIPO: Record<string, { icono: LucideIcon; tono: string }> = {
  CORTE: { icono: Scissors, tono: "bg-[#FDEFEF] text-[#B42318]" },
  REPOSICION: { icono: Zap, tono: "bg-[#E6F6EF] text-[#0A7A52]" },
  REPARACION: { icono: Hammer, tono: "bg-[#FFF0EA] text-[#B4441A]" },
};

/** Cómo va el aviso de un moroso: sin avisar, con el plazo corriendo o con el plazo cumplido. */
function estadoAviso(diasDesdeAviso: number | null, plazo: number) {
  if (diasDesdeAviso === null) return { k: "sin" as const, texto: "Sin avisar", chip: "bg-[#F1F0F5] text-[#5B5970]", quedan: 0 };
  const quedan = plazo - diasDesdeAviso;
  if (quedan <= 0) return { k: "vencido" as const, texto: "Plazo vencido", chip: "bg-[#FDEFEF] text-[#A32020]", quedan };
  return { k: "plazo" as const, texto: `Avisado · quedan ${quedan} ${quedan === 1 ? "día" : "días"}`, chip: "bg-[#FFF3E0] text-[#8A4B00]", quedan };
}

/** Si cortar ahora saltaría el aviso o el plazo, el mensaje a confirmar; null si está todo en regla. */
function avisoPendiente(diasDesdeAviso: number | null, plazo: number) {
  if (diasDesdeAviso === null) return "Todavía no le has avisado a este socio.";
  const quedan = plazo - diasDesdeAviso;
  if (quedan > 0) return `Aún le ${quedan === 1 ? "queda 1 día" : `quedan ${quedan} días`} de plazo después del aviso.`;
  return null;
}

const Chip = ({ clase, children }: { clase: string; children: React.ReactNode }) => (
  <span className={cn("inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", clase)}>{children}</span>
);

/**
 * Órdenes de terreno del comité, desde el aviso al moroso hasta la foto de respaldo. La directiva avisa y ordena el corte,
 * el operador (o el presidente) sube la foto del medidor y la directiva da de alta. Las reposiciones y reparaciones las
 * puede pedir también el operador, y aquí se aprueban.
 */
export function CortesPanel({
  ordenes,
  cortados,
  deudaCortados,
  ahora,
  morosos,
  acuerdosAlDia,
  conLabores,
  insumos,
  responsables,
  repactaciones,
  sociosConDeuda,
  socios,
  diasGracia,
  comite,
}: {
  /** El plan incluye Labores: una reparación aprobada puede convertirse en labor. */
  conLabores: boolean;
  insumos: Insumo[];
  responsables: string[];
  /** Los acuerdos de pago con socios morosos, y con quién se puede hacer uno nuevo. */
  repactaciones: RepactacionFila[];
  sociosConDeuda: SocioConDeuda[];
  ordenes: OrdenFila[];
  cortados: OrdenFila[];
  /** Lo que debe hoy cada arranque cortado: con 0, ya pagó y está por reponer. */
  deudaCortados: Record<string, number>;
  /** El instante en que se armó la pantalla (ms), para contar días sin leer el reloj al dibujar. */
  ahora: number;
  morosos: MorosoFila[];
  /** Cuántos socios tienen un acuerdo de pago al día: no se listan como morosos. */
  acuerdosAlDia: number;
  socios: OpcionSocio[];
  diasGracia: number;
  comite: DatosComiteWhatsApp & { diasAviso: number; costoReconexion: number | null };
}) {
  const { confirmar, dialogo } = useConfirmar();
  const [pestana, setPestana] = useState<Pestana>(morosos.length > 0 ? "morosos" : "terreno");
  const [q, setQ] = useState("");
  const [selClave, setSelClave] = useState<string | null>(null);
  const [hoja, setHoja] = useState(false);
  const [creando, setCreando] = useState(false);
  const [avisando, setAvisando] = useState<MorosoFila | null>(null);
  const [ordenPara, setOrdenPara] = useState<{ caso: Caso; tipo: TipoCampo } | null>(null);
  const [ejecutando, setEjecutando] = useState<OrdenFila | null>(null);
  const [viendo, setViendo] = useState<OrdenFila | null>(null);
  const [laborDe, setLaborDe] = useState<OrdenFila | null>(null);
  const [resolviendo, setResolviendo] = useState<{ orden: OrdenFila; aprobar: boolean } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const hace = (dias: number) => corta.format(new Date(ahora - dias * DIA_MS));
  const desde = (iso: string) => corta.format(new Date(iso));
  const diasDesde = (iso: string) => Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / DIA_MS));

  // ---- Los casos de cada pestaña, con su seguimiento
  const eventosMoroso = (m: MorosoFila): Evento[] => {
    const ev: Evento[] = [{ fecha: hace(m.diasVencida), texto: "Boleta más antigua vencida", icono: FileText }];
    if (m.diasDesdeAviso !== null) {
      ev.push({ fecha: hace(m.diasDesdeAviso), texto: `Aviso de corte · plazo ${comite.diasAviso} días`, icono: Bell, tono: "warn" });
      if (comite.diasAviso - m.diasDesdeAviso <= 0) ev.push({ fecha: hace(m.diasDesdeAviso - comite.diasAviso), texto: "Venció el plazo sin pago", icono: AlertTriangle, tono: "bad" });
    }
    if (m.acuerdoAtrasado) ev.push({ fecha: "Hoy", texto: `Acuerdo de pago atrasado ${clp.format(m.acuerdoAtrasado)}`, icono: AlertTriangle, tono: "bad" });
    return ev;
  };

  const eventosOrden = (o: OrdenFila): Evento[] => {
    const T = TIPOS_ORDEN[o.tipo].texto;
    const origen = o.origen === "SOCIO" ? "pedida por el socio" : o.origen === "TECNICO" ? "pedida por el operador" : "ordenada";
    const ev: Evento[] = [{ fecha: desde(o.creada), texto: `${T} ${origen}`, icono: ICONO_TIPO[o.tipo]?.icono ?? FileText }];
    if (o.laborNumero) ev.push({ fecha: "", texto: `Labor L-${o.laborNumero} creada para esta reparación`, icono: Hammer });
    if (o.ejecutada) {
      ev.push({
        fecha: desde(o.ejecutada),
        texto: o.estado === "POR_CONFIRMAR" ? "Foto subida · por dar de alta" : `${T} realizada${o.tieneFoto ? " · con foto" : ""}`,
        icono: o.estado === "POR_CONFIRMAR" ? Camera : CheckCircle2,
        tono: "ok",
      });
    }
    if (o.estado === "RECHAZADA") ev.push({ fecha: "", texto: "Solicitud rechazada", icono: X, tono: "bad" });
    if (o.estado === "CANCELADA") ev.push({ fecha: "", texto: "Orden cancelada", icono: X });
    return ev;
  };

  const deSocio = (o: OrdenFila) => ({ socioId: o.socioId, nombre: o.socioNombre, rut: o.socioRut, direccion: o.socioDireccion, telefono: o.socioTelefono });

  const casosMorosos: Caso[] = [...morosos]
    .sort((a, b) => {
      const orden = { vencido: 0, plazo: 1, sin: 2 };
      return orden[estadoAviso(a.diasDesdeAviso, comite.diasAviso).k] - orden[estadoAviso(b.diasDesdeAviso, comite.diasAviso).k] || b.deuda - a.deuda;
    })
    .map((m) => ({
      clave: `m-${m.socioId}`,
      socioId: m.socioId,
      nombre: m.nombre,
      rut: m.rut,
      direccion: m.direccion,
      telefono: m.telefono,
      deuda: m.deuda,
      sub: `${m.boletas} ${m.boletas === 1 ? "boleta" : "boletas"} · ${m.diasVencida} días`,
      tab: "morosos" as const,
      moroso: m,
      eventos: eventosMoroso(m),
    }));

  const casoDeOrden = (o: OrdenFila, tab: Pestana, deuda: number | null, sub: string): Caso => ({ clave: `o-${tab}-${o.id}`, ...deSocio(o), deuda, sub, tab, orden: o, eventos: eventosOrden(o) });

  const terreno = ordenes.filter((o) => o.estado === "EN_TRAMITE" || o.estado === "POR_CONFIRMAR");
  const solicitudes = ordenes.filter((o) => o.estado === "SOLICITADA");
  const historial = ordenes.filter((o) => ["COMPLETADA", "RECHAZADA", "CANCELADA"].includes(o.estado));
  const porReponer = cortados.filter((o) => (deudaCortados[o.socioId] ?? 0) === 0);
  const conDeuda = cortados.filter((o) => (deudaCortados[o.socioId] ?? 0) > 0);

  const casos: Record<Exclude<Pestana, "repactados">, Caso[]> = {
    morosos: casosMorosos,
    terreno: terreno.map((o) => casoDeOrden(o, "terreno", o.deudaAlOrdenar, TIPOS_ORDEN[o.tipo].texto)),
    reponer: porReponer.map((o) =>
      casoDeOrden(o, "reponer", 0, o.ejecutada ? `Cortado hace ${diasDesde(o.ejecutada)} días` : "Cortado")
    ),
    solicitudes: solicitudes.map((o) => casoDeOrden(o, "solicitudes", null, TIPOS_ORDEN[o.tipo].texto)),
    cortados: conDeuda.map((o) =>
      casoDeOrden(o, "cortados", deudaCortados[o.socioId] ?? 0, o.ejecutada ? `Cortado hace ${diasDesde(o.ejecutada)} días` : "Cortado")
    ),
    historial: historial.map((o) => casoDeOrden(o, "historial", null, ESTADOS_ORDEN[o.estado])),
  };

  const cuenta = (p: Pestana) => (p === "repactados" ? repactaciones.filter((r) => r.estado === "ACTIVA").length : casos[p].length);
  const listos = morosos.filter((m) => estadoAviso(m.diasDesdeAviso, comite.diasAviso).k === "vencido").length;
  const deudaMorosa = morosos.reduce((t, m) => t + m.deuda, 0);

  const buscado = q.trim().toLowerCase();
  const lista = pestana === "repactados" ? [] : casos[pestana].filter((c) => !buscado || `${c.nombre} ${c.rut ?? ""} ${c.direccion ?? ""}`.toLowerCase().includes(buscado));
  const sel = lista.find((c) => c.clave === selClave) ?? lista[0] ?? null;
  const conDetalle = pestana !== "repactados";
  const ayuda = PESTANAS.find((p) => p.id === pestana)?.ayuda ?? "";

  function ejecutar(accion: () => Promise<ResultadoOrden>, exito: string) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) toast.success(exito);
      else toast.error(r.error);
    });
  }

  function abrir(c: Caso) {
    setSelClave(c.clave);
    if (window.matchMedia("(max-width: 1023px)").matches) setHoja(true);
  }

  /** Abre WhatsApp con el mensaje ya escrito: solo falta tocar enviar. */
  function abrirWhatsapp(telefono: string | null, texto: string) {
    if (telefono) window.open(enlaceWhatsApp(telefono, texto), "_blank", "noopener");
  }

  async function ordenarCorteDe(c: Caso) {
    const m = c.moroso;
    if (!m) return;
    // No se prohíbe cortar sin plazo cumplido (decide la directiva), pero se pide confirmar.
    const advertencia = avisoPendiente(m.diasDesdeAviso, comite.diasAviso);
    if (advertencia && !(await confirmar({ titulo: "¿Ordenar el corte igual?", descripcion: advertencia, boton: "Ordenar corte" }))) return;
    setHoja(false);
    setOrdenPara({ caso: c, tipo: "CORTE" });
  }

  const BotonAvisar = ({ telefono, texto, etiqueta, grande }: { telefono: string | null; texto: string; etiqueta: string; grande?: boolean }) => (
    <Button
      variant="outline"
      disabled={!telefonoValidoParaWhatsApp(telefono)}
      title={telefonoValidoParaWhatsApp(telefono) ? undefined : "Este socio no tiene un teléfono válido para WhatsApp"}
      onClick={() => abrirWhatsapp(telefono, texto)}
      className={cn("rounded-lg border-[#E4E1F0] bg-white font-semibold", grande ? "h-11 w-full rounded-xl" : "h-9 px-3 text-[13px]")}
    >
      <MessageCircle className="size-4" />
      {etiqueta}
    </Button>
  );

  /** Las acciones de un caso: una sola en la lista y todas en el detalle. */
  const acciones = (c: Caso, grande = false): React.ReactNode => {
    const base = grande ? "h-11 w-full rounded-xl font-semibold" : "h-9 rounded-lg px-3 text-[13px] font-semibold";
    const contorno = `${base} border-[#E4E1F0] bg-white`;
    const m = c.moroso;
    const o = c.orden;

    if (c.tab === "morosos" && m) {
      const a = estadoAviso(m.diasDesdeAviso, comite.diasAviso);
      const ordenar = (primario: boolean) => (
        <Button key="ordenar" variant={primario ? "default" : "outline"} disabled={pendiente} onClick={() => ordenarCorteDe(c)} className={cn(primario ? `${base} bg-[#D92D20] hover:bg-[#D92D20]/90` : contorno)}>
          <Scissors className="size-4" />
          Ordenar corte
        </Button>
      );
      const avisar = (
        <Button key="avisar" variant="outline" disabled={pendiente} onClick={() => setAvisando(m)} className={contorno}>
          <Bell className="size-4" />
          {a.k === "sin" ? "Avisar" : "Volver a avisar"}
        </Button>
      );
      if (!grande) return a.k === "sin" ? avisar : ordenar(a.k === "vencido");
      return a.k === "sin" ? [avisar, ordenar(false)] : [ordenar(a.k === "vencido"), avisar];
    }
    if (c.tab === "terreno" && o) {
      return o.estado === "POR_CONFIRMAR" ? (
        [
          <Button key="alta" disabled={pendiente} onClick={() => ejecutar(() => darDeAlta(o.id), "Dada de alta")} className={base}>
            <Check className="size-4" />
            Dar de alta
          </Button>,
          <Button key="otra" variant="outline" disabled={pendiente} onClick={() => ejecutar(() => pedirOtraEvidencia(o.id), "Se pidió otra foto")} className={contorno}>
            Pedir otra foto
          </Button>,
        ]
      ) : (
        [
          ...(o.tipo === "REPARACION" && conLabores && !o.laborId
            ? [
                <Button key="labor" onClick={() => setLaborDe(o)} className={base}>
                  <Hammer className="size-4" />
                  Crear labor
                </Button>,
              ]
            : []),
          <Button key="evidencia" variant={o.tipo === "REPARACION" && conLabores && !o.laborId ? "outline" : "default"} onClick={() => setEjecutando(o)} className={o.tipo === "REPARACION" && conLabores && !o.laborId ? contorno : base}>
            <Camera className="size-4" />
            Subir evidencia
          </Button>,
          <Button key="cancelar" variant="outline" disabled={pendiente} onClick={() => ejecutar(() => cancelarOrden(o.id), "Orden cancelada")} className={contorno}>
            Cancelar
          </Button>,
        ]
      );
    }
    if (c.tab === "reponer") {
      return (
        <Button disabled={pendiente} onClick={() => setOrdenPara({ caso: c, tipo: "REPOSICION" })} className={`${base} bg-[#0A9B68] hover:bg-[#0A9B68]/90`}>
          <Zap className="size-4" />
          Ordenar reposición
        </Button>
      );
    }
    if (c.tab === "solicitudes" && o) {
      const aprobar = o.tipo === "RECLAMO" ? "Responder" : o.tipo === "BAJA" ? "Dar de baja" : o.tipo === "REANUDACION" ? "Reanudar" : "Aprobar";
      if (!grande) {
        return (
          <Button disabled={pendiente} onClick={() => setResolviendo({ orden: o, aprobar: true })} className={base}>
            {aprobar}
          </Button>
        );
      }
      return [
        <Button key="aprobar" disabled={pendiente} onClick={() => setResolviendo({ orden: o, aprobar: true })} className={base}>
          {aprobar}
        </Button>,
        <Button key="ver" variant="outline" onClick={() => setViendo(o)} className={contorno}>
          <Eye className="size-4" />
          Ver situación
        </Button>,
        <Button key="rechazar" variant="outline" disabled={pendiente} onClick={() => setResolviendo({ orden: o, aprobar: false })} className={contorno}>
          Rechazar
        </Button>,
      ];
    }
    if (c.tab === "cortados" && o) {
      const avisoCorte = <BotonAvisar key="avisar" telefono={c.telefono} etiqueta="Avisar corte" grande={grande} texto={mensajeCorteRealizado(comite, { socioNombre: c.nombre, deuda: o.deudaAlOrdenar, costoReconexion: comite.costoReconexion })} />;
      if (!grande) return avisoCorte;
      return [
        avisoCorte,
        <Button key="reponer" variant="outline" disabled={pendiente} onClick={() => setOrdenPara({ caso: c, tipo: "REPOSICION" })} className={contorno}>
          Ordenar reposición
        </Button>,
      ];
    }
    if (c.tab === "historial" && o) {
      if (o.tipo === "REPOSICION" && o.estado === "COMPLETADA" && o.origen !== "SOCIO")
        return <BotonAvisar telefono={c.telefono} etiqueta="Avisar reposición" grande={grande} texto={mensajeReposicion(comite, { socioNombre: c.nombre })} />;
      if (o.tipo === "REANUDACION" && o.estado === "COMPLETADA")
        return <BotonAvisar telefono={c.telefono} etiqueta="Avisar reanudación" grande={grande} texto={mensajeReanudacion(comite, { socioNombre: c.nombre })} />;
      if (o.origen === "SOCIO" && (o.estado === "COMPLETADA" || o.estado === "RECHAZADA"))
        return (
          <BotonAvisar
            telefono={c.telefono}
            etiqueta="Avisar respuesta"
            grande={grande}
            texto={mensajeRespuestaSolicitud(comite, { socioNombre: c.nombre, tipo: TIPOS_ORDEN[o.tipo].texto, aprobada: o.estado === "COMPLETADA", respuesta: o.nota })}
          />
        );
    }
    return null;
  };

  /** La columna «Estado» de cada fila. */
  const estado = (c: Caso): React.ReactNode => {
    const o = c.orden;
    if (c.tab === "morosos" && c.moroso) {
      const a = estadoAviso(c.moroso.diasDesdeAviso, comite.diasAviso);
      return (
        <span className="flex min-w-0 flex-col items-start gap-1">
          <Chip clase={a.chip}>{a.texto}</Chip>
          {a.k === "plazo" ? (
            <span className="h-1 w-full max-w-[150px] overflow-hidden rounded-full bg-[#F3E6D1]">
              <span className="block h-full rounded-full bg-[#E58200]" style={{ width: `${Math.min(100, ((c.moroso.diasDesdeAviso ?? 0) / comite.diasAviso) * 100)}%` }} />
            </span>
          ) : null}
          {a.k === "vencido" ? <span className={cn("text-[11px]", GRIS)}>Avisado hace {c.moroso.diasDesdeAviso} días</span> : null}
          {c.moroso.acuerdoAtrasado ? <span className="text-[11px] font-medium text-[#A32020]">Acuerdo atrasado</span> : null}
        </span>
      );
    }
    if (!o) return null;
    if (c.tab === "terreno")
      return (
        <span className="flex flex-col items-start gap-1">
          <Chip clase={o.estado === "POR_CONFIRMAR" ? "bg-[#E6F6EF] text-[#075A3C]" : "bg-[#E2F2FC] text-[#0A5F91]"}>{o.estado === "POR_CONFIRMAR" ? "Por dar de alta" : "Por hacer"}</Chip>
          <span className={cn("text-[11px]", GRIS)}>{o.laborNumero ? `Labor L-${o.laborNumero}` : o.ejecutada ? `Foto ${desde(o.ejecutada)}` : `Pedida ${desde(o.creada)}`}</span>
        </span>
      );
    if (c.tab === "reponer")
      return (
        <span className="flex flex-col items-start gap-1">
          <Chip clase="bg-[#E6F6EF] text-[#075A3C]">Ya pagó</Chip>
          <span className={cn("text-[11px]", GRIS)}>{c.sub}</span>
        </span>
      );
    if (c.tab === "solicitudes")
      return (
        <span className="flex flex-col items-start gap-1">
          <Chip clase="bg-[#ECE8FD] text-[#2A07A8]">Nueva</Chip>
          <span className={cn("text-[11px]", GRIS)}>{o.origen === "SOCIO" ? "Del socio" : "Del operador"} · {desde(o.creada)}</span>
        </span>
      );
    if (c.tab === "cortados")
      return (
        <span className="flex flex-col items-start gap-1">
          <Chip clase="bg-[#FDEFEF] text-[#A32020]">Sin servicio</Chip>
          <span className={cn("text-[11px]", GRIS)}>{c.sub}</span>
        </span>
      );
    return (
      <span className="flex flex-col items-start gap-1">
        <Chip clase={o.estado === "COMPLETADA" ? "bg-[#E6F6EF] text-[#075A3C]" : "bg-[#F1F0F5] text-[#5B5970]"}>{ESTADOS_ORDEN[o.estado]}</Chip>
        <span className={cn("text-[11px]", GRIS)}>{desde(o.creada)}</span>
      </span>
    );
  };

  /** La columna de datos de cada fila: la deuda o, en órdenes, qué hay que hacer. */
  const dato = (c: Caso): React.ReactNode => {
    const o = c.orden;
    if (c.tab === "reponer") return <span className="text-[13px] font-semibold text-[#075A3C]">Deuda pagada</span>;
    if (o && (c.tab === "terreno" || c.tab === "solicitudes" || c.tab === "historial")) {
      const T = ICONO_TIPO[o.tipo];
      const I = T?.icono ?? FileText;
      return (
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold">
            <I className="size-3.5 shrink-0 text-[#5B5970]" aria-hidden />
            {TIPOS_ORDEN[o.tipo].texto}
          </span>
          {o.detalle ? <span className={cn("line-clamp-2 text-[11px]", GRIS)}>{o.detalle}</span> : null}
        </span>
      );
    }
    return (
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold text-[#B42318] tabular-nums">{clp.format(c.deuda ?? 0)}</span>
        <span className={cn("text-[11px]", GRIS)}>{c.sub}</span>
      </span>
    );
  };

  const colDato = pestana === "reponer" ? "Pago" : pestana === "solicitudes" || pestana === "historial" || pestana === "terreno" ? "Orden" : "Deuda";

  // ---- El detalle de un caso
  const detalle = (c: Caso, enHoja: boolean) => {
    const fotos = c.orden?.tieneFoto ? `/api/panel/ordenes/${c.orden.id}/foto` : null;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-start gap-3 px-5 pt-5 pb-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#ECE8FD] text-[13px] font-bold text-[#2A07A8]">{iniciales(c.nombre)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold">{c.nombre}</h2>
            <p className={cn("truncate text-[13px]", GRIS)}>{[c.rut ? formatearRut(c.rut) : null, c.direccion].filter(Boolean).join(" · ") || "Sin datos"}</p>
          </div>
          {enHoja ? (
            <Button type="button" variant="ghost" size="icon" aria-label="Cerrar" onClick={() => setHoja(false)} className="size-9 text-[#5B5970]">
              <X className="size-[18px]" />
            </Button>
          ) : null}
        </div>

        <dl className="mx-5 grid grid-cols-2 divide-x divide-[#F0EEF6] rounded-xl ring-1 ring-[#F0EEF6]">
          <div className="px-3.5 py-2.5">
            <dt className={cn("text-[11px]", GRIS)}>Deuda</dt>
            <dd className={cn("text-[17px] font-semibold tabular-nums", c.deuda ? "text-[#B42318]" : "text-[#075A3C]")}>{c.deuda ? clp.format(c.deuda) : c.deuda === 0 ? "Al día" : "—"}</dd>
          </div>
          <div className="px-3.5 py-2.5">
            <dt className={cn("text-[11px]", GRIS)}>{c.moroso ? "Boletas vencidas" : "Orden"}</dt>
            <dd className="truncate text-[17px] font-semibold tabular-nums">{c.moroso ? c.sub : c.orden ? TIPOS_ORDEN[c.orden.tipo].texto : "—"}</dd>
          </div>
        </dl>

        <div className="mx-5 mt-3 flex gap-2">
          <Button
            variant="outline"
            disabled={!telefonoValidoParaWhatsApp(c.telefono)}
            onClick={() => abrirWhatsapp(c.telefono, `Hola ${c.nombre.split(" ")[0]}, te escribe ${comite.nombre}.`)}
            className="h-9 flex-1 rounded-lg border-[#CDEFD9] bg-[#F2FBF5] text-[13px] font-semibold text-[#0A7A52] hover:bg-[#E6F6EF]"
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </Button>
          {c.telefono ? (
            <a href={`tel:${c.telefono.replace(/\s/g, "")}`} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-[#E4E1F0] bg-white text-[13px] font-semibold hover:bg-[#F8F7FC]">
              <Phone className="size-4" />
              Llamar
            </a>
          ) : (
            <span className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-[#E4E1F0] bg-white text-[13px] font-semibold opacity-50">
              <Phone className="size-4" />
              Sin teléfono
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-4">
          {c.orden?.detalle ? <p className="mb-4 rounded-xl bg-[#F8F7FC] px-3.5 py-2.5 text-[13px]">{c.orden.detalle}</p> : null}
          {c.orden?.nota ? (
            <p className="mb-4 rounded-xl bg-[#F8F7FC] px-3.5 py-2.5 text-[13px]">
              <span className="font-semibold">Nota del operador: </span>
              {c.orden.nota}
            </p>
          ) : null}
          {fotos ? (
            <a href={fotos} target="_blank" rel="noopener" className="mb-4 block overflow-hidden rounded-xl ring-1 ring-[#F0EEF6]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotos} alt="Evidencia" className="max-h-48 w-full object-cover" />
            </a>
          ) : null}
          <p className="text-[13px] font-semibold">Seguimiento</p>
          <ol className="mt-3">
            {c.eventos.map((e, i) => {
              const I = e.icono;
              return (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < c.eventos.length - 1 ? <span aria-hidden className="absolute top-7 left-[13px] h-[calc(100%-20px)] w-px bg-[#ECEAF4]" /> : null}
                  <span
                    aria-hidden
                    className={cn(
                      "relative flex size-[27px] shrink-0 items-center justify-center rounded-full",
                      e.tono === "ok" ? "bg-[#E6F6EF] text-[#0A7A52]" : e.tono === "bad" ? "bg-[#FDEFEF] text-[#B42318]" : e.tono === "warn" ? "bg-[#FFF3E0] text-[#B86400]" : "bg-[#F1F0F5] text-[#5B5970]"
                    )}
                  >
                    <I className="size-3.5" />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[14px] leading-snug font-medium">{e.texto}</p>
                    {e.fecha ? <p className={cn("text-xs", GRIS)}>{e.fecha}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3.5">{acciones(c, true)}</div>
      </div>
    );
  };

  const indicadores: [Pestana, string, string, string, string][] = [
    ["morosos", "Deuda morosa", clp.format(deudaMorosa), `${morosos.length} ${morosos.length === 1 ? "socio" : "socios"} con boletas vencidas`, "bg-[#B42318]"],
    ["morosos", "Listos para cortar", String(listos), listos ? "plazo de aviso vencido" : "nadie con plazo vencido", "bg-[#D92D20]"],
    ["terreno", "En terreno", String(terreno.length), "órdenes en curso", "bg-[#E58200]"],
    ["reponer", "Por reponer", String(porReponer.length), porReponer.length ? "pagaron y siguen sin agua" : "nadie pendiente", "bg-[#0A9B68]"],
  ];

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[28px]">Órdenes</h1>
          <p className={cn("mt-0.5 text-[15px]", GRIS)}>Cortes, reposiciones y reparaciones, desde el aviso hasta la foto de respaldo.</p>
        </div>
        <Button data-tour="cor-nueva" onClick={() => setCreando(true)} className="h-10 rounded-lg px-4 font-semibold">
          <Plus className="size-4" />
          Nueva orden
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores.map(([destino, titulo, valor, sub, punto]) => (
          <button key={titulo} type="button" onClick={() => setPestana(destino)} className={cn("rounded-2xl bg-white p-4 text-left transition-shadow hover:ring-1 hover:ring-[#E4DEFA] sm:p-5", SOMBRA)}>
            <p className={cn("flex items-center gap-2 text-[13px]", GRIS)}>
              <span aria-hidden className={cn("size-2 rounded-full", punto)} />
              {titulo}
            </p>
            <p className="mt-1 text-[24px] leading-tight font-semibold tabular-nums">{valor}</p>
            <p className={cn("mt-0.5 truncate text-xs", GRIS)}>{sub}</p>
          </button>
        ))}
      </div>

      <div className={cn("mt-4 grid items-start gap-4", conDetalle && "lg:grid-cols-[minmax(0,1fr)_350px]")}>
        <div className={cn("min-w-0 overflow-hidden rounded-2xl bg-white", SOMBRA)}>
          <div data-tour="cor-pestanas" className="border-b border-[#F0EEF6] px-4 pt-3 sm:px-5">
            <div className="sm:hidden">
              <select aria-label="Vista" value={pestana} onChange={(e) => setPestana(e.target.value as Pestana)} className="h-11 w-full rounded-xl border border-[#E4E1F0] bg-transparent px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {PESTANAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.texto} · {cuenta(p.id)}
                  </option>
                ))}
              </select>
            </div>
            <div role="tablist" className="-mb-px hidden flex-wrap gap-x-0.5 sm:flex">
              {PESTANAS.map((p) => {
                const on = pestana === p.id;
                const n = cuenta(p.id);
                return (
                  <button key={p.id} role="tab" aria-selected={on} onClick={() => setPestana(p.id)} className={cn("flex h-11 items-center gap-1.5 border-b-2 px-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors", on ? "border-[#3A0CE3] text-[#2A07A8]" : `border-transparent ${GRIS} hover:text-[#15132B]`)}>
                    {p.texto}
                    {n ? <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px]", on ? "bg-[#ECE8FD] text-[#2A07A8]" : p.id === "reponer" || p.id === "solicitudes" ? "bg-[#FFE7C2] text-[#8A4B00]" : "bg-[#F1F0F5] text-[#6E6B85]")}>{n}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {pestana === "repactados" ? (
            <div className="p-3 sm:p-5">
              <RepactacionesPanel repactaciones={repactaciones} sociosConDeuda={sociosConDeuda} comite={comite} />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                <p className={cn("min-w-0 flex-1 text-[13px]", GRIS)}>{ayuda}</p>
                <div className="relative sm:w-[220px]">
                  <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8B89A0]" />
                  <Input aria-label="Buscar socio" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, RUT o dirección" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
                </div>
              </div>

              {pestana === "morosos" && acuerdosAlDia > 0 ? (
                <p className="border-y border-[#F0EEF6] bg-[#FAFAFD] px-4 py-2.5 text-[13px] text-[#5B5970] sm:px-5">
                  {acuerdosAlDia === 1 ? "1 socio con acuerdo de pago al día no aparece" : `${acuerdosAlDia} socios con acuerdo de pago al día no aparecen`} aquí: mientras cumplan sus cuotas, no se les corta.
                </p>
              ) : null}

              <div className={cn("hidden grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_170px_150px] gap-4 border-y border-[#F3F1F8] bg-[#FAFAFD] px-5 py-2.5 text-xs font-medium md:grid", GRIS)}>
                <span>Socio</span>
                <span>{colDato}</span>
                <span>Estado</span>
                <span />
              </div>

              <ul className="divide-y divide-[#F3F1F8]">
                {lista.map((c) => {
                  const activo = sel?.clave === c.clave;
                  return (
                    <li key={c.clave} className={cn("relative", activo ? "bg-[#F7F5FF] lg:shadow-[inset_3px_0_0_#3A0CE3]" : "hover:bg-[#FBFAFF]")}>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-4 py-3.5 sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_170px_150px]">
                        <button type="button" onClick={() => abrir(c)} className="min-w-0 text-left after:absolute after:inset-0 after:content-[''] md:after:hidden">
                          <span className="block truncate text-[15px] font-semibold">{c.nombre}</span>
                          <span className={cn("block truncate text-[13px]", GRIS)}>{[c.rut ? formatearRut(c.rut) : null, c.direccion].filter(Boolean).join(" · ") || "Sin datos"}</span>
                        </button>
                        <span className="md:hidden">{c.tab === "morosos" || c.tab === "cortados" ? <span className="text-[15px] font-semibold text-[#B42318] tabular-nums">{clp.format(c.deuda ?? 0)}</span> : null}</span>
                        <button type="button" onClick={() => abrir(c)} className="hidden min-w-0 text-left md:block">
                          {dato(c)}
                        </button>
                        <button type="button" onClick={() => abrir(c)} className="col-start-1 min-w-0 text-left md:col-start-auto">
                          {estado(c)}
                        </button>
                        <span className="relative z-10 flex justify-end gap-1.5">{acciones(c)}</span>
                      </div>
                    </li>
                  );
                })}
                {lista.length === 0 ? (
                  <li className="px-6 py-14 text-center text-[0.9rem] text-muted-foreground">
                    {buscado
                      ? "Nadie coincide con la búsqueda."
                      : pestana === "morosos"
                        ? `Nadie tiene deuda vencida hace más de ${diasGracia} días (los días de gracia de Configuración → Cortes).`
                        : pestana === "terreno"
                          ? "No hay órdenes en terreno."
                          : pestana === "reponer"
                            ? "Nadie está esperando que le repongan el servicio."
                            : pestana === "solicitudes"
                              ? "No hay solicitudes por aprobar."
                              : pestana === "cortados"
                                ? "No hay arranques cortados con deuda."
                                : "Todavía no hay órdenes cerradas."}
                  </li>
                ) : null}
              </ul>
            </>
          )}
        </div>

        {conDetalle ? (
          <aside className={cn("sticky top-4 hidden h-[calc(100vh-32px)] max-h-[820px] min-h-[520px] overflow-hidden rounded-2xl bg-white lg:block", SOMBRA)}>
            {sel ? detalle(sel, false) : <div className={cn("flex h-full items-center justify-center p-8 text-center text-sm", GRIS)}>Elige un socio para ver su seguimiento.</div>}
          </aside>
        ) : null}
      </div>

      {pendiente && <Loader2 className="fixed bottom-6 left-6 size-5 animate-spin text-muted-foreground" />}

      {/* Detalle en el celular */}
      <Dialog open={hoja && !!sel} onOpenChange={setHoja}>
        <DialogContent showCloseButton={false} className="top-auto bottom-0 left-0 flex h-[90dvh] max-h-[90dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:p-0 lg:hidden">
          <DialogTitle className="sr-only">{sel?.nombre ?? "Socio"}</DialogTitle>
          <DialogDescription className="sr-only">Seguimiento y acciones</DialogDescription>
          {sel ? detalle(sel, true) : null}
        </DialogContent>
      </Dialog>

      {creando && (
        <NuevaOrdenDialog
          socios={socios}
          tipos={["CORTE", "REPOSICION", "REPARACION"] satisfies TipoCampo[]}
          titulo="Nueva orden"
          descripcion="El operador la recibe en su app."
          laborDe={conLabores ? { insumos, responsables } : undefined}
          onCerrar={() => setCreando(false)}
        />
      )}

      {ordenPara && (
        <NuevaOrdenDialog
          socios={socios}
          tipos={[ordenPara.tipo]}
          titulo={`Orden de ${TIPOS_ORDEN[ordenPara.tipo].texto.toLowerCase()}`}
          descripcion="El operador la recibe en su app."
          socioFijo={{ id: ordenPara.caso.socioId, nombre: ordenPara.caso.nombre, direccion: ordenPara.caso.direccion, deuda: ordenPara.caso.deuda }}
          detalleBase={
            ordenPara.tipo === "CORTE" && ordenPara.caso.moroso
              ? `Deuda de ${clp.format(ordenPara.caso.moroso.deuda)}, vencida hace ${ordenPara.caso.moroso.diasVencida} días.`
              : ordenPara.tipo === "REPOSICION"
                ? "Reposición del servicio."
                : undefined
          }
          onCerrar={() => setOrdenPara(null)}
        />
      )}

      {avisando && (
        <AvisoCorteDialog
          moroso={avisando}
          comite={comite}
          onCerrar={() => setAvisando(null)}
          onEnviar={(m) => {
            abrirWhatsapp(m.telefono, mensajeAvisoCorte(comite, { socioNombre: m.nombre, deuda: m.deuda, diasVencida: m.diasVencida, diasAviso: comite.diasAviso }));
            ejecutar(() => registrarAvisoCorte(m.socioId), "Aviso anotado");
            setAvisando(null);
          }}
        />
      )}

      {laborDe && (
        <LaborDialog
          labor={null}
          insumos={insumos}
          responsables={responsables}
          ordenInicial={{
            id: laborDe.id,
            titulo: `Reparación · ${laborDe.socioNombre}`,
            lugar: laborDe.socioDireccion,
            descripcion: laborDe.detalle,
          }}
          onCerrar={() => setLaborDe(null)}
        />
      )}

      {viendo && <SituacionSocioDialog ordenId={viendo.id} titulo={viendo.socioNombre} onCerrar={() => setViendo(null)} />}

      {dialogo}

      {resolviendo && <ResolverDialog orden={resolviendo.orden} aprobar={resolviendo.aprobar} laborDe={conLabores ? { insumos, responsables } : undefined} onCerrar={() => setResolviendo(null)} />}

      {ejecutando && (
        <EvidenciaDialog
          orden={{ id: ejecutando.id, tipo: ejecutando.tipo, socioNombre: ejecutando.socioNombre, direccion: ejecutando.socioDireccion }}
          onCerrar={() => setEjecutando(null)}
        />
      )}
    </div>
  );
}

/** El aviso de corte: se ve el mensaje tal como le llega al socio por WhatsApp y se abre el chat con él ya escrito. */
function AvisoCorteDialog({
  moroso,
  comite,
  onCerrar,
  onEnviar,
}: {
  moroso: MorosoFila;
  comite: DatosComiteWhatsApp & { diasAviso: number };
  onCerrar: () => void;
  onEnviar: (m: MorosoFila) => void;
}) {
  const valido = telefonoValidoParaWhatsApp(moroso.telefono);
  const texto = mensajeAvisoCorte(comite, { socioNombre: moroso.nombre, deuda: moroso.deuda, diasVencida: moroso.diasVencida, diasAviso: comite.diasAviso });
  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent showCloseButton={false} className="top-auto bottom-0 left-0 flex max-h-[92dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[90vh] sm:w-[520px] sm:max-w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0">
        <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3E0] text-[#B86400]">
            <Bell className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold">Aviso de corte</DialogTitle>
            <DialogDescription className={cn("mt-0.5 truncate text-[13px]", GRIS)}>
              {moroso.nombre} · debe {clp.format(moroso.deuda)}
            </DialogDescription>
          </div>
          <DialogClose aria-label="Cerrar" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
            <X className="size-[18px]" />
          </DialogClose>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Mensaje por WhatsApp</p>
            <div className="rounded-xl bg-[#EFEAE2] p-3">
              <div className="max-w-[94%] rounded-xl rounded-tl-sm bg-white px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line shadow-sm">{texto}</div>
            </div>
            <p className={cn("mt-1.5 text-xs", GRIS)}>
              Plazo para pagar: {comite.diasAviso} días. Se cambia en Configuración → Cortes.
            </p>
          </div>
          {!valido ? <p className="rounded-lg bg-[#FFF6E8] px-3 py-2 text-xs text-[#6B4300]">Este socio no tiene un teléfono válido para WhatsApp. Agrégalo en su ficha de Socios.</p> : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
          <Button type="button" variant="ghost" onClick={onCerrar} className="h-11 rounded-xl font-semibold text-[#46435C]">
            Cancelar
          </Button>
          <Button type="button" disabled={!valido} onClick={() => onEnviar(moroso)} className="h-11 rounded-xl px-5 font-semibold">
            <MessageCircle className="size-4" />
            Abrir WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Resolver una solicitud. En un reclamo la respuesta es obligatoria (el socio la
 * ve en su portal); en una baja, aprobarla deja el arranque inactivo; al
 * rechazar, el motivo es opcional pero también lo ve el socio.
 */
function ResolverDialog({
  orden,
  aprobar,
  laborDe,
  onCerrar,
}: {
  orden: OrdenFila;
  aprobar: boolean;
  /** Al aprobar una reparación se piden además los datos de su labor. */
  laborDe?: { insumos: Insumo[]; responsables: string[] };
  onCerrar: () => void;
}) {
  const [respuesta, setRespuesta] = useState("");
  const [labor, setLabor] = useState(laborReparacionInicial);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  // Solo para bajas: lo que debe hoy el arranque, y si la directiva ya lo vio.
  const [deuda, setDeuda] = useState<number | null>(null);
  const [confirmaDeuda, setConfirmaDeuda] = useState(false);

  const reclamo = orden.tipo === "RECLAMO";
  const baja = orden.tipo === "BAJA";
  const reanudacion = orden.tipo === "REANUDACION";
  useEffect(() => {
    if (orden.tipo !== "BAJA" || !aprobar) return;
    let vivo = true;
    deudaDeArranque(orden.socioId)
      .then((d) => vivo && setDeuda(d))
      .catch(() => vivo && setDeuda(0));
    return () => {
      vivo = false;
    };
  }, [orden.tipo, orden.socioId, aprobar]);

  const conDeuda = baja && aprobar && (deuda ?? 0) > 0;
  const pideTexto = reclamo || !aprobar || baja || reanudacion;

  const titulo = !aprobar
    ? `Rechazar ${TIPOS_ORDEN[orden.tipo].texto.toLowerCase()}`
    : reclamo
      ? "Responder el reclamo"
      : baja
        ? "Dar de baja el servicio"
        : reanudacion
          ? "Reanudar el servicio"
          : `Aprobar ${TIPOS_ORDEN[orden.tipo].texto.toLowerCase()}`;

  const descripcion = !aprobar
    ? "Si escribes un motivo, el socio lo ve en su portal."
    : reclamo
      ? "Tu respuesta le aparece al socio en su portal."
      : baja
        ? "El arranque queda inactivo y deja de aparecer en los cobros. Lo que debe hasta hoy no se borra."
        : reanudacion
          ? "El arranque vuelve a estar activo. Si hay que reconectarlo en terreno, ordena una reposición."
          : "Pasa a trámite: el operador (o el presidente) va a terreno y sube la foto.";

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {titulo} · {orden.socioNombre}
          </DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {orden.detalle && (
            <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-[0.86rem]">
              <span className="font-medium">El socio escribió: </span>
              {orden.detalle}
            </p>
          )}
          {pideTexto && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="respuesta-orden">
                {aprobar && reclamo ? "Respuesta" : "Mensaje para el socio (opcional)"}
              </Label>
              <Textarea
                id="respuesta-orden"
                rows={4}
                maxLength={500}
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {aprobar && orden.tipo === "REPARACION" && laborDe ? <CamposLaborReparacion valor={labor} onCambio={setLabor} insumos={laborDe.insumos} responsables={laborDe.responsables} /> : null}
          {conDeuda && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[0.84rem]">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={confirmaDeuda}
                onChange={(e) => setConfirmaDeuda(e.target.checked)}
              />
              <span>
                <span className="font-semibold text-destructive">
                  Este arranque debe {clp.format(deuda ?? 0)}.
                </span>{" "}
                Dar de baja no borra la deuda: queda pendiente de cobro. Confirmo que quiero darlo de baja igual.
              </span>
            </label>
          )}
          {error && <p className="text-[0.88rem] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            variant={!aprobar ? "destructive" : "default"}
            disabled={pendiente || (aprobar && reclamo && !respuesta.trim()) || (baja && aprobar && deuda === null) || (conDeuda && !confirmaDeuda)}
            onClick={() =>
              iniciar(async () => {
                setError(null);
                const r = await resolverSolicitud(orden.id, aprobar, respuesta, confirmaDeuda, aprobar && orden.tipo === "REPARACION" && laborDe ? datosDeLaborReparacion(labor) : undefined);
                if (r.ok) {
                  toast.success(aprobar ? "Listo" : "Solicitud rechazada");
                  onCerrar();
                } else {
                  setError(r.error);
                  toast.error(r.error);
                }
              })
            }
          >
            {pendiente && <Loader2 className="animate-spin" />}
            {!aprobar ? "Rechazar" : reclamo ? "Enviar respuesta" : baja ? "Dar de baja" : reanudacion ? "Reanudar" : "Aprobar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
