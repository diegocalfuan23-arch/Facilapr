"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Droplets,
  Loader2,
  MessageSquarePlus,
  PartyPopper,
  Search,
  SkipForward,
  Users,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";
import { registrarLectura } from "@/app/panel/lecturas/actions";
import { InstalarApp } from "@/components/socio/instalar-app";
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
import { formatearRut, iniciales } from "@/lib/formato";
import type { OpcionSocio } from "@/components/panel/socio-buscador";

/** `anterior`: la última lectura aprobada del socio (o, si no tiene, la de su última boleta): la base del consumo. */
type Socio = OpcionSocio & {
  anterior: { valor: number; periodo: string; origen: "LECTURA" | "BOLETA" } | null;
};

type LecturaReciente = {
  id: string;
  socio: string;
  periodo: string;
  valor: number;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  motivoRechazo: string | null;
};

/** Quién ya tiene lectura en un mes (pendiente o aprobada), la haya cargado quien la haya cargado. */
type LecturaDelMes = { socioId: string; periodo: string; estado: "PENDIENTE" | "APROBADA" };

type EstadoForm = { ok: true; enCola?: boolean } | { ok: false; error: string };

/** Lecturas que el servidor rechazó al sincronizar (p. ej. período inválido). */
type Rechazada = { lectura: LecturaEnCola; error: string };

const ESTADO_META = {
  PENDIENTE: { texto: "Por revisar", icono: Clock, color: "text-amber-700 dark:text-amber-300" },
  APROBADA: { texto: "Aprobada", icono: CheckCircle2, color: "text-emerald-700 dark:text-emerald-400" },
  RECHAZADA: { texto: "Rechazada", icono: XCircle, color: "text-destructive" },
} as const;

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const miles = (n: number) => n.toLocaleString("es-CL");
const clave = (socioId: string, periodo: string) => `${socioId}|${periodo}`;

const periodoActual = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
};

/** "6.688.154-7 · N.º 3 · Usuario": lo que distingue a un arranque de otro. */
function detalle(s: OpcionSocio) {
  return [s.rut ? formatearRut(s.rut) : "Sin RUT", s.numeroCliente ? `N.º ${s.numeroCliente}` : null, s.tipo === "USUARIO" ? "Usuario" : null].filter(Boolean).join(" · ");
}

