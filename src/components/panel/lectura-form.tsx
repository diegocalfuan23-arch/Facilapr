"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Droplets,
  Loader2,
  Search,
  Users,
  WifiOff,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatearPeriodo } from "@/lib/boletas";
import { SocioBuscador, type OpcionSocio } from "@/components/panel/socio-buscador";

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

type EstadoForm =
  | { ok: true; enCola?: boolean }
  | { ok: false; error: string };

/** Lecturas que el servidor rechazó al sincronizar (p. ej. período inválido). */
type Rechazada = { lectura: LecturaEnCola; error: string };

const ESTADO_META = {
  PENDIENTE: { texto: "Pendiente de revisión", icono: Clock, color: "text-tertiary-texto" },
  APROBADA: { texto: "Aprobada", icono: CheckCircle2, color: "text-forest" },
  RECHAZADA: { texto: "Rechazada", icono: XCircle, color: "text-destructive" },
} as const;

// Controles grandes: se usan de pie, con una mano y a veces con guantes. Con
// text-base (16px) iOS tampoco hace zoom al tocar un campo.
// En escritorio vuelven al tamaño normal del panel (md:).
const CAMPO = "h-12 text-base md:h-8 md:text-sm";

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const numero = new Intl.NumberFormat("es-CL");

const periodoActual = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
};

function SinSocios({ puedeCargar }: { puedeCargar: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Users className="size-5 text-muted-foreground" />
      </span>
      <h1 className="mt-4 text-[1.1rem] font-semibold">
        Aún no tienes socios cargados
      </h1>
      <p className="mt-2 max-w-[42ch] text-[0.92rem] leading-relaxed text-muted-foreground">
        {puedeCargar
          ? "Para tomar lecturas primero hay que cargar el padrón: los socios y usuarios de tu comité."
          : "La directiva todavía no cargó los socios del comité. Avísale para poder tomar lecturas."}
      </p>
      {puedeCargar && (
        <Link
          href="/panel/socios"
          className={cn(buttonVariants(), "mt-5")}
        >
          Cargar socios
        </Link>
      )}
    </div>
  );
}

