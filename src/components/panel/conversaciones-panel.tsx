"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Check, CheckCheck, ChevronDown, CreditCard, FileText, Hand, Info, Loader2, MessageCircle, Pencil, Phone, Search, SendHorizontal, Settings2, ShieldCheck, Sparkles, Trash2, X, Zap } from "lucide-react";
import { editarMensajeDirectiva, eliminarMensajeDirectiva, enviarMensajeDirectiva, marcarLeidoDirectiva, pausarIaConversacion } from "@/app/panel/conversaciones/actions";
import { fichaDelSocio, type FichaSocio } from "@/app/panel/conversaciones/ficha-actions";
import { escucharChat } from "@/lib/chat/cliente";
import type { MensajeChat } from "@/lib/chat-socio";
import { formatearRut, formatearTelefono, iniciales } from "@/lib/formato";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IndicadorEscribiendo } from "@/components/chat/burbuja";
import { IaChatDialog, estadoIa, type IaChatAjustes } from "@/components/panel/ia-chat-dialog";
import { useEscribiendo } from "@/components/chat/use-escribiendo";

export type ConversacionResumen = {
  socioId: string;
  nombre: string;
  ultimoMensaje: string;
  ultimaFecha: Date | null;
  sinLeer: number;
  /** La IA le pasó la conversación a una persona y nadie ha respondido. */
  necesitaHumano: boolean;
  rut: string | null;
  numeroCliente: string | null;
  tipo: "SOCIO" | "USUARIO";
  telefono: string | null;
  /** Lo que debe en total (CLP); 0 si está al día. */
  deuda: number;
  /** La IA está pausada solo en esta conversación. */
  iaPausada: boolean;
};

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const TONOS = ["bg-[#ECE8FD] text-[#2A07A8]", "bg-[#E3F3FD] text-[#0B5E94]", "bg-[#E6F6EF] text-[#075A3C]", "bg-[#FFF3E0] text-[#8A4B00]"];
const tono = (id: string) => TONOS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % TONOS.length];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesDe = (periodo: string) => MESES[Number(periodo.slice(5, 7)) - 1] ?? periodo;
const corto = (periodo: string) => mesDe(periodo).charAt(0).toUpperCase() + mesDe(periodo).slice(1, 3);
const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre;
const diaMes = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;

const DIA = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" });
const HORA = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Santiago" });

/** El día de un instante, como en la lista de WhatsApp: la hora si es de hoy, «Ayer» o el día y el mes. */
function cuando(f: Date) {
  const d = DIA.format(f);
  if (d === hoyEnChile()) return HORA.format(f);
  if (d === DIA.format(new Date(Date.now() - 86_400_000))) return "Ayer";
  return diaMes(d);
}

/** El separador de día dentro del chat: «Hoy», «Ayer» o el día y el mes. */
function etiquetaDia(d: string) {
  if (d === hoyEnChile()) return "Hoy";
  if (d === DIA.format(new Date(Date.now() - 86_400_000))) return "Ayer";
  return diaMes(d);
}

/** RUT · N.º de cliente · tipo, solo con lo que haya. */
function datosDelSocio(c: ConversacionResumen) {
  return [c.rut ? formatearRut(c.rut) : null, c.numeroCliente ? `N° ${c.numeroCliente}` : null, c.tipo === "USUARIO" ? "Usuario" : null].filter(Boolean).join(" · ");
}

/** Hay algo nuevo que mostrar: mensajes nuevos o mensajes que pasaron a leídos. */
function cambio(a: MensajeChat[], b: MensajeChat[]) {
  const marcas = (l: MensajeChat[]) => l.filter((m) => m.leido).length * 1000 + l.filter((m) => m.editado).length;
  return a.length !== b.length || marcas(a) !== marcas(b);
}

/** Agrega un mensaje solo si no está ya (el eco en vivo y la respuesta del envío pueden coincidir). */
function agregarSinRepetir(lista: MensajeChat[], m: MensajeChat) {
  return lista.some((x) => x.id === m.id) ? lista : [...lista, m];
}