function SinSocios({ puedeCargar }: { puedeCargar: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Users className="size-5 text-muted-foreground" />
      </span>
      <h1 className="mt-4 text-[1.1rem] font-semibold">Aún no tienes socios cargados</h1>
      <p className="mt-2 max-w-[42ch] text-[0.92rem] leading-relaxed text-muted-foreground">
        {puedeCargar
          ? "Para tomar lecturas primero hay que cargar el padrón: los socios y usuarios de tu comité."
          : "La directiva todavía no cargó los socios del comité. Avísale para poder tomar lecturas."}
      </p>
      {puedeCargar && (
        <Link href="/panel/socios" className={cn(buttonVariants(), "mt-5")}>
          Cargar socios
        </Link>
      )}
    </div>
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
  const [pestana, setPestana] = useState<"cargar" | "historial">("cargar");
  const [periodo, setPeriodo] = useState(periodoActual);
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [saltados, setSaltados] = useState<string[]>([]);
  const [valorTxt, setValorTxt] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [busca, setBusca] = useState("");
  const [conObs, setConObs] = useState(false);
  const [obs, setObs] = useState("");
  // Lo que se cargó en esta sesión: cuenta de inmediato en la ruta, sin esperar a recargar.
  const [marcados, setMarcados] = useState<string[]>([]);
  const [ultimo, setUltimo] = useState<{ nombre: string; enCola: boolean } | null>(null);
  const [rechazadas, setRechazadas] = useState<Rechazada[]>([]);

  const crudoCola = useSyncExternalStore(suscribirCola, snapshotCola, () => COLA_VACIA);
  const cola = useMemo(() => parsearCola(crudoCola), [crudoCola]);
  const enLinea = useSyncExternalStore(suscribirConexion, hayConexion, () => true);

  // Buscador de "Tus lecturas": por socio, mes, estado o número de lectura.
  const [busquedaLecturas, setBusquedaLecturas] = useState("");
  const [vista, setVista] = useState<"todas" | "PENDIENTE">("todas");

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
  const ruta = pendientes.filter((s) => !saltados.includes(s.id));
  const elegido = elegidoId ? (socios.find((s) => s.id === elegidoId) ?? null) : null;
  const actual = elegido ?? ruta[0] ?? pendientes[0] ?? null;
  const pct = socios.length ? Math.round((leidosN / socios.length) * 100) : 0;

  // Consumo en vivo: lo que se escribe menos la última aprobada. Solo orienta; la directiva revisa antes de generar la boleta.
  const anterior = actual?.anterior ?? null;
  const numeroActual = valorTxt === "" ? null : Number(valorTxt);
  // Sin lectura anterior no hay consumo que mostrar: sería el medidor completo.
  const consumo = numeroActual !== null && anterior ? numeroActual - anterior.valor : null;
  const menor = consumo !== null && consumo < 0;
  const yaLeido = actual ? (estadoPorClave.get(clave(actual.id, periodo)) ?? null) : null;
  // El servidor no admite una segunda lectura mientras la primera sigue por revisar.
  const bloqueado = yaLeido === "PENDIENTE";
  const puede = !!actual && numeroActual !== null && periodoValido && !bloqueado;

  const encontrados = useMemo(() => {
    const t = sinTildes(busca.trim());
    if (!t) return [];
    return socios.filter((s) => sinTildes(`${s.nombre} ${s.rut ?? ""} ${s.rut ? formatearRut(s.rut) : ""} ${s.numeroCliente ?? ""}`).includes(t)).slice(0, 6);
  }, [socios, busca]);

  const recientesFiltradas = useMemo(() => {
    const q = sinTildes(busquedaLecturas.trim());
    return recientes.filter((l) => (vista === "todas" || l.estado === "PENDIENTE") && (!q || sinTildes(`${l.socio} ${l.periodo} ${formatearPeriodo(l.periodo)} ${ESTADO_META[l.estado].texto} ${l.valor}`).includes(q)));
  }, [recientes, busquedaLecturas, vista]);
  const nPorRevisar = recientes.filter((l) => l.estado === "PENDIENTE").length;

  function limpiar() {
    setValorTxt("");
    setObs("");
    setConObs(false);
    setElegidoId(null);
    setBuscando(false);
    setBusca("");
  }

  function saltar() {
    if (!actual) return;
    setSaltados((s) => (pendientes.every((p) => s.includes(p.id) || p.id === actual.id) ? [] : [...s, actual.id]));
    limpiar();
    setUltimo(null);
  }

  function guardarSinConexion(formData: FormData): EstadoForm {
    const socioId = String(formData.get("socioId") ?? "");
    const guardada = encolarLectura({
      socioId,
      socioNombre: socios.find((s) => s.id === socioId)?.nombre ?? "Socio",
      periodo: String(formData.get("periodo") ?? ""),
      valor: String(formData.get("valor") ?? ""),
      observacion: String(formData.get("observacion") ?? ""),
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
    let enviadas = 0;
    try {
      for (const lectura of parsearCola(snapshotCola())) {
        const datos = new FormData();
        datos.set("socioId", lectura.socioId);
        datos.set("periodo", lectura.periodo);
        datos.set("valor", lectura.valor);
        if (lectura.observacion) datos.set("observacion", lectura.observacion);

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
    }
    if (enviadas > 0) router.refresh();
  }

  // Al volver la señal (o al abrir la pantalla con conexión) se vacía la cola.
  useEffect(() => {
    if (enLinea && cola.length > 0) void enviarCola();
    // enviarCola solo usa refs y el store local: no depende del render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enLinea, cola.length]);

  // Sin padrón no hay a quién tomarle la lectura: se dice claro, en vez de un
  // buscador que parece roto ("Ningún socio coincide").
  if (socios.length === 0) {
    return <SinSocios puedeCargar={puedeCargarSocios} />;
  }

  const buscador = (
    <div className="mt-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Buscar socio" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nombre, RUT o N.º" className="h-12 rounded-full pl-11 text-base md:h-11 md:text-sm" autoFocus={buscando} />
      </div>
      {encontrados.length > 0 && (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {encontrados.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setElegidoId(s.id);
                  setBuscando(false);
                  setBusca("");
                  setValorTxt("");
                }}
                className="flex min-h-12 w-full items-center justify-between gap-4 px-4 py-2 text-left hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.95rem] font-semibold">{s.nombre}</span>
                  <span className="block truncate text-[0.75rem] text-muted-foreground">{detalle(s)}</span>
                </span>
                {estadoPorClave.has(clave(s.id, periodo)) && <span className="shrink-0 text-[0.75rem] font-semibold text-emerald-700 dark:text-emerald-400">Ya leído</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {busca.trim() && encontrados.length === 0 && <p className="mt-2 text-[0.85rem] text-muted-foreground">Ningún socio coincide.</p>}
    </div>
  );

  return (
    <>
      {/* Celular: una pestaña a la vez, como app. Escritorio (md:): dos columnas, el
          formulario a la izquierda y las últimas lecturas a la derecha, para que la
          página no se alargue. */}
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 pb-20 md:grid md:max-w-[1080px] md:grid-cols-[minmax(0,540px)_minmax(0,1fr)] md:items-start md:gap-8 md:pb-0">
        <div className={cn("flex-col gap-4", pestana === "cargar" ? "flex" : "hidden md:flex")}>
          <InstalarApp titulo="Lleva la app a terreno" descripcion="Instálala en tu celular: abre más rápido y puedes cargar lecturas aunque no haya señal." />

          {!enLinea && (
            <div className="flex items-start gap-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
              <p className="text-[0.88rem] leading-relaxed">
                <strong>Sin conexión.</strong> Sigue cargando lecturas: quedan guardadas en este teléfono y se envían solas cuando vuelva la señal.
              </p>
            </div>
          )}

          {/* La ruta del mes: cuántos socios llevas leídos. */}
          <section aria-label="Ruta del mes" className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-4 text-primary-foreground shadow-lg shadow-primary/30">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <label htmlFor="terreno-periodo" className="text-[0.8rem] font-medium text-white/85">
                  Ruta de {formatearPeriodo(periodo)}
                </label>
                <p className="text-[1.65rem] leading-tight font-bold tabular-nums">
                  {leidosN} <span className="text-base font-semibold text-white/85">de {socios.length} socios</span>
                </p>
              </div>
              <div className="relative shrink-0">
                <span className="flex h-11 items-center gap-1 rounded-full bg-white/20 px-4 text-[0.8rem] font-semibold">
                  Cambiar mes
                  <ChevronDown className="size-4" aria-hidden />
                </span>
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
                  className="absolute inset-0 w-full opacity-0"
                />
              </div>
            </div>
            <div role="img" aria-label={`${pct}% de la ruta leída`} className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-[0.8rem] font-medium text-white/90">{pendientes.length === 0 ? "Ruta completa" : `Faltan ${pendientes.length} socios`}</p>
          </section>

          {ultimo && (
            <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-[0.8rem] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{ultimo.enCola ? `${ultimo.nombre}: guardada en este teléfono, se envía al volver la señal` : `${ultimo.nombre} registrado, pendiente de revisión`}</span>
            </p>
          )}

          {estado && !estado.ok && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[0.88rem] text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {estado.error}
            </p>
          )}

          {!actual ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-md shadow-primary/10">
              <PartyPopper className="size-9 text-primary" aria-hidden />
              <p className="text-lg font-bold">Ruta completa</p>
              <p className="text-sm text-muted-foreground">Todos los socios tienen lectura en {formatearPeriodo(periodo)}.</p>
              <div className="w-full text-left">{buscador}</div>
            </div>
          ) : (
            <form action={accion} className="rounded-2xl border border-border bg-card p-4 shadow-md shadow-primary/10">
              <input type="hidden" name="socioId" value={actual.id} />
              <input type="hidden" name="periodo" value={periodo} />
              <input type="hidden" name="valor" value={valorTxt} />
              <input type="hidden" name="observacion" value={obs} />

              <div className="flex items-center gap-4">
                <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-sky-700 text-[0.95rem] font-bold text-white">
                  {iniciales(actual.nombre)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8rem] font-semibold text-muted-foreground">{elegido ? "Socio elegido" : "Siguiente socio"}</p>
                  <p className="text-[1.05rem] leading-snug font-bold">{actual.nombre}</p>
                  <p className="truncate text-[0.75rem] text-muted-foreground">{detalle(actual)}</p>
                </div>
                <Button type="button" variant="outline" size="icon" aria-label={buscando ? "Cerrar búsqueda" : "Buscar otro socio"} aria-expanded={buscando} onClick={() => setBuscando((v) => !v)} className="size-11 shrink-0 rounded-full">
                  {buscando ? <X /> : <Search />}
                </Button>
              </div>

              {buscando && buscador}

              {/* El medidor: el número grande, para leerlo de pie y con una mano. */}
              <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white">
                <div className="flex items-center justify-between text-[0.8rem] font-medium text-white/75">
                  <label htmlFor="terreno-lectura">Lectura del medidor</label>
                  <span>m³</span>
                </div>
                <input
                  id="terreno-lectura"
                  inputMode="numeric"
                  autoComplete="off"
                  value={valorTxt}
                  onChange={(e) => setValorTxt(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder={anterior ? String(anterior.valor) : "0000"}
                  className="mt-1 w-full bg-transparent text-center text-[2.75rem] leading-tight font-bold tracking-[0.12em] text-white tabular-nums caret-violet-300 outline-none placeholder:text-white/30"
                />
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/15 pt-2 text-center">
                  <div>
                    <p className="text-[0.75rem] text-white/75">Anterior</p>
                    <p className="text-[0.95rem] font-bold tabular-nums">{anterior ? miles(anterior.valor) : "Sin registro"}</p>
                    {anterior && (
                      <p className="text-[0.7rem] text-white/60">
                        {formatearPeriodo(anterior.periodo)}
                        {anterior.origen === "BOLETA" ? " · su boleta" : ""}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[0.75rem] text-white/75">Consumo</p>
                    <p className={cn("text-[0.95rem] font-bold tabular-nums", menor ? "text-red-300" : "text-emerald-300")}>{consumo === null ? "—" : `${miles(consumo)} m³`}</p>
                  </div>
                </div>
              </div>

              {!anterior && <p className="mt-2 text-[0.8rem] text-muted-foreground">Primera lectura: la directiva la usa como punto de partida.</p>}

              {bloqueado ? (
                <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-2 text-[0.8rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Este socio ya tiene una lectura por revisar en {formatearPeriodo(periodo)}. Espera a que se revise antes de cargar otra.
                </p>
              ) : yaLeido === "APROBADA" ? (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-2 text-[0.8rem] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Este socio ya tiene su lectura de {formatearPeriodo(periodo)} aprobada.
                </p>
              ) : menor ? (
                <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-2 text-[0.8rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  La lectura es menor que la anterior ({miles(anterior?.valor ?? 0)}). Revísala antes de enviar.
                </p>
              ) : null}

              {conObs ? (
                <Textarea aria-label="Observación" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} maxLength={300} placeholder="Medidor con humedad, difícil de leer con precisión" className="mt-4 min-h-16 text-base md:text-sm" />
              ) : (
                <button type="button" onClick={() => setConObs(true)} className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
                  <MessageSquarePlus className="size-4" aria-hidden />
                  Agregar observación
                </button>
              )}

              <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
                <Button type="button" variant="outline" onClick={saltar} className="h-12 rounded-full px-4 font-semibold">
                  <SkipForward />
                  Saltar
                </Button>
                <Button type="submit" disabled={!puede || pendiente} className="h-12 rounded-full text-[0.95rem] font-semibold shadow-md shadow-primary/30">
                  {pendiente && <Loader2 className="animate-spin" />}
                  Registrar y seguir
                </Button>
              </div>
            </form>
          )}

          {cola.length > 0 && (
            <section className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[0.95rem] font-semibold">
                  {cola.length} {cola.length === 1 ? "lectura esperando" : "lecturas esperando"} envío
                </h2>
                <Button type="button" variant="outline" disabled={!enLinea} onClick={() => void enviarCola()}>
                  Enviar ahora
                </Button>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-[0.85rem] text-muted-foreground">
                {cola.map((l) => (
                  <li key={l.idLocal}>
                    {l.socioNombre} · {l.periodo} · lectura {l.valor}
                  </li>
                ))}
              </ul>
            </section>
          )}

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

        <section className={cn("flex-col gap-4 md:sticky md:top-4 md:-m-1.5 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto md:p-1.5", pestana === "historial" ? "flex" : "hidden md:flex")}>
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight md:text-[1.1rem]">Tus lecturas</h1>
          {recientes.length > 0 && (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={busquedaLecturas}
                  onChange={(e) => setBusquedaLecturas(e.target.value)}
                  placeholder="Buscar por socio, mes o estado"
                  aria-label="Buscar entre tus lecturas"
                  className="h-12 rounded-full pl-11 text-base md:h-11 md:text-sm"
                />
              </div>
              <div role="group" aria-label="Filtrar lecturas" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
                {[
                  { id: "todas" as const, nombre: `Todas ${recientes.length}` },
                  { id: "PENDIENTE" as const, nombre: `Por revisar ${nPorRevisar}` },
                ].map((f) => (
                  <button key={f.id} type="button" aria-pressed={vista === f.id} onClick={() => setVista(f.id)} className={cn("h-10 rounded-full text-sm font-semibold", vista === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                    {f.nombre}
                  </button>
                ))}
              </div>
            </>
          )}
          {recientes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-[0.9rem] text-muted-foreground">Todavía no has cargado lecturas.</p>
          ) : recientesFiltradas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-[0.9rem] text-muted-foreground">
              {vista === "PENDIENTE" && !busquedaLecturas.trim() ? "No tienes lecturas por revisar." : "Ninguna lectura coincide con la búsqueda."}
            </p>
          ) : (
            Array.from(new Set(recientesFiltradas.map((l) => l.periodo))).map((p) => (
              <div key={p}>
                <h2 className="px-1 pb-2 text-sm font-bold">
                  {formatearPeriodo(p)} <span className="font-medium text-muted-foreground">· {recientesFiltradas.filter((l) => l.periodo === p).length}</span>
                </h2>
                <div className="flex flex-col gap-2">
                  {recientesFiltradas
                    .filter((l) => l.periodo === p)
                    .map((l) => {
                      const meta = ESTADO_META[l.estado];
                      const Icono = meta.icono;
                      return (
                        <div key={l.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 shadow-sm shadow-primary/10">
                          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.8rem] font-bold text-primary">
                            {iniciales(l.socio)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.95rem] font-semibold">{l.socio}</p>
                            <p className={cn("flex items-center gap-1 text-[0.8rem] font-medium", meta.color)}>
                              <Icono className="size-3.5" aria-hidden />
                              {meta.texto}
                            </p>
                            {l.estado === "RECHAZADA" && l.motivoRechazo && <p className="mt-1 text-[0.8rem] text-muted-foreground">Motivo: {l.motivoRechazo}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[1.05rem] leading-tight font-bold tabular-nums">{miles(l.valor)}</p>
                            <p className="text-[0.75rem] text-muted-foreground">m³ medidor</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Barra de pestañas fija abajo, como una app nativa. El relleno inferior
          respeta la barra de gestos de iPhone. */}
      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid w-full max-w-[480px] grid-cols-2">
          {(
            [
              { id: "cargar", label: "Cargar", icono: Droplets },
              { id: "historial", label: "Mis lecturas", icono: ClipboardList },
            ] as const
          ).map(({ id, label, icono: Icono }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPestana(id)}
              aria-current={pestana === id ? "page" : undefined}
              className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[0.75rem] font-medium transition-colors", pestana === id ? "text-primary" : "text-muted-foreground")}
            >
              <Icono className="size-5.5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
