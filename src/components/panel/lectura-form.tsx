"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  CloudOff,
  CloudUpload,
  CornerDownLeft,
  Droplets,
  Loader2,
  MessageSquarePlus,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Search,
  SkipForward,
  Smartphone,
  Users,
  Wifi,
  X,
  XCircle,
} from "lucide-react";
import { registrarLectura } from "@/app/panel/lecturas/actions";
import { InstalarApp } from "@/components/socio/instalar-app";
import { AvatarSocio } from "@/components/panel/avatar-socio";
import {
  COLA_VACIA,
  encolarLectura,
  hayConexion,
  parsearCola,
  quitarDeCola,
  snapshotCola,
  suscribirCola,
  suscribirConexion,
  type LecturaEnCola,
} from "@/lib/lecturas-offline";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatearPeriodo } from "@/lib/boletas";
import { formatearRut } from "@/lib/formato";
import type { OpcionSocio } from "@/components/panel/socio-buscador";

const GRIS = "text-[#5B5970]";
const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";

/** `anterior`: la última lectura aprobada del socio (o, si no tiene, la de su última boleta): la base del consumo. */
type Socio = OpcionSocio & {
  anterior: { valor: number; periodo: string; origen: "LECTURA" | "BOLETA" } | null;
  /** Su consumo típico (m³ por mes), si tiene lecturas aprobadas con las que calcularlo. */
  promedio?: number | null;
};

type LecturaReciente = {
  id: string;
  socioId: string;
  socio: string;
  periodo: string;
  valor: number;
  /** Lo que consumió contra la lectura aprobada anterior; null si es la primera. */
  consumo: number | null;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  motivoRechazo: string | null;
};

/** Quién ya tiene lectura en un mes (pendiente o aprobada), la haya cargado quien la haya cargado. */
type LecturaDelMes = { socioId: string; periodo: string; estado: "PENDIENTE" | "APROBADA" };

type EstadoForm = { ok: true; enCola?: boolean } | { ok: false; error: string };

/** Lecturas que el servidor rechazó al sincronizar (p. ej. período inválido). */
type Rechazada = { lectura: LecturaEnCola; error: string };

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const miles = (n: number) => n.toLocaleString("es-CL");
const clave = (socioId: string, periodo: string) => `${socioId}|${periodo}`;

const periodoActual = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
};
const nombreMes = (p: string) => formatearPeriodo(p).split(" ")[0];

// ---- el borrador: si la app se cierra a mitad de una lectura, se recupera lo anotado
const CLAVE_BORRADOR = "facilapr.terreno.borrador";
type Borrador = { socioId: string; periodo: string; valor: string; obs: string | null };
function leerBorrador(socioId: string, periodo: string): Borrador | null {
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) ?? "null") as Borrador | null;
    return b && b.socioId === socioId && b.periodo === periodo && (b.valor || b.obs) ? b : null;
  } catch {
    return null;
  }
}
function guardarBorrador(b: Borrador) {
  try {
    if (b.valor || b.obs) localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b));
    else localStorage.removeItem(CLAVE_BORRADOR);
  } catch {
    /* sin almacenamiento: el borrador solo vive mientras la pantalla siga abierta */
  }
}
function borrarBorrador() {
  try {
    localStorage.removeItem(CLAVE_BORRADOR);
  } catch {
    /* sin almacenamiento */
  }
}

function SinSocios({ puedeCargar }: { puedeCargar: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Users className="size-5 text-muted-foreground" />
      </span>
      <h1 className="mt-4 text-[1.1rem] font-semibold">Aún no tienes socios cargados</h1>
      <p className="mt-2 max-w-[42ch] text-[0.92rem] leading-relaxed text-muted-foreground">
        {puedeCargar ? "Para tomar lecturas primero hay que cargar el padrón: los socios y usuarios de tu comité." : "La directiva todavía no cargó los socios del comité. Avísale para poder tomar lecturas."}
      </p>
      {puedeCargar && (
        <Link href="/panel/socios" className={cn(buttonVariants(), "mt-5")}>
          Cargar socios
        </Link>
      )}
    </div>
  );
}

/**
 * La lectura de un socio: el número grande, lo anterior y el consumo en vivo, avisos si algo no cuadra y la
 * observación. Se vuelve a montar con cada socio (por su `key`), así empieza limpio y recupera su borrador.
 */