export function LecturaForm({
  socios,
  recientes,
  puedeCargarSocios = false,
}: {
  socios: Socio[];
  recientes: LecturaReciente[];
  /** La directiva puede ir a cargar el padrón; el operador solo avisarle. */
  puedeCargarSocios?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const enviandoCola = useRef(false);
  const [pestana, setPestana] = useState<"cargar" | "historial">("cargar");
  // Cambiar la clave vuelve a montar el buscador de socio tras cada envío.
  const [claveForm, setClaveForm] = useState(0);
  const [socio, setSocio] = useState<Socio | null>(null);
  const [valorTxt, setValorTxt] = useState("");
  const [rechazadas, setRechazadas] = useState<Rechazada[]>([]);

  const crudoCola = useSyncExternalStore(
    suscribirCola,
    snapshotCola,
    () => COLA_VACIA
  );
  const cola = useMemo(() => parsearCola(crudoCola), [crudoCola]);
  const enLinea = useSyncExternalStore(suscribirConexion, hayConexion, () => true);

  // Consumo en vivo: lo que el técnico escribe menos la última aprobada.
  // Solo orienta; el administrador sigue revisando antes de generar la boleta.
  const anterior = socio?.anterior ?? null;

  // Buscador de "Tus lecturas": por socio, mes, estado o número de lectura.
  const [busquedaLecturas, setBusquedaLecturas] = useState("");
  const recientesFiltradas = useMemo(() => {
    const q = sinTildes(busquedaLecturas.trim());
    if (!q) return recientes;
    return recientes.filter((l) =>
      sinTildes(`${l.socio} ${l.periodo} ${ESTADO_META[l.estado].texto} ${l.valor}`).includes(q)
    );
  }, [recientes, busquedaLecturas]);
  const actual = valorTxt === "" ? null : Number(valorTxt);
  // Sin lectura anterior no hay consumo que mostrar: sería el medidor completo.
  const consumo = actual !== null && anterior ? actual - anterior.valor : null;

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
          error:
            "No hay señal y este teléfono no dejó guardar la lectura. Anótala y envíala cuando tengas conexión.",
        };
  }

  const [estado, accion, pendiente] = useActionState<EstadoForm | null, FormData>(
    async (_prev, formData) => {
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
    },
    null
  );

  useEffect(() => {
    if (!estado?.ok) return;
    formRef.current?.reset();
    // Una vibración corta confirma el guardado sin mirar la pantalla.
    navigator.vibrate?.(40);
  }, [estado]);

  // El service worker deja abierta esta pantalla sin señal. Sin soporte o con
  // un fallo al registrarlo, el formulario sigue funcionando: solo no abre
  // offline desde cero.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/panel/lecturas" })
      .catch(() => {});
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

  return (
    <>
      {/* Celular: una pestaña a la vez, como app. Escritorio (md:): dos columnas, el
          formulario a la izquierda y las últimas lecturas a la derecha, para que la
          página no se alargue. */}
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 pb-20 md:grid md:max-w-[1080px] md:grid-cols-[minmax(0,540px)_minmax(0,1fr)] md:items-start md:gap-8 md:pb-0">
        <div
          className={cn(
            "flex-col gap-4",
            pestana === "cargar" ? "flex" : "hidden md:flex"
          )}
        >
          <div>
            <h1 className="text-[1.5rem] font-semibold tracking-tight md:text-[1.35rem]">
              Cargar lectura
            </h1>
            <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
              Queda pendiente hasta que el administrador la revise.
            </p>
          </div>

          <InstalarApp
            titulo="Lleva la app a terreno"
            descripcion="Instálala en tu celular: abre más rápido y puedes cargar lecturas aunque no haya señal."
          />

          {!enLinea && (
            <div className="flex items-start gap-2.5 rounded-xl border border-tertiary/40 bg-tertiary/10 px-4 py-3">
              <WifiOff className="mt-0.5 size-4 shrink-0 text-tertiary" />
              <p className="text-[0.88rem] leading-relaxed">
                <strong>Sin conexión.</strong> Sigue cargando lecturas: quedan
                guardadas en este teléfono y se envían solas cuando vuelva la
                señal.
              </p>
            </div>
          )}

          <form
            ref={formRef}
            action={accion}
            onReset={() => {
              setClaveForm((k) => k + 1);
              setSocio(null);
              setValorTxt("");
            }}
            className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:rounded-xl md:p-5"
          >
            <SocioBuscador
              key={claveForm}
              socios={socios}
              className={CAMPO}
              onElegir={(s) => setSocio(socios.find((x) => x.id === s?.id) ?? null)}
            />

            {socio && (
              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
                <span className="text-[0.85rem] text-muted-foreground">
                  Lectura anterior
                </span>
                {anterior ? (
                  <span className="text-right">
                    <span className="text-[1.15rem] font-semibold tabular-nums">
                      {numero.format(anterior.valor)}
                    </span>
                    <span className="block text-[0.75rem] text-muted-foreground">
                      {formatearPeriodo(anterior.periodo)}
                      {anterior.origen === "BOLETA" ? " · según su boleta" : ""}
                    </span>
                  </span>
                ) : (
                  <span className="text-right text-[0.82rem] text-muted-foreground">
                    Primera lectura: la directiva la usa como punto de partida
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="periodo">Período</Label>
                <Input
                  id="periodo"
                  name="periodo"
                  defaultValue={periodoActual()}
                  placeholder="2026-07"
                  required
                  className={CAMPO}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="valor">Lectura actual</Label>
                <Input
                  id="valor"
                  name="valor"
                  inputMode="numeric"
                  placeholder="1250"
                  required
                  value={valorTxt}
                  onChange={(e) =>
                    setValorTxt(e.target.value.replace(/[^\d]/g, ""))
                  }
                  className={cn(CAMPO, "font-semibold tabular-nums")}
                />
              </div>
            </div>

            {consumo !== null &&
              (consumo < 0 ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[0.88rem] text-destructive">
                  Es menor que la anterior ({numero.format(anterior?.valor ?? 0)}
                  ). Revisa el número antes de enviar.
                </p>
              ) : (
                <p className="rounded-lg border border-forest/30 bg-forest/5 px-4 py-3 text-[0.88rem] text-forest">
                  Consumo: <strong className="tabular-nums">{numero.format(consumo)} m³</strong>
                </p>
              ))}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="observacion">Observación (opcional)</Label>
              <Textarea
                id="observacion"
                name="observacion"
                rows={2}
                maxLength={300}
                placeholder="Medidor con humedad, difícil de leer con precisión…"
                className="text-base md:text-sm"
              />
            </div>

            {estado && !estado.ok && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[0.88rem] text-destructive">
                {estado.error}
              </p>
            )}
            {estado?.ok && (
              <p className="rounded-lg border border-forest/30 bg-forest/5 px-4 py-3 text-[0.88rem] text-forest">
                {estado.enCola
                  ? "Guardada en este teléfono. Se enviará sola cuando vuelva la señal."
                  : "Lectura registrada. Queda pendiente de revisión."}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={pendiente}
              className="h-12 w-full text-base md:h-8 md:text-sm"
            >
              {pendiente && <Loader2 className="animate-spin" />}
              Registrar lectura
            </Button>
          </form>

          {cola.length > 0 && (
            <section className="rounded-2xl border border-tertiary/40 bg-tertiary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[0.95rem] font-semibold">
                  {cola.length}{" "}
                  {cola.length === 1 ? "lectura esperando" : "lecturas esperando"}{" "}
                  envío
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!enLinea}
                  onClick={() => void enviarCola()}
                >
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
              <h2 className="text-[0.95rem] font-semibold text-destructive">
                No se pudieron registrar
              </h2>
              <ul className="mt-2 flex flex-col gap-1 text-[0.85rem]">
                {rechazadas.map((r) => (
                  <li key={r.lectura.idLocal}>
                    {r.lectura.socioNombre} · {r.lectura.periodo} · lectura{" "}
                    {r.lectura.valor}: {r.error}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => setRechazadas([])}
              >
                Entendido
              </Button>
            </section>
          )}
        </div>

        <section
          className={cn(
            "flex-col gap-4 md:sticky md:top-4 md:-m-1.5 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto md:p-1.5",
            pestana === "historial" ? "flex" : "hidden md:flex"
          )}
        >
          <h1 className="text-[1.5rem] font-semibold tracking-tight md:text-[0.95rem]">
            Tus lecturas
          </h1>
          {recientes.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busquedaLecturas}
                onChange={(e) => setBusquedaLecturas(e.target.value)}
                placeholder="Buscar por socio, mes o estado…"
                aria-label="Buscar entre tus lecturas"
                className={cn("pl-9", CAMPO)}
              />
            </div>
          )}
          {recientes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-[0.9rem] text-muted-foreground">
              Todavía no has cargado lecturas.
            </p>
          ) : recientesFiltradas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-[0.9rem] text-muted-foreground">
              Ninguna lectura coincide con la búsqueda.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
              {recientesFiltradas.map((l) => {
                const meta = ESTADO_META[l.estado];
                const Icono = meta.icono;
                return (
                  <div key={l.id} className="flex items-start gap-3 p-4">
                    <Icono className={cn("mt-0.5 size-5 shrink-0", meta.color)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="truncate text-[0.95rem] font-medium">
                          {l.socio}
                        </span>
                        <span className="text-[0.82rem] text-muted-foreground">
                          {l.periodo}
                        </span>
                      </div>
                      <div className={cn("text-[0.85rem]", meta.color)}>
                        {meta.texto} · lectura {l.valor}
                      </div>
                      {l.estado === "RECHAZADA" && l.motivoRechazo && (
                        <p className="mt-1 text-[0.85rem] text-muted-foreground">
                          Motivo: {l.motivoRechazo}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Barra de pestañas fija abajo, como una app nativa. El relleno inferior
          respeta la barra de gestos de iPhone. */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-30 md:hidden border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
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
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-[0.75rem] font-medium transition-colors",
                pestana === id ? "text-primary" : "text-muted-foreground"
              )}
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