function Avatar({ nombre, id, grande, ia }: { nombre: string; id: string; grande?: boolean; ia?: boolean }) {
  return (
    <span aria-hidden className={cn("relative flex shrink-0 items-center justify-center rounded-full font-bold", grande ? "size-12 text-sm" : "size-10 text-xs", tono(id))}>
      {iniciales(nombre)}
      {ia ? (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-[18px] items-center justify-center rounded-full bg-[#6B46F5] text-white ring-2 ring-white">
          <Sparkles className="size-2.5" />
        </span>
      ) : null}
    </span>
  );
}

/** Lo que se le sugiere escribir a quien atiende, según lo que debe el socio. */
function sugerenciaPara(c: ConversacionResumen, f: FichaSocio | null | undefined) {
  const p = primerNombre(c.nombre);
  if (c.deuda > 0 && f?.boleta && f.boleta.estado !== "Pagada") return `Hola ${p}, tu saldo es de ${clp(c.deuda)} y tu boleta vence el ${diaMes(f.boleta.vence)}. ¿Te envío el link de pago?`;
  if (c.deuda > 0) return `Hola ${p}, tu saldo pendiente es de ${clp(c.deuda)}. ¿Te envío el link de pago?`;
  return `Hola ${p}, ¿en qué te podemos ayudar?`;
}

/** El mensaje con el enlace para pagar: lleva a la cuenta en línea del socio, donde ve sus boletas y paga. */
function textoLinkPago(c: ConversacionResumen, f: FichaSocio | null | undefined) {
  const p = primerNombre(c.nombre);
  const saldo = c.deuda > 0 ? `tu saldo de ${clp(c.deuda)}` : "tus boletas";
  return f?.portal ? `Hola ${p}, puedes ver y pagar ${saldo} en línea desde tu cuenta: ${f.portal}` : `Hola ${p}, ${c.deuda > 0 ? `tu saldo es de ${clp(c.deuda)}` : "estás al día"}. ¿Te enviamos los datos para pagar?`;
}

export function ConversacionesPanel({ conversaciones, ia }: { conversaciones: ConversacionResumen[]; ia: IaChatAjustes }) {
  const [seleccionado, setSeleccionado] = useState<string | null>(conversaciones[0]?.socioId ?? null);
  // Qué conversaciones tienen la IA pausada; se mantiene aquí para no perderlo al cambiar de chat.
  const [iaPausadas, setIaPausadas] = useState<Record<string, boolean>>(() => Object.fromEntries(conversaciones.map((c) => [c.socioId, c.iaPausada])));
  // En pantallas angostas se ve una cosa a la vez: la lista o el chat abierto.
  const [verChat, setVerChat] = useState(false);
  // Se descuenta localmente al abrir un chat, sin esperar a recargar toda la lista.
  const [sinLeerLocal, setSinLeerLocal] = useState<Record<string, number>>(() => Object.fromEntries(conversaciones.map((c) => [c.socioId, c.sinLeer])));
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "leer" | "atencion">("todas");
  const [fichas, setFichas] = useState<Record<string, FichaSocio | null>>({});
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [ajustesIa, setAjustesIa] = useState(ia);
  const [configurando, setConfigurando] = useState(false);
  // Un texto que la ficha le pide al chat que ponga en la caja de escribir (el número cambia en cada pedido).
  const [insertar, setInsertar] = useState<{ n: number; texto: string } | null>(null);

  const iaActiva = ajustesIa.disponible && ajustesIa.modo !== "APAGADO";
  const estado = estadoIa(ajustesIa);
  const conIa = (id: string) => iaActiva && !(iaPausadas[id] ?? false);

  // La ficha del socio elegido se vuelve a pedir cada vez que se abre su chat.
  useEffect(() => {
    if (!seleccionado) return;
    let vivo = true;
    fichaDelSocio(seleccionado)
      .then((f) => vivo && setFichas((prev) => ({ ...prev, [seleccionado]: f })))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [seleccionado]);

  if (conversaciones.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Conversaciones</h1>
          <BotonAsistente estado={estado} onClick={() => setConfigurando(true)} />
        </div>
        <p className="mt-8 rounded-2xl border border-dashed border-border px-4 py-14 text-center text-[0.9rem] text-muted-foreground">Todavía no hay mensajes de ningún socio.</p>
        {configurando && <IaChatDialog ajustes={ajustesIa} onGuardado={setAjustesIa} onCerrar={() => setConfigurando(false)} />}
      </div>
    );
  }

  const q = busqueda.trim().toLowerCase();
  const sinLeer = conversaciones.filter((c) => (sinLeerLocal[c.socioId] ?? 0) > 0).length;
  const paraTi = conversaciones.filter((c) => c.necesitaHumano || !conIa(c.socioId)).length;
  const lista = conversaciones.filter((c) => {
    if (filtro === "leer" && !((sinLeerLocal[c.socioId] ?? 0) > 0)) return false;
    if (filtro === "atencion" && !(c.necesitaHumano || !conIa(c.socioId))) return false;
    return !q || `${c.nombre} ${c.numeroCliente ?? ""} ${c.rut ?? ""}`.toLowerCase().includes(q);
  });
  const socio = conversaciones.find((c) => c.socioId === seleccionado);

  const pedirLinkPago = () => {
    if (!socio) return;
    setInsertar({ n: (insertar?.n ?? 0) + 1, texto: textoLinkPago(socio, fichas[socio.socioId]) });
    setFichaAbierta(false);
    setVerChat(true);
  };

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col lg:h-[calc(100vh-7rem)]">
      <div className={cn("mb-4 items-end justify-between gap-3", verChat ? "hidden lg:flex" : "flex")}>
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Conversaciones</h1>
          <p className={cn("mt-0.5 hidden text-[15px] sm:block", GRIS)}>Mensajes de los socios desde su cuenta en línea. La IA responde lo simple y te pasa lo que necesita una persona.</p>
        </div>
        <BotonAsistente estado={estado} onClick={() => setConfigurando(true)} />
      </div>

      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl bg-card lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_300px]",
          verChat && "max-lg:fixed max-lg:inset-0 max-lg:z-30 max-lg:rounded-none",
          SOMBRA
        )}
      >
        {/* Lista */}
        <section aria-label="Conversaciones" data-tour="conv-lista" className={cn("min-h-0 flex-col border-r border-[#F0EEF6]", verChat ? "hidden lg:flex" : "flex")}>
          <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Buscar conversación" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, N° o RUT" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
            </div>
            <div role="tablist" aria-label="Filtro" className="grid grid-cols-3 gap-1 rounded-lg bg-[#F4F3F9] p-1">
              {(
                [
                  ["todas", "Todas", conversaciones.length],
                  ["leer", "Sin leer", sinLeer],
                  ["atencion", "Para ti", paraTi],
                ] as const
              ).map(([k, t, n]) => (
                <button key={k} type="button" role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)} className={cn("h-8 rounded-md text-[13px] font-semibold", filtro === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}>
                  {t} <span className={cn("text-xs font-medium", filtro === k ? "text-[#6B46F5]" : "text-[#A19FB2]")}>{n}</span>
                </button>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {lista.map((c) => {
              const activo = c.socioId === seleccionado;
              const noLeidos = sinLeerLocal[c.socioId] ?? 0;
              return (
                <li key={c.socioId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSeleccionado(c.socioId);
                      setVerChat(true);
                      setSinLeerLocal((prev) => ({ ...prev, [c.socioId]: 0 }));
                    }}
                    aria-current={activo ? "true" : undefined}
                    className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors", activo ? "bg-[#F1EEFD]" : "hover:bg-[#F8F7FC]")}
                  >
                    <Avatar nombre={c.nombre} id={c.socioId} ia={conIa(c.socioId)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={cn("min-w-0 flex-1 truncate text-sm", noLeidos ? "font-bold" : "font-semibold")}>{c.nombre}</span>
                        {c.ultimaFecha && <span className={cn("shrink-0 text-[11px]", noLeidos ? "font-semibold text-[#3A0CE3]" : GRIS)}>{cuando(new Date(c.ultimaFecha))}</span>}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={cn("min-w-0 flex-1 truncate text-[13px]", noLeidos ? "text-[#15132B]" : GRIS)}>{c.ultimoMensaje}</span>
                        {noLeidos > 0 && <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#3A0CE3] text-[11px] font-bold text-white">{noLeidos}</span>}
                      </span>
                      {c.necesitaHumano && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#FFF3E0] px-1.5 py-px text-[11px] font-semibold text-[#8A4B00]">
                          <Hand className="size-3" aria-hidden />
                          Necesita una persona
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
            {lista.length === 0 && <li className={cn("px-6 py-12 text-center text-sm", GRIS)}>No hay conversaciones con ese filtro.</li>}
          </ul>
          {iaActiva && (
            <p className={cn("flex items-center gap-1.5 border-t border-[#F0EEF6] px-4 py-2.5 text-[11px]", GRIS)}>
              <span aria-hidden className="flex size-3.5 items-center justify-center rounded-full bg-[#6B46F5] text-white">
                <Sparkles className="size-2" />
              </span>
              La IA atiende {conversaciones.filter((c) => conIa(c.socioId)).length} de {conversaciones.length} conversaciones
            </p>
          )}
        </section>

        {/* Chat */}
        <section aria-label={socio ? `Chat con ${socio.nombre}` : "Chat"} className={cn("min-h-0 flex-col bg-[#F7F6FB]", verChat ? "flex" : "hidden lg:flex")}>
          {socio ? (
            <ChatConSocio
              key={socio.socioId}
              socio={socio}
              ficha={fichas[socio.socioId]}
              iaActiva={iaActiva}
              iaPausada={iaPausadas[socio.socioId] ?? false}
              onIaPausada={(pausada) => setIaPausadas((prev) => ({ ...prev, [socio.socioId]: pausada }))}
              onVolver={() => setVerChat(false)}
              onFicha={() => setFichaAbierta(true)}
              insertar={insertar}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[0.9rem] text-muted-foreground">Elige una conversación</div>
          )}
        </section>

        {/* Ficha */}
        <aside className="hidden min-h-0 border-l border-[#F0EEF6] xl:block">{socio && <Ficha socio={socio} ficha={fichas[socio.socioId]} iaDisponible={ajustesIa.disponible} onLinkPago={pedirLinkPago} onConfigurar={() => setConfigurando(true)} />}</aside>
      </div>

      {fichaAbierta && socio && (
        <div className="fixed inset-0 z-40 xl:hidden" role="dialog" aria-modal="true" aria-label="Ficha del socio">
          <button type="button" aria-label="Cerrar" onClick={() => setFichaAbierta(false)} className="absolute inset-0 bg-[#15132B]/40" />
          <div className="absolute inset-x-0 bottom-0 h-[85vh] overflow-hidden rounded-t-2xl bg-white lg:inset-y-0 lg:right-0 lg:left-auto lg:h-full lg:w-[340px] lg:rounded-none">
            <Ficha socio={socio} ficha={fichas[socio.socioId]} iaDisponible={ajustesIa.disponible} onLinkPago={pedirLinkPago} onConfigurar={() => setConfigurando(true)} onCerrar={() => setFichaAbierta(false)} />
          </div>
        </div>
      )}

      {configurando && <IaChatDialog ajustes={ajustesIa} onGuardado={setAjustesIa} onCerrar={() => setConfigurando(false)} />}
    </div>
  );
}

/** El botón de la cabecera: dice si el asistente está activo y abre sus ajustes. */
function BotonAsistente({ estado, onClick }: { estado: { activa: boolean; texto: string }; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="h-10 shrink-0 rounded-lg border-[#E4E1F0] bg-white font-semibold">
      <Sparkles className="size-4 text-[#6B46F5]" />
      <span className="hidden sm:inline">Asistente IA</span>
      <span className={cn("rounded-full px-1.5 py-px text-[11px] font-semibold", estado.activa ? "bg-[#E6F6EF] text-[#075A3C]" : "bg-[#F1F0F6] text-[#5B5970]")}>{estado.texto}</span>
    </Button>
  );
}

/** Un mensaje: a la izquierda lo del socio; a la derecha lo de la IA (lila) y lo de la directiva (morado). */
function Burbuja({ m, primero, acciones }: { m: MensajeChat; primero: boolean; acciones?: React.ReactNode }) {
  const mio = m.remitente !== "SOCIO";
  const ia = m.remitente === "IA";
  const f = new Date(m.createdAt);
  return (
    <li className={cn("group flex", mio ? "justify-end" : "justify-start", primero ? "mt-3" : "mt-1")}>
      <div className={cn("flex max-w-[85%] flex-col sm:max-w-[68%]", mio ? "items-end" : "items-start")}>
        {primero && mio ? (
          <span className={cn("mb-1 inline-flex items-center gap-1 px-1 text-[11px] font-semibold", ia ? "text-[#6B46F5]" : GRIS)}>
            {ia ? (
              <>
                <Sparkles className="size-3" aria-hidden />
                Asistente IA
              </>
            ) : (
              "Tú · Administración"
            )}
          </span>
        ) : null}
        <div className="flex items-start gap-1">
          {acciones ? <span className="mt-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">{acciones}</span> : null}
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed",
              mio ? (ia ? "rounded-tr-md border border-[#E2DBFD] bg-[#F4F1FF] text-[#15132B]" : "rounded-tr-md bg-[#3A0CE3] text-white") : "rounded-tl-md bg-white text-[#15132B] shadow-[0_1px_2px_rgba(21,19,43,0.06)]"
            )}
          >
            <p className="break-words whitespace-pre-line">{m.contenido}</p>
            <span className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10.5px]", mio && !ia ? "text-white/70" : "text-[#8A8799]")}>
              {m.editado ? "editado · " : ""}
              {HORA.format(f)}
              {m.remitente === "DIRECTIVA" ? m.leido ? <CheckCheck className="size-3.5" aria-label="Leído" /> : <Check className="size-3.5" aria-label="Enviado" /> : null}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

function ChatConSocio({
  socio,
  ficha,
  iaActiva,
  iaPausada,
  onIaPausada,
  onVolver,
  onFicha,
  insertar,
}: {
  socio: ConversacionResumen;
  ficha: FichaSocio | null | undefined;
  /** El comité tiene la IA encendida: solo entonces se ofrece pausarla por conversación. */
  iaActiva: boolean;
  iaPausada: boolean;
  onIaPausada: (pausada: boolean) => void;
  /** Solo en pantallas angostas: volver a la lista. */
  onVolver: () => void;
  /** Abre la ficha del socio donde no cabe a un costado. */
  onFicha: () => void;
  /** Un texto que la ficha pide poner en la caja de escribir. */
  insertar: { n: number; texto: string } | null;
}) {
  const socioId = socio.socioId;
  const nombre = socio.nombre;
  const conIa = iaActiva && !iaPausada;

  function alternarIa(activa: boolean) {
    onIaPausada(!activa);
    void pausarIaConversacion(socioId, !activa).then((ok) => {
      if (ok) {
        toast.success(activa ? "IA activada en esta conversación" : "IA pausada en esta conversación");
      } else {
        onIaPausada(activa);
        toast.error("No pudimos cambiarlo. Inténtalo de nuevo.");
      }
    });
  }
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [cargando, setCargando] = useState(true);
  const [entrada, setEntrada] = useState("");
  const [enviando, iniciarEnvio] = useTransition();
  const [editando, setEditando] = useState<MensajeChat | null>(null);
  const [eliminando, setEliminando] = useState<MensajeChat | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const { otroEscribe, alEscribirElOtro, conectar, alTeclear, alDejarDeEscribir } = useEscribiendo();

  // Lo que la ficha pide poner en la caja de escribir (por ejemplo, el enlace de pago).
  const [insertarVisto, setInsertarVisto] = useState(insertar?.n ?? 0);
  if (insertar && insertar.n !== insertarVisto) {
    setInsertarVisto(insertar.n);
    setEntrada(insertar.texto);
  }

  // El chat se vuelve a montar al cambiar de socio (lleva su id como clave), así que `cargando` parte en verdadero.
  useEffect(() => {
    fetch(`/api/panel/conversaciones/${socioId}/mensajes`)
      .then((r) => (r.ok ? r.json() : []))
      // Si el servidor responde un error (p. ej. el plan ya no incluye el chat),
      // se muestra vacío en vez de romper la pantalla.
      .then((data: unknown) => setMensajes(Array.isArray(data) ? (data as MensajeChat[]) : []))
      .catch(() => setMensajes([]))
      .finally(() => setCargando(false));

    marcarLeidoDirectiva(socioId);

    const detener = escucharChat<MensajeChat>(
      socioId,
      (mensaje) => {
        setMensajes((prev) => agregarSinRepetir(prev, mensaje));
        if (mensaje.remitente === "SOCIO") {
          alEscribirElOtro(false);
          marcarLeidoDirectiva(socioId);
        }
      },
      { de: "DIRECTIVA", alEscribir: alEscribirElOtro }
    );
    conectar(detener.avisarEscribiendo);

    // Respaldo: si por algo la conexión en vivo no avisa, el historial se
    // revisa cada pocos segundos mientras la pestaña está a la vista.
    const revisar = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/panel/conversaciones/${socioId}/mensajes`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: unknown) => {
          if (Array.isArray(data)) {
            setMensajes((prev) => (cambio(prev, data as MensajeChat[]) ? (data as MensajeChat[]) : prev));
          }
        })
        .catch(() => undefined);
    }, 5_000);

    return () => {
      conectar(null);
      detener();
      window.clearInterval(revisar);
    };
  }, [socioId, alEscribirElOtro, conectar]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, otroEscribe]);

  function enviar() {
    const texto = entrada.trim();
    if (!texto || enviando) return;
    setEntrada("");
    alDejarDeEscribir();
    if (editando) {
      const id = editando.id;
      setEditando(null);
      iniciarEnvio(async () => {
        const r = await editarMensajeDirectiva(id, texto);
        if (r.ok) {
          setMensajes((prev) => prev.map((m) => (m.id === id ? { ...m, contenido: texto, editado: true } : m)));
        } else {
          toast.error(r.error);
        }
      });
      return;
    }
    iniciarEnvio(async () => {
      const r = await enviarMensajeDirectiva(socioId, texto);
      // El mensaje propio se ve de inmediato; si luego llega el eco en vivo, no se repite.
      if (r.ok) setMensajes((prev) => agregarSinRepetir(prev, r.mensaje));
    });
  }

  function empezarEdicion(m: MensajeChat) {
    setEditando(m);
    setEntrada(m.contenido);
  }

  function cancelarEdicion() {
    setEditando(null);
    setEntrada("");
  }

  function confirmarEliminar() {
    const m = eliminando;
    if (!m) return;
    setEliminando(null);
    iniciarEnvio(async () => {
      const r = await eliminarMensajeDirectiva(m.id);
      if (r.ok) {
        setMensajes((prev) => prev.filter((x) => x.id !== m.id));
        if (editando?.id === m.id) cancelarEdicion();
      } else {
        toast.error(r.error);
      }
    });
  }

  const poner = (texto: string) => {
    setEntrada(texto);
    alTeclear();
  };
  const sugerencia = sugerenciaPara(socio, ficha);
  const p = primerNombre(nombre);
  const plantillas = [
    ["Recordatorio de pago", `Hola ${p}, te recordamos que tienes un saldo pendiente${socio.deuda > 0 ? ` de ${clp(socio.deuda)}` : ""}. Si ya pagaste, avísanos y lo revisamos.`],
    ["Corte programado", `Hola ${p}, te avisamos que habrá un corte de agua programado. Te contamos el día y el horario apenas los confirmemos.`],
    ["Gracias por tu pago", `Hola ${p}, recibimos tu pago. ¡Gracias por estar al día!`],
    ["Datos para factura", `Hola ${p}, con gusto. ¿Me confirmas el RUT y la razón social para emitir la factura?`],
  ] as const;

  // El chat por días, con una línea cuando la IA pasa la conversación a una persona.
  type Fila = { tipo: "dia"; clave: string; etiqueta: string } | { tipo: "msg"; m: MensajeChat; primero: boolean } | { tipo: "pase"; clave: string; texto: string };
  const filas: Fila[] = [];
  let diaPrevio = "";
  let remitentePrevio = "";
  for (const m of mensajes) {
    const f = new Date(m.createdAt);
    const d = DIA.format(f);
    if (d !== diaPrevio) {
      filas.push({ tipo: "dia", clave: `d-${d}`, etiqueta: etiquetaDia(d) });
      diaPrevio = d;
      remitentePrevio = "";
    }
    filas.push({ tipo: "msg", m, primero: remitentePrevio !== m.remitente });
    remitentePrevio = m.remitente;
    if (m.remitente === "IA" && m.requiereHumano) {
      filas.push({ tipo: "pase", clave: `p-${m.id}`, texto: `La IA pasó la conversación a un administrador · ${HORA.format(f)}` });
      remitentePrevio = "";
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-[#F0EEF6] bg-white px-3 py-2.5 sm:px-5 sm:py-3">
        <Button variant="ghost" size="icon" aria-label="Volver a las conversaciones" onClick={onVolver} className="size-9 shrink-0 rounded-lg lg:hidden">
          <ArrowLeft />
        </Button>
        <Avatar nombre={nombre} id={socioId} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{nombre}</p>
          {otroEscribe ? (
            <p className="text-xs font-medium text-[#0A7A52]">escribiendo…</p>
          ) : (
            <p className={cn("truncate text-xs", GRIS)}>{[socio.numeroCliente ? `N° ${socio.numeroCliente}` : null, socio.telefono ? formatearTelefono(socio.telefono) : null].filter(Boolean).join(" · ") || datosDelSocio(socio)}</p>
          )}
        </div>
        {socio.deuda > 0 ? (
          <span className="hidden rounded-md bg-[#FDEFEF] px-2 py-1 text-xs font-semibold text-[#A32020] md:inline">Debe {clp(socio.deuda)}</span>
        ) : (
          <span className="hidden rounded-md bg-[#E6F6EF] px-2 py-1 text-xs font-semibold text-[#075A3C] md:inline">Al día</span>
        )}
        {iaActiva && (
          <div role="radiogroup" aria-label="Quién responde" title="Quién responde solo en esta conversación" className="hidden rounded-lg bg-[#F4F3F9] p-0.5 sm:flex">
            {(
              [
                [true, "IA", Sparkles],
                [false, "Yo", Hand],
              ] as const
            ).map(([v, t, I]) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={conIa === v}
                onClick={() => conIa !== v && alternarIa(v)}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold", conIa === v ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}
              >
                <I className="size-3.5" aria-hidden />
                {t}
              </button>
            ))}
          </div>
        )}
        <Button variant="ghost" size="icon" aria-label="Ficha del socio" onClick={onFicha} className="size-9 shrink-0 rounded-lg xl:hidden">
          <Info className="size-[18px]" />
        </Button>
      </div>

      {iaActiva && (
        <div className={cn("flex items-center gap-2 border-b px-4 py-2 text-xs sm:px-5", conIa ? "border-[#E8E2FD] bg-[#F7F5FF] text-[#3B2A9A]" : "border-[#F6E3C4] bg-[#FFF8EC] text-[#7A4A00]")}>
          {conIa ? <Bot className="size-4 shrink-0" aria-hidden /> : <Hand className="size-4 shrink-0" aria-hidden />}
          <span className="min-w-0 flex-1">{conIa ? "La IA responde esta conversación. Pásala a «Yo» si prefieres atenderla tú." : "Estás atendiendo tú. La IA no responderá hasta que la vuelvas a activar."}</span>
          <span className="sm:hidden">
            <Switch size="sm" checked={conIa} onCheckedChange={alternarIa} aria-label="Respuestas automáticas de la IA" />
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-6">
        {cargando ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : mensajes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#8A8799]">
            <MessageCircle className="size-6" />
            <span className="text-[0.85rem]">Sin mensajes todavía</span>
          </div>
        ) : (
          <ul>
            {filas.map((f) =>
              f.tipo === "dia" ? (
                <li key={f.clave} className="my-3 flex justify-center">
                  <span className={cn("rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold shadow-sm backdrop-blur", GRIS)}>{f.etiqueta}</span>
                </li>
              ) : f.tipo === "pase" ? (
                <li key={f.clave} className="my-3 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF3E0] px-3 py-1 text-xs font-medium text-[#7A4A00]">
                    <Hand className="size-3.5" aria-hidden />
                    {f.texto}
                  </span>
                </li>
              ) : (
                <Burbuja
                  key={f.m.id}
                  m={f.m}
                  primero={f.primero}
                  acciones={
                    f.m.remitente === "DIRECTIVA" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button type="button" aria-label="Opciones del mensaje" className="flex size-6 items-center justify-center rounded-full bg-white text-[#5B5970] shadow-sm hover:text-[#15132B]">
                              <ChevronDown className="size-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => empezarEdicion(f.m)}>
                            <Pencil />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEliminando(f.m)}>
                            <Trash2 />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : undefined
                  }
                />
              )
            )}
          </ul>
        )}
        {otroEscribe && (
          <div className="mt-3">
            <IndicadorEscribiendo />
          </div>
        )}
        <div ref={finRef} />
      </div>

      <div className="border-t border-[#F0EEF6] bg-white px-3 pt-3 pb-3 sm:px-5">
        {editando && (
          <div className="mb-2.5 flex items-center gap-2 rounded-xl bg-[#F4F3F9] px-3 py-2 text-[13px] text-[#3F3C55]">
            <Pencil className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">Editando: {editando.contenido}</span>
            <button type="button" onClick={cancelarEdicion} aria-label="Cancelar edición" className="rounded-full p-1 hover:bg-black/5">
              <X className="size-4" />
            </button>
          </div>
        )}
        {!conIa && !entrada && !editando ? (
          <button type="button" onClick={() => poner(sugerencia)} className="mb-2.5 flex w-full items-start gap-2.5 rounded-xl border border-dashed border-[#D9D0FC] bg-[#FAF8FF] px-3 py-2 text-left hover:border-[#B9A8F9]">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-[#6B46F5]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-[#5530E8]">Sugerencia · toca para usarla</span>
              <span className="block truncate text-[13px] text-[#3F3C55]">{sugerencia}</span>
            </span>
          </button>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="rounded-xl border border-[#E4E1F0] bg-white transition-shadow focus-within:border-[#C4B7FA] focus-within:ring-4 focus-within:ring-[#ECE8FD]"
        >
          <textarea
            aria-label="Mensaje"
            rows={2}
            value={entrada}
            maxLength={1000}
            onChange={(e) => {
              setEntrada(e.target.value);
              if (e.target.value.trim()) alTeclear();
              else alDejarDeEscribir();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder={editando ? "Corrige tu mensaje" : `Escribe a ${p}…`}
            className="block max-h-32 w-full resize-none rounded-t-xl bg-transparent px-3.5 pt-3 text-sm outline-none placeholder:text-[#9A98AB]"
          />
          <div className="flex items-center gap-1 px-2 pb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!ficha?.boleta}
              onClick={() => ficha?.boleta && poner(`Hola ${p}, tu boleta de ${mesDe(ficha.boleta.periodo)} es de ${clp(ficha.boleta.monto)} y vence el ${diaMes(ficha.boleta.vence)}.`)}
              className="h-9 rounded-lg px-2.5 text-[13px] font-medium text-[#5B5970]"
            >
              <FileText className="size-4" />
              <span className="hidden sm:inline">Boleta</span>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => poner(textoLinkPago(socio, ficha))} className="h-9 rounded-lg px-2.5 text-[13px] font-medium text-[#5B5970]">
              <CreditCard className="size-4" />
              <span className="hidden sm:inline">Link de pago</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg px-2.5 text-[13px] font-medium text-[#5B5970]">
                    <Zap className="size-4" />
                    <span className="hidden sm:inline">Plantillas</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                {plantillas.map(([t, texto]) => (
                  <DropdownMenuItem key={t} onClick={() => poner(texto)}>
                    {t}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className={cn("ml-auto hidden text-[11px] xl:inline", GRIS)}>Enter envía · Shift+Enter salto</span>
            <Button type="submit" size="sm" aria-label="Enviar" disabled={enviando || !entrada.trim()} className="ml-auto h-9 rounded-lg px-3.5 font-semibold xl:ml-2">
              <SendHorizontal className="size-4" />
              <span className="hidden sm:inline">Enviar</span>
            </Button>
          </div>
        </form>
      </div>

      <Dialog open={!!eliminando} onOpenChange={(v) => !v && setEliminando(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar este mensaje?</DialogTitle>
            <DialogDescription>Desaparece también de la conversación del socio. No se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEliminando(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminar}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** La ficha del socio al lado de su conversación: lo que debe, su última boleta, su consumo y lo último que le pasó. */
function Ficha({ socio, ficha, iaDisponible, onLinkPago, onConfigurar, onCerrar }: { socio: ConversacionResumen; ficha: FichaSocio | null | undefined; iaDisponible: boolean; onLinkPago: () => void; onConfigurar: () => void; onCerrar?: () => void }) {
  const consumo = ficha?.consumo ?? [];
  const max = Math.max(1, ...consumo.map((c) => c.m3));
  const COLOR = { morado: "bg-[#6B46F5]", azul: "bg-[#0B8BD3]", verde: "bg-[#2FB386]" } as const;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#F0EEF6] px-5 py-4">
        <p className="text-[15px] font-semibold">Ficha del socio</p>
        {onCerrar ? (
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onCerrar} className="size-9 rounded-lg">
            <X />
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 divide-y divide-[#F0EEF6] overflow-y-auto">
        <section className="flex flex-col items-center px-5 py-5 text-center">
          <Avatar nombre={socio.nombre} id={socio.socioId} grande />
          <p className="mt-2 font-semibold">{socio.nombre}</p>
          <p className={cn("text-xs", GRIS)}>{datosDelSocio(socio) || "Sin RUT ni número de cliente"}</p>
          {socio.telefono ? (
            <p className={cn("mt-0.5 inline-flex items-center gap-1 text-xs", GRIS)}>
              <Phone className="size-3" aria-hidden />
              {formatearTelefono(socio.telefono)}
            </p>
          ) : null}
          <Link href="/panel/socios" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 h-8 rounded-lg border-[#E4E1F0] text-xs font-semibold")}>
            Ver ficha completa
          </Link>
        </section>

        <section className="px-5 py-4">
          <div className={cn("rounded-xl px-4 py-3", socio.deuda ? "bg-[#FDF3F3]" : "bg-[#F3FBF7]")}>
            <p className={cn("text-xs", socio.deuda ? "text-[#A32020]" : "text-[#0A7A52]")}>{socio.deuda ? "Saldo pendiente" : "Al día"}</p>
            <p className="mt-0.5 text-[22px] font-semibold tabular-nums">{clp(socio.deuda)}</p>
            {socio.deuda ? (
              <Button size="sm" onClick={onLinkPago} className="mt-2 h-8 w-full rounded-lg text-xs font-semibold">
                <CreditCard className="size-3.5" />
                Enviar link de pago
              </Button>
            ) : null}
          </div>
          {ficha === undefined ? (
            <p className={cn("mt-3 flex items-center gap-2 text-[13px]", GRIS)}>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Cargando la ficha…
            </p>
          ) : ficha?.boleta ? (
            <dl className="mt-3 flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <dt className={GRIS}>Última boleta</dt>
                <dd className="font-medium capitalize">
                  {mesDe(ficha.boleta.periodo)} {ficha.boleta.periodo.slice(0, 4)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className={GRIS}>Monto</dt>
                <dd className="font-medium tabular-nums">{clp(ficha.boleta.monto)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className={GRIS}>Vence</dt>
                <dd className="font-medium tabular-nums">{diaMes(ficha.boleta.vence)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className={GRIS}>Estado</dt>
                <dd className={cn("font-semibold", ficha.boleta.estado === "Pagada" ? "text-[#075A3C]" : ficha.boleta.estado === "Vencida" ? "text-[#A32020]" : "text-[#8A4B00]")}>{ficha.boleta.estado}</dd>
              </div>
            </dl>
          ) : (
            <p className={cn("mt-3 text-[13px]", GRIS)}>Todavía no tiene boletas.</p>
          )}
        </section>

        {consumo.length > 0 && (
          <section className="px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] font-semibold">Consumo</p>
              <p className={cn("text-xs", GRIS)}>últimos {consumo.length} meses</p>
            </div>
            <div className="mt-3 flex h-16 items-end gap-1.5" role="img" aria-label={`Consumo: ${consumo.map((c) => c.m3).join(", ")} m³`}>
              {consumo.map((c, i) => (
                <span key={c.periodo} className={cn("flex-1 rounded-t", i === consumo.length - 1 ? "bg-[#0B8BD3]" : "bg-[#CDE9FA]")} style={{ height: `${Math.max((c.m3 / max) * 100, 4)}%` }} />
              ))}
            </div>
            <div className={cn("mt-1 flex justify-between text-[10px]", GRIS)}>
              <span>{corto(consumo[0].periodo)}</span>
              <span>
                {corto(consumo[consumo.length - 1].periodo)} · {consumo[consumo.length - 1].m3} m³
              </span>
            </div>
          </section>
        )}

        {ficha && ficha.actividad.length > 0 && (
          <section className="px-5 py-4">
            <p className="text-[13px] font-semibold">Actividad reciente</p>
            <ol className="relative mt-3 flex flex-col gap-3.5 before:absolute before:top-1 before:bottom-1 before:left-[5px] before:w-px before:bg-[#ECEAF4]">
              {ficha.actividad.map((a) => (
                <li key={a.titulo} className="relative flex gap-3">
                  <span aria-hidden className={cn("relative mt-1 size-[11px] shrink-0 rounded-full ring-[3px] ring-white", COLOR[a.color])} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{a.titulo}</span>
                    <span className={cn("block text-xs", GRIS)}>{a.detalle}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="px-5 py-4">
          <div className="flex items-start gap-2.5 rounded-xl bg-[#F8F7FC] px-3 py-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#0A7A52]" aria-hidden />
            <p className={cn("text-xs leading-relaxed", GRIS)}>
              La IA responde deuda, boletas, consumo y cortes. <b className="font-semibold text-[#15132B]">No entrega RUT, dirección ni teléfono.</b>
            </p>
          </div>
          {iaDisponible ? (
            <Button variant="ghost" size="sm" onClick={onConfigurar} className="mt-1.5 h-8 rounded-lg px-2 text-xs font-semibold text-[#2A07A8]">
              <Settings2 className="size-3.5" />
              Configurar asistente
            </Button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