function FormularioLectura({
  socio,
  periodo,
  enLinea,
  repetir,
  bloqueado,
  yaAprobada,
  pendiente,
  accion,
  onSaltar,
}: {
  socio: Socio;
  periodo: string;
  enLinea: boolean;
  /** La directiva rechazó una lectura anterior de este socio en el mes: hay que volver a leerlo. */
  repetir: { valor: number; motivo: string | null } | null;
  /** Este socio ya tiene una lectura por revisar: el servidor no admite otra mientras tanto. */
  bloqueado: boolean;
  yaAprobada: boolean;
  pendiente: boolean;
  accion: (formData: FormData) => void;
  onSaltar: () => void;
}) {
  const borrador = useMemo(() => leerBorrador(socio.id, periodo), [socio.id, periodo]);
  const [valor, setValor] = useState(borrador?.valor ?? "");
  const [obs, setObs] = useState<string | null>(borrador?.obs ?? null);
  const [confirmar, setConfirmar] = useState(false);
  const [cambio, setCambio] = useState(false);
  const [finalViejo, setFinalViejo] = useState("");
  const recuperado = Boolean(borrador);
  const inputRef = useRef<HTMLInputElement>(null);

  const anterior = socio.anterior;
  const v = valor === "" ? null : Number(valor);
  const fin = finalViejo === "" ? null : Number(finalViejo);
  // Sin lectura anterior no hay consumo que mostrar: sería el medidor completo.
  // Con medidor nuevo (parte en 0): lo que consumió el viejo hasta retirarlo + lo que lleva el nuevo.
  const consumo =
    v !== null && anterior ? (cambio ? (fin !== null ? fin - anterior.valor : 0) + v : v - anterior.valor) : null;
  const finalMenor = cambio && fin !== null && !!anterior && fin < anterior.valor;
  const menor = !cambio && consumo !== null && consumo < 0;
  const alto = !menor && consumo !== null && socio.promedio != null && socio.promedio > 0 && consumo > socio.promedio * 2;
  const aviso = menor || alto;
  const puede = v !== null && !bloqueado && !finalMenor;

  function cambiar(nuevoValor: string, nuevaObs: string | null) {
    setValor(nuevoValor);
    setObs(nuevaObs);
    setConfirmar(false);
    guardarBorrador({ socioId: socio.id, periodo, valor: nuevoValor, obs: nuevaObs });
  }

  function alEnviar(e: React.FormEvent<HTMLFormElement>) {
    // Una lectura dudosa (menor o muy alta) pide tocar una segunda vez antes de enviarla.
    if (aviso && !confirmar) {
      e.preventDefault();
      setConfirmar(true);
    }
  }

  return (
    <form action={accion} onSubmit={alEnviar} className="px-4 pb-4 sm:px-5 sm:pb-5">
      <input type="hidden" name="socioId" value={socio.id} />
      <input type="hidden" name="periodo" value={periodo} />
      <input type="hidden" name="valor" value={valor} />
      <input type="hidden" name="observacion" value={obs ?? ""} />
      {cambio && <input type="hidden" name="medidorCambiado" value="1" />}
      {cambio && <input type="hidden" name="lecturaFinalAnterior" value={finalViejo} />}

      {repetir && (
        <p className="mb-3 flex items-start gap-2.5 rounded-xl border border-[#F6D3D2] bg-[#FFF5F5] px-3 py-2.5 text-[13px] text-[#8A1F1F]">
          <RotateCcw className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <b className="font-semibold">Repetir lectura.</b> La directiva rechazó {miles(repetir.valor)} m³{repetir.motivo ? `: «${repetir.motivo}»` : ""}.
          </span>
        </p>
      )}
      {recuperado && (
        <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-[#F1EEFD] px-3 py-2 text-xs font-medium text-[#2A07A8]">
          <Smartphone className="size-3.5" aria-hidden />
          Recuperamos lo que estabas anotando.
        </p>
      )}

      {/* El medidor: el número grande, para leerlo de pie y con una mano. */}
      <div className={cn("rounded-xl border p-4 transition-colors", menor ? "border-[#F2C1C0] bg-[#FFF7F7]" : alto ? "border-[#F6D9B8] bg-[#FFF9F1]" : "border-[#E9E6F4] bg-[#F9F8FD] focus-within:border-[#B9A9F8]")}>
        <div className="flex items-center justify-between">
          <label htmlFor="terreno-lectura" className="text-[13px] font-medium">
            Lectura del medidor
          </label>
          <span className={cn("text-xs", GRIS)}>m³</span>
        </div>
        <input
          id="terreno-lectura"
          ref={inputRef}
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          value={valor === "" ? "" : miles(Number(valor))}
          onChange={(e) => cambiar(e.target.value.replace(/\D/g, "").slice(0, 7), obs)}
          placeholder="Escribe el número"
          className="mt-1 w-full bg-transparent text-center text-[46px] font-semibold tracking-tight text-[#15132B] tabular-nums outline-none placeholder:text-[22px] placeholder:font-medium placeholder:text-[#C9C6D8]"
        />
        <div className="mt-2 grid grid-cols-2 border-t border-[#E9E6F4] pt-3 text-center">
          <div>
            <p className={cn("text-xs", GRIS)}>Anterior</p>
            <p className="font-semibold tabular-nums">{anterior ? miles(anterior.valor) : "—"}</p>
            <p className={cn("text-[11px]", GRIS)}>{anterior ? `${formatearPeriodo(anterior.periodo)}${anterior.origen === "BOLETA" ? " · su boleta" : ""}` : "primera lectura"}</p>
          </div>
          <div className="border-l border-[#E9E6F4]">
            <p className={cn("text-xs", GRIS)}>Consumo</p>
            <p className={cn("font-semibold tabular-nums", menor ? "text-[#A32020]" : alto ? "text-[#B86400]" : consumo !== null ? "text-[#075A3C]" : "text-[#B4B2C4]")}>
              {!anterior && v !== null ? "Inicial" : consumo === null ? "—" : `${consumo > 0 ? "+" : ""}${miles(consumo)} m³`}
            </p>
            <p className={cn("text-[11px]", GRIS)}>{socio.promedio != null ? `promedio ${miles(socio.promedio)} m³` : "sin promedio"}</p>
          </div>
        </div>
      </div>

      {bloqueado ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-[13px] leading-snug text-[#A32020]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Este socio ya tiene una lectura por revisar en {formatearPeriodo(periodo)}. Espera a que se revise antes de cargar otra.
        </p>
      ) : yaAprobada ? (
        <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-snug text-[#8F4400]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Este socio ya tiene su lectura de {formatearPeriodo(periodo)} aprobada.
        </p>
      ) : (
        <p role={aviso ? "alert" : undefined} className={cn("mt-2 flex items-start gap-1.5 text-[13px] leading-snug", menor ? "text-[#A32020]" : alto ? "text-[#8F4400]" : GRIS)}>
          {menor ? (
            <>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Es menor que la anterior ({miles(anterior?.valor ?? 0)}). Revisa el número; si cambiaron el medidor, anótalo en la observación. {confirmar && "Toca otra vez para guardarla igual."}
              </span>
            </>
          ) : alto ? (
            <>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Consumo {Math.round((consumo ?? 0) / (socio.promedio ?? 1))}× su promedio. {confirmar ? "Toca otra vez para guardarla igual." : "Revisa el número."}
              </span>
            </>
          ) : anterior ? (
            `Debe ser ${miles(anterior.valor)} o más.`
          ) : (
            "Primera lectura de este socio: la directiva la usa como punto de partida."
          )}
        </p>
      )}

      {anterior &&
        (cambio ? (
          <div className="mt-3 rounded-xl border border-[#E9E6F4] bg-[#F9F8FD] p-3">
            <div className="flex items-center justify-between">
              <label htmlFor="terreno-final" className="text-[13px] font-medium">
                Medidor viejo: lo que marcaba al retirarlo
              </label>
              <button type="button" onClick={() => { setCambio(false); setFinalViejo(""); }} className="text-xs font-semibold text-[#2A07A8] hover:underline">
                Quitar
              </button>
            </div>
            <input
              id="terreno-final"
              inputMode="numeric"
              autoComplete="off"
              value={finalViejo === "" ? "" : miles(Number(finalViejo))}
              onChange={(e) => setFinalViejo(e.target.value.replace(/\D/g, "").slice(0, 7))}
              placeholder={`${miles(anterior.valor)} o más`}
              className="mt-1 w-full bg-transparent text-xl font-semibold tabular-nums outline-none placeholder:text-base placeholder:font-medium placeholder:text-[#C9C6D8]"
            />
            <p className={cn("mt-1 text-[12px] leading-snug", finalMenor ? "text-[#A32020]" : GRIS)}>
              {finalMenor
                ? `No puede ser menor que la anterior (${miles(anterior.valor)}).`
                : "El medidor nuevo parte en 0: arriba anota lo que marca ahora. El consumo suma ambos tramos."}
            </p>
          </div>
        ) : (
          <button type="button" onClick={() => setCambio(true)} className="mt-3 flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[#2A07A8] hover:underline">
            <RotateCcw className="size-4" aria-hidden />
            Cambiaron el medidor
          </button>
        ))}

      {obs === null ? (
        <button type="button" onClick={() => cambiar(valor, "")} className="mt-3 flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[#2A07A8] hover:underline">
          <MessageSquarePlus className="size-4" aria-hidden />
          Agregar observación
        </button>
      ) : (
        <div className="relative mt-3">
          <Textarea autoFocus aria-label="Observación" value={obs} onChange={(e) => cambiar(valor, e.target.value)} rows={2} maxLength={300} placeholder="Ej.: medidor empañado, cambiaron el medidor, perro suelto…" className="min-h-[68px] rounded-lg border-[#E4E1F0] pr-9 text-base shadow-none md:text-sm" />
          <button type="button" aria-label="Quitar observación" onClick={() => cambiar(valor, null)} className="absolute top-2 right-2 rounded-md p-1 text-[#8A8799] hover:bg-[#F2F1F7]">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
        <Button type="button" variant="outline" onClick={onSaltar} className="h-12 rounded-xl border-[#E4E1F0] px-4 font-semibold">
          <SkipForward />
          Saltar
        </Button>
        <Button type="submit" disabled={!puede || pendiente} className={cn("h-12 rounded-xl text-[15px] font-semibold", confirmar && "bg-[#B86400] hover:bg-[#B86400]/90")}>
          {pendiente && <Loader2 className="animate-spin" />}
          {confirmar ? "Guardar igual" : enLinea ? "Registrar y seguir" : "Guardar y seguir"}
          <kbd className="ml-1 hidden items-center rounded bg-white/20 px-1.5 py-0.5 font-sans text-[11px] lg:inline-flex">
            <CornerDownLeft className="size-3" aria-hidden />
            <span className="sr-only">Enter</span>
          </kbd>
        </Button>
      </div>
      {!enLinea && <p className={cn("mt-2 text-center text-xs", GRIS)}>Sin señal: queda guardada en el teléfono.</p>}
    </form>
  );
}

export function LecturaForm({
  socios,
  recientes,
  leidas = [],
  puedeCargarSocios = false,
}: {
  socios: Socio[];
  recientes: LecturaReciente[];
  /** Las lecturas de los últimos meses de todo el comité: de ahí sale cuánto lleva leído de la ruta. */
  leidas?: LecturaDelMes[];
  /** La directiva puede ir a cargar el padrón; el operador solo avisarle. */
  puedeCargarSocios?: boolean;
}) {
  const router = useRouter();
  const enviandoCola = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [pestana, setPestana] = useState<"cargar" | "historial">("cargar");
  const [periodo, setPeriodo] = useState(periodoActual);
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [saltados, setSaltados] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [busca, setBusca] = useState("");
  // Lo que se cargó en esta sesión: cuenta de inmediato en la ruta, sin esperar a recargar.
  const [marcados, setMarcados] = useState<string[]>([]);
  const [ultimo, setUltimo] = useState<{ nombre: string; enCola: boolean } | null>(null);
  const [rechazadas, setRechazadas] = useState<Rechazada[]>([]);
  const [busquedaLecturas, setBusquedaLecturas] = useState("");
  const [vista, setVista] = useState<"todas" | "local">("todas");

  const crudoCola = useSyncExternalStore(suscribirCola, snapshotCola, () => COLA_VACIA);
  const cola = useMemo(() => parsearCola(crudoCola), [crudoCola]);
  const enLinea = useSyncExternalStore(suscribirConexion, hayConexion, () => true);
  // El formulario se arma solo en el navegador: recupera el borrador del teléfono sin desajustes con el servidor.
  const enNavegador = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Quién ya tiene lectura en cada mes: lo del servidor, lo cargado ahora y lo que espera señal.
  const estadoPorClave = useMemo(() => {
    const m = new Map<string, "PENDIENTE" | "APROBADA">();
    for (const l of leidas) m.set(clave(l.socioId, l.periodo), l.estado);
    for (const k of marcados) m.set(k, "PENDIENTE");
    for (const c of cola) m.set(clave(c.socioId, c.periodo), "PENDIENTE");
    return m;
  }, [leidas, marcados, cola]);

  const periodoValido = /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo);
  const leidosN = socios.filter((s) => estadoPorClave.has(clave(s.id, periodo))).length;
  const pendientes = socios.filter((s) => !estadoPorClave.has(clave(s.id, periodo)));

  // Las lecturas que la directiva rechazó este mes y todavía no se repiten: van primero en la ruta.
  const porRepetirMap = useMemo(() => {
    const m = new Map<string, { valor: number; motivo: string | null }>();
    for (const l of recientes) {
      if (l.estado === "RECHAZADA" && l.periodo === periodo && !estadoPorClave.has(clave(l.socioId, periodo)) && !m.has(l.socioId)) m.set(l.socioId, { valor: l.valor, motivo: l.motivoRechazo });
    }
    return m;
  }, [recientes, periodo, estadoPorClave]);
  const porRepetir = pendientes.filter((s) => porRepetirMap.has(s.id));
  const ruta = [...pendientes.filter((s) => !saltados.includes(s.id) && porRepetirMap.has(s.id)), ...pendientes.filter((s) => !saltados.includes(s.id) && !porRepetirMap.has(s.id))];

  const elegido = elegidoId ? (socios.find((s) => s.id === elegidoId) ?? null) : null;
  const actual = elegido ?? ruta[0] ?? pendientes[0] ?? null;
  const pct = socios.length ? Math.round((leidosN / socios.length) * 100) : 0;
  const yaLeido = actual ? (estadoPorClave.get(clave(actual.id, periodo)) ?? null) : null;

  const tBusca = sinTildes(busca.trim());
  const encontrados = pendientes.filter((s) => !tBusca || sinTildes(`${s.nombre} ${s.rut ?? ""} ${s.rut ? formatearRut(s.rut) : ""} ${s.numeroCliente ?? ""}`).includes(tBusca));

  function limpiar() {
    setElegidoId(null);
    setBuscando(false);
    setBusca("");
    setFormKey((k) => k + 1);
    borrarBorrador();
  }

  function saltar() {
    if (!actual) return;
    setSaltados((s) => (pendientes.every((p) => s.includes(p.id) || p.id === actual.id) ? [] : [...s, actual.id]));
    limpiar();
    setUltimo(null);
  }

  function irA(id: string) {
    setElegidoId(id);
    setBuscando(false);
    setBusca("");
    setFormKey((k) => k + 1);
    setPestana("cargar");
  }

  function guardarSinConexion(formData: FormData): EstadoForm {
    const socioId = String(formData.get("socioId") ?? "");
    const guardada = encolarLectura({
      socioId,
      socioNombre: socios.find((s) => s.id === socioId)?.nombre ?? "Socio",
      periodo: String(formData.get("periodo") ?? ""),
      valor: String(formData.get("valor") ?? ""),
      observacion: String(formData.get("observacion") ?? ""),
      medidorCambiado: String(formData.get("medidorCambiado") ?? ""),
      lecturaFinalAnterior: String(formData.get("lecturaFinalAnterior") ?? ""),
    });
    return guardada
      ? { ok: true, enCola: true }
      : {
          ok: false,
          error: "No hay señal y este teléfono no dejó guardar la lectura. Anótala y envíala cuando tengas conexión.",
        };
  }

  async function enviar(formData: FormData): Promise<EstadoForm> {
    if (!hayConexion()) return guardarSinConexion(formData);
    try {
      return await registrarLectura(null, formData);
    } catch (error) {
      // Señal que se cayó justo al enviar. Cualquier otro error es un bug
      // real y no debe esconderse en la cola.
      if (error instanceof TypeError || !hayConexion()) {
        return guardarSinConexion(formData);
      }
      throw error;
    }
  }

  const [estado, accion, pendiente] = useActionState<EstadoForm | null, FormData>(async (_prev, formData) => {
    const r = await enviar(formData);
    if (r.ok) {
      const socioId = String(formData.get("socioId") ?? "");
      setMarcados((m) => [...m, clave(socioId, String(formData.get("periodo") ?? ""))]);
      setUltimo({ nombre: socios.find((s) => s.id === socioId)?.nombre ?? "Socio", enCola: !!r.enCola });
      limpiar();
      // Una vibración corta confirma el guardado sin mirar la pantalla.
      navigator.vibrate?.(40);
    } else {
      setUltimo(null);
    }
    return r;
  }, null);

  // El service worker deja abierta esta pantalla sin señal. Sin soporte o con
  // un fallo al registrarlo, el formulario sigue funcionando: solo no abre
  // offline desde cero.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/panel/lecturas" }).catch(() => {});
  }, []);

  async function enviarCola() {
    if (enviandoCola.current) return;
    enviandoCola.current = true;
    setEnviando(true);
    let enviadas = 0;
    try {
      for (const lectura of parsearCola(snapshotCola())) {
        const datos = new FormData();
        datos.set("socioId", lectura.socioId);
        datos.set("periodo", lectura.periodo);
        datos.set("valor", lectura.valor);
        if (lectura.observacion) datos.set("observacion", lectura.observacion);
        if (lectura.medidorCambiado === "1") {
          datos.set("medidorCambiado", "1");
          if (lectura.lecturaFinalAnterior) datos.set("lecturaFinalAnterior", lectura.lecturaFinalAnterior);
        }

        try {
          const r = await registrarLectura(null, datos);
          quitarDeCola(lectura.idLocal);
          if (r.ok) enviadas++;
          else setRechazadas((prev) => [...prev, { lectura, error: r.error }]);
        } catch {
          break; // sigue sin señal: se reintenta al volver la conexión
        }
      }
    } finally {
      enviandoCola.current = false;
      setEnviando(false);
    }
    if (enviadas > 0) router.refresh();
  }

  // Al volver la señal (o al abrir la pantalla con conexión) se vacía la cola.
  useEffect(() => {
    if (enLinea && cola.length > 0) void enviarCola();
    // enviarCola solo usa refs y el store local: no depende del render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enLinea, cola.length]);

  // Las lecturas que se ven en «Mis lecturas»: las que esperan señal y las del servidor.
  type ItemLectura = { id: string; socioId: string; socio: string; periodo: string; valor: number; consumo: number | null; estado: "LOCAL" | "PENDIENTE" | "APROBADA" | "RECHAZADA"; motivo: string | null };
  const items: ItemLectura[] = useMemo(() => {
    const anteriorDe = new Map(socios.map((s) => [s.id, s.anterior?.valor ?? null]));
    const locales: ItemLectura[] = [...cola].reverse().map((c) => {
      const ant = anteriorDe.get(c.socioId) ?? null;
      const valor = Number(c.valor);
      return { id: c.idLocal, socioId: c.socioId, socio: c.socioNombre, periodo: c.periodo, valor, consumo: ant === null ? null : valor - ant, estado: "LOCAL", motivo: null };
    });
    const delServidor: ItemLectura[] = recientes.map((l) => ({ id: l.id, socioId: l.socioId, socio: l.socio, periodo: l.periodo, valor: l.valor, consumo: l.consumo, estado: l.estado, motivo: l.motivoRechazo }));
    return [...locales, ...delServidor];
  }, [cola, recientes, socios]);

  const buscandoLecturas = busquedaLecturas.trim() !== "";
  const mostradas = useMemo(() => {
    const q = sinTildes(busquedaLecturas.trim());
    return items.filter((l) => (vista === "todas" || l.estado === "LOCAL") && (q ? sinTildes(`${l.socio} ${formatearPeriodo(l.periodo)} ${l.valor}`).includes(q) : l.periodo === periodo));
  }, [items, busquedaLecturas, vista, periodo]);
  const delMes = items.filter((l) => l.periodo === periodo);
  const nSinEnviar = items.filter((l) => l.estado === "LOCAL" && l.periodo === periodo).length;
  const nBadge = porRepetir.length + cola.length;

  // Sin padrón no hay a quién tomarle la lectura: se dice claro, en vez de un
  // buscador que parece roto ("Ningún socio coincide").
  if (socios.length === 0) {
    return <SinSocios puedeCargar={puedeCargarSocios} />;
  }

  return (
    <>
      {/* Celular: una pestaña a la vez, como app. Escritorio (md:): dos columnas, para cargar a la izquierda y las
          lecturas a la derecha. */}
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 pb-24 md:grid md:max-w-[1080px] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6 md:pb-0">
        <div className="flex items-center gap-3 md:col-span-2">
          <div className="min-w-0 flex-1 leading-tight">
            <h1 className="truncate text-[22px] font-semibold tracking-tight">Modo terreno</h1>
            <p className={cn("truncate text-[13px]", GRIS)}>Carga lecturas aunque no haya señal · <span className="capitalize">{nombreMes(periodo)}</span></p>
          </div>
          <span className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold", enLinea ? "bg-[#E6F6EF] text-[#075A3C]" : "bg-[#FFF3E5] text-[#8F4400]")}>
            {enLinea ? <Wifi className="size-3.5" aria-hidden /> : <CloudOff className="size-3.5" aria-hidden />}
            {enLinea ? "En línea" : "Sin conexión"}
          </span>
        </div>

        {(cola.length > 0 || enviando) && (
          <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] md:col-span-2", enLinea ? "border-[#D7EFE4] bg-[#F3FBF7]" : "border-[#F6E2C8] bg-[#FFF9F1]")}>
            {enviando ? <RefreshCw className="size-4 shrink-0 animate-spin text-[#0A7A52]" aria-hidden /> : <Smartphone className={cn("size-4 shrink-0", enLinea ? "text-[#0A7A52]" : "text-[#B86400]")} aria-hidden />}
            <span className={cn("flex-1", enLinea ? "text-[#075A3C]" : "text-[#7A3B00]")} role="status">
              {enviando ? (
                "Enviando lecturas…"
              ) : (
                <>
                  <b className="font-semibold">
                    {cola.length} lectura{cola.length === 1 ? "" : "s"}
                  </b>{" "}
                  guardada{cola.length === 1 ? "" : "s"} en el teléfono. {enLinea ? "" : "Se enviarán solas cuando vuelva la señal."}
                </>
              )}
            </span>
            {enLinea && !enviando && (
              <Button size="sm" onClick={() => void enviarCola()} className="h-8 rounded-lg bg-[#0A9B68] px-3 text-xs font-semibold hover:bg-[#0A9B68]/90">
                <CloudUpload className="size-3.5" />
                Enviar ahora
              </Button>
            )}
          </div>
        )}

        {/* ─── Cargar ─── */}
        <div className={cn("flex-col gap-4", pestana === "cargar" ? "flex" : "hidden md:flex")}>
          <section aria-label="Ruta del mes" className={cn("rounded-2xl bg-card p-4 sm:p-5", SOMBRA)}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <label htmlFor="terreno-periodo" className={cn("text-[13px] font-medium", GRIS)}>
                  Tu ruta de {nombreMes(periodo)}
                </label>
                <p className="mt-0.5 text-[26px] leading-none font-semibold tabular-nums">
                  {leidosN} <span className={cn("text-base font-medium", GRIS)}>de {socios.length}</span>
                </p>
              </div>
              <div className={cn("text-right text-[13px]", GRIS)}>
                {marcados.length > 0 && <span className="mb-0.5 block font-semibold text-[#075A3C]">+{marcados.length} hoy</span>}
                <b className="font-semibold text-[#15132B] tabular-nums">{pct}%</b> · {pendientes.length === 0 ? "ruta completa" : `faltan ${pendientes.length}`}
              </div>
            </div>
            <div role="progressbar" aria-label="Avance de tu ruta" aria-valuenow={leidosN} aria-valuemin={0} aria-valuemax={socios.length} className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEEBF7]">
              <span className="block h-full rounded-full bg-gradient-to-r from-[#6B46F5] to-[#3A0CE3]" style={{ width: `${leidosN > 0 ? Math.max(pct, 2) : 0}%` }} />
            </div>
            <div className="relative mt-3 w-fit">
              <span className="flex h-9 items-center gap-1 rounded-full bg-[#F4F3F9] px-3 text-xs font-semibold text-[#2A07A8]">Cambiar mes</span>
              <input
                id="terreno-periodo"
                type="month"
                value={periodo}
                onChange={(e) => {
                  if (e.target.value) setPeriodo(e.target.value);
                  limpiar();
                  setSaltados([]);
                  setUltimo(null);
                }}
                // En el computador, tocar el campo invisible no abre el calendario solo: se abre a mano.
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch {
                    /* el navegador lo abre por su cuenta */
                  }
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
          </section>

          {ultimo && (
            <p role="status" className="flex items-center gap-2 rounded-xl bg-[#E6F6EF] px-4 py-2 text-[13px] font-semibold text-[#075A3C]">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{ultimo.enCola ? `${ultimo.nombre}: guardada en este teléfono, se envía al volver la señal` : `${ultimo.nombre} registrado, pendiente de revisión`}</span>
            </p>
          )}

          {estado && !estado.ok && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {estado.error}
            </p>
          )}

          {!actual ? (
            <div className={cn("flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center", SOMBRA)}>
              <PartyPopper className="size-9 text-primary" aria-hidden />
              <p className="text-lg font-semibold">¡Ruta terminada!</p>
              <p className={cn("text-sm", GRIS)}>{cola.length > 0 ? "Recuerda enviar las lecturas cuando tengas señal." : `Todos los socios tienen lectura en ${formatearPeriodo(periodo)}.`}</p>
            </div>
          ) : (
            <div className={cn("overflow-hidden rounded-2xl bg-card", SOMBRA)}>
              <div className="flex items-center gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
                <AvatarSocio id={actual.id} nombre={actual.nombre} className="size-11 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs font-medium", GRIS)}>{elegido ? "Socio elegido" : "Siguiente socio"}</p>
                  <p className="truncate text-[17px] leading-tight font-semibold">{actual.nombre}</p>
                  <p className={cn("mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]", GRIS)}>
                    {actual.numeroCliente ? `Cliente N° ${actual.numeroCliente}` : "Sin número"}
                    {actual.rut ? (
                      <span>· {formatearRut(actual.rut)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF3E5] px-1.5 py-px text-[11px] font-semibold text-[#8F4400]">
                        <AlertTriangle className="size-3" aria-hidden />
                        Sin RUT
                      </span>
                    )}
                    {actual.tipo === "USUARIO" && <span>· Usuario</span>}
                  </p>
                </div>
                <Button type="button" variant="outline" size="icon" aria-label="Buscar otro socio de la ruta" onClick={() => setBuscando(true)} className="size-11 shrink-0 rounded-xl border-[#E4E1F0]">
                  <Search className="size-5" />
                </Button>
              </div>

              {enNavegador ? (
                <FormularioLectura
                  key={`${actual.id}-${periodo}-${formKey}`}
                  socio={actual}
                  periodo={periodo}
                  enLinea={enLinea}
                  repetir={porRepetirMap.get(actual.id) ?? null}
                  bloqueado={yaLeido === "PENDIENTE" || !periodoValido}
                  yaAprobada={yaLeido === "APROBADA"}
                  pendiente={pendiente}
                  accion={accion}
                  onSaltar={saltar}
                />
              ) : (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5" aria-hidden>
                  <div className="h-[200px] rounded-xl bg-[#F9F8FD]" />
                </div>
              )}

              {ruta.length > 1 && (
                <div className="border-t border-[#F0EEF6] bg-[#FAFAFD] px-4 py-3 sm:px-5">
                  <p className={cn("mb-1 text-xs font-semibold tracking-wide uppercase", GRIS)}>Próximos</p>
                  <ul>
                    {ruta
                      .filter((s) => s.id !== actual.id)
                      .slice(0, 3)
                      .map((p) => (
                        <li key={p.id}>
                          <button type="button" onClick={() => irA(p.id)} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                            <AvatarSocio id={p.id} nombre={p.nombre} className="size-8 text-[10px]" />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nombre}</span>
                            <span className={cn("text-xs tabular-nums", porRepetirMap.has(p.id) ? "text-[#A32020]" : GRIS)}>{porRepetirMap.has(p.id) ? "por repetir" : p.numeroCliente ? `N° ${p.numeroCliente}` : ""}</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <InstalarApp compacto titulo="Lleva la app a terreno" descripcion="Carga lecturas en terreno, aunque no haya señal." />

          {rechazadas.length > 0 && (
            <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <h2 className="text-[0.95rem] font-semibold text-destructive">No se pudieron registrar</h2>
              <ul className="mt-2 flex flex-col gap-1 text-[0.85rem]">
                {rechazadas.map((r) => (
                  <li key={r.lectura.idLocal}>
                    {r.lectura.socioNombre} · {r.lectura.periodo} · lectura {r.lectura.valor}: {r.error}
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" className="mt-4" onClick={() => setRechazadas([])}>
                Entendido
              </Button>
            </section>
          )}
        </div>

        {/* ─── Mis lecturas ─── */}
        <section className={cn("flex-col gap-4 md:sticky md:top-4 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto", pestana === "historial" ? "flex" : "hidden md:flex")}>
          {porRepetir.length > 0 && (
            <div className={cn("overflow-hidden rounded-2xl bg-card", SOMBRA)}>
              <div className="flex items-center gap-2 border-b border-[#F6D3D2] bg-[#FFF5F5] px-4 py-3 sm:px-5">
                <RotateCcw className="size-4 text-[#A32020]" aria-hidden />
                <h2 className="flex-1 text-[15px] font-semibold text-[#8A1F1F]">
                  Por repetir <span className="font-normal">· {porRepetir.length}</span>
                </h2>
              </div>
              <ul className="divide-y divide-[#F3F1F8]">
                {porRepetir.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <AvatarSocio id={p.id} nombre={p.nombre} className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.nombre}</span>
                      <span className="block truncate text-xs text-[#A32020]">{porRepetirMap.get(p.id)?.motivo ?? "La directiva rechazó la lectura"}</span>
                    </span>
                    <Button size="sm" onClick={() => irA(p.id)} className="h-9 shrink-0 rounded-lg px-3 text-xs font-semibold">
                      Volver a leer
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={cn("overflow-hidden rounded-2xl bg-card", SOMBRA)}>
            <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4 sm:px-5">
              <h2 className="text-[15px] font-semibold">
                Tus lecturas de {nombreMes(periodo)} <span className={cn("font-normal", GRIS)}>· {delMes.length}</span>
              </h2>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input aria-label="Buscar entre tus lecturas" value={busquedaLecturas} onChange={(e) => setBusquedaLecturas(e.target.value)} placeholder="Buscar socio o mes" className="h-11 rounded-xl border-[#E4E1F0] bg-white pl-9 text-base shadow-none md:text-sm" />
              </div>
              <div role="tablist" aria-label="Filtro" className="grid grid-cols-2 gap-1 rounded-lg bg-[#F4F3F9] p-1">
                {(
                  [
                    ["todas", "Todas", delMes.length],
                    ["local", "Sin enviar", nSinEnviar],
                  ] as const
                ).map(([k, t, n]) => (
                  <button key={k} type="button" role="tab" aria-selected={vista === k} onClick={() => setVista(k)} className={cn("h-9 rounded-md text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", vista === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}>
                    {t} <span className={cn("text-xs font-medium tabular-nums", vista === k ? "text-[#6B46F5]" : "text-[#A19FB2]")}>{n}</span>
                  </button>
                ))}
              </div>
            </div>
            {mostradas.length > 0 ? (
              <ul className="divide-y divide-[#F3F1F8]">
                {mostradas.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <AvatarSocio id={l.socioId} nombre={l.socio} className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{l.socio}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        {l.estado === "LOCAL" ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#B86400]">
                            <Smartphone className="size-3" aria-hidden />
                            En el teléfono
                          </span>
                        ) : l.estado === "APROBADA" ? (
                          <span className="inline-flex items-center gap-1 font-medium text-[#075A3C]">
                            <CheckCircle2 className="size-3" aria-hidden />
                            Aprobada
                          </span>
                        ) : l.estado === "RECHAZADA" ? (
                          <span className="inline-flex items-center gap-1 font-medium text-[#A32020]">
                            <XCircle className="size-3" aria-hidden />
                            Rechazada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-[#B86400]">
                            <Clock3 className="size-3" aria-hidden />
                            Enviada · por revisar
                          </span>
                        )}
                        {buscandoLecturas && <span className={GRIS}>{formatearPeriodo(l.periodo)}</span>}
                      </span>
                      {l.estado === "RECHAZADA" && l.motivo && <span className="mt-1 block text-xs text-[#A32020]">Motivo: {l.motivo}</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[15px] font-semibold tabular-nums">{miles(l.valor)}</span>
                      <span className={cn("block text-xs tabular-nums", GRIS)}>{l.consumo === null ? "inicial" : `${l.consumo > 0 ? "+" : ""}${miles(l.consumo)} m³`}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn("px-6 py-12 text-center text-sm", GRIS)}>
                {items.length === 0 ? "Todavía no has cargado lecturas." : vista === "local" ? "Todo enviado." : buscandoLecturas ? "Ninguna lectura coincide con la búsqueda." : `No hay lecturas tuyas en ${formatearPeriodo(periodo)}.`}
              </p>
            )}
          </div>
        </section>
      </div>

      {buscando && (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Cerrar búsqueda" onClick={() => setBuscando(false)} className="absolute inset-0 bg-[#15132B]/35" />
          <div role="dialog" aria-modal="true" aria-label="Buscar socio de la ruta" className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white sm:inset-x-auto sm:top-24 sm:bottom-auto sm:left-1/2 sm:w-[460px] sm:-translate-x-1/2 sm:rounded-2xl">
            <div className="flex items-center gap-2 border-b border-[#F0EEF6] p-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input autoFocus aria-label="Buscar socio" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nombre, RUT o N° de cliente" className="h-11 rounded-xl border-[#E4E1F0] pl-9 text-base shadow-none md:text-sm" />
              </div>
              <Button variant="ghost" onClick={() => setBuscando(false)} className="h-11 rounded-xl px-3 font-semibold">
                Cerrar
              </Button>
            </div>
            <p className={cn("px-4 pt-3 text-xs font-semibold tracking-wide uppercase", GRIS)}>Pendientes en tu ruta · {pendientes.length}</p>
            <ul className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-4">
              {encontrados.slice(0, 80).map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => irA(p.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-[#F8F7FC] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    <AvatarSocio id={p.id} nombre={p.nombre} className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.nombre}</span>
                      <span className={cn("block text-xs", porRepetirMap.has(p.id) ? "text-[#A32020]" : GRIS)}>
                        {p.numeroCliente ? `N° ${p.numeroCliente}` : "Sin número"}
                        {porRepetirMap.has(p.id) ? " · por repetir" : p.anterior ? ` · ant. ${miles(p.anterior.valor)}` : " · primera lectura"}
                      </span>
                    </span>
                    {p.id === actual?.id ? <span className="text-xs font-semibold text-[#2A07A8]">Actual</span> : <ChevronRight className="size-4 text-[#B4B2C4]" aria-hidden />}
                  </button>
                </li>
              ))}
              {encontrados.length === 0 && <li className={cn("px-3 py-8 text-center text-sm", GRIS)}>{busca.trim() ? "Ningún socio pendiente coincide." : "No quedan socios pendientes."}</li>}
              {encontrados.length > 80 && <li className={cn("px-3 py-3 text-center text-xs", GRIS)}>Se muestran los primeros 80. Escribe para acotar.</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Barra de pestañas fija abajo, como una app nativa. El relleno inferior
          respeta la barra de gestos de iPhone. */}
      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E4E0F2] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid w-full max-w-[480px] grid-cols-2">
          {(
            [
              { id: "cargar", label: "Cargar", icono: Droplets, badge: 0 },
              { id: "historial", label: "Mis lecturas", icono: ClipboardList, badge: nBadge },
            ] as const
          ).map(({ id, label, icono: Icono, badge }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPestana(id)}
              aria-current={pestana === id ? "page" : undefined}
              className={cn("relative flex min-h-[62px] flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset", pestana === id ? "text-primary" : "text-[#55526A]")}
            >
              {pestana === id && <span aria-hidden className="absolute inset-x-10 top-0 h-[3px] rounded-b-full bg-primary" />}
              <span className="relative">
                <Icono className="size-5" aria-hidden />
                {badge > 0 && <span className="absolute -top-1.5 -right-2.5 flex size-4 items-center justify-center rounded-full bg-[#E58200] text-[10px] font-bold text-white">{badge}</span>}
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
