"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, Clock3, Droplets, Gauge, Hammer, Loader2, MapPin, Package, Plus, Route, Trash2, UserRound, Wrench, X, type LucideIcon } from "lucide-react";
import { eliminarLabor, guardarLabor, type ResultadoLabores } from "@/app/panel/labores/actions";
import { avisarCambio } from "@/lib/avisos-datos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { formatoCantidad, unidadCorta, type Insumo } from "@/lib/inventario-comun";
import { TIPOS_LABOR, textoTipoLabor, type EstadoLabor, type LaborFila, type RutaOpcion } from "@/lib/labores-comun";
import { cn } from "@/lib/utils";

const GRIS = "text-[#5B5970]";
const CAMPO = "h-11 rounded-xl border-[#E4E1F0] bg-white shadow-none";
const SELECT = "h-11 w-full rounded-xl border border-[#E4E1F0] bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

/** El ícono y el color de cada tipo de labor. */
const TIPO: Record<string, { icono: LucideIcon; tono: string }> = {
  MANTENCION: { icono: Wrench, tono: "bg-[#EEF0F6] text-[#3F4A66]" },
  REPARACION: { icono: Hammer, tono: "bg-[#FFF0EA] text-[#B4441A]" },
  INSTALACION: { icono: Wrench, tono: "bg-[#E7F4FB] text-[#0B6A9E]" },
  LIMPIEZA: { icono: Droplets, tono: "bg-[#E6F6EF] text-[#0A7A52]" },
  CLORACION: { icono: Droplets, tono: "bg-[#E3F5F8] text-[#0A7285]" },
  LECTURA: { icono: Gauge, tono: "bg-[#ECE8FD] text-[#3A0CE3]" },
  OTRO: { icono: ClipboardList, tono: "bg-[#F1F0F5] text-[#46435C]" },
};

const ESTADOS: { valor: EstadoLabor; nombre: string; icono: LucideIcon; activo: string }[] = [
  { valor: "PROGRAMADA", nombre: "Programada", icono: CalendarClock, activo: "bg-white text-[#0A5F91] shadow-sm ring-1 ring-[#BFE3F7]" },
  { valor: "EN_CURSO", nombre: "En curso", icono: Clock3, activo: "bg-white text-[#8F4400] shadow-sm ring-1 ring-[#F6D9B0]" },
  { valor: "HECHA", nombre: "Hecha", icono: CheckCircle2, activo: "bg-white text-[#075A3C] shadow-sm ring-1 ring-[#BDE8D2]" },
];

type Linea = { clave: number; insumoId: string; cantidad: string };

type UnidadDuracion = "HORAS" | "DIAS" | "SEMANAS" | "MESES" | "ANIOS";
const UNIDADES: { valor: UnidadDuracion; texto: string }[] = [
  { valor: "HORAS", texto: "horas" },
  { valor: "DIAS", texto: "días" },
  { valor: "SEMANAS", texto: "semanas" },
  { valor: "MESES", texto: "meses" },
  { valor: "ANIOS", texto: "años" },
];

/** Las duraciones de un toque. `horas` sirve para reconocer cuál corresponde a un inicio y un término ya guardados. */
const DURACIONES: { texto: string; n: string; u: UnidadDuracion; horas: number }[] = [
  { texto: "2 h", n: "2", u: "HORAS", horas: 2 },
  { texto: "Medio día", n: "4", u: "HORAS", horas: 4 },
  { texto: "1 día", n: "1", u: "DIAS", horas: 24 },
  { texto: "3 días", n: "3", u: "DIAS", horas: 72 },
  { texto: "1 semana", n: "1", u: "SEMANAS", horas: 168 },
];

const dos = (n: number) => String(n).padStart(2, "0");
const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «mar 17 nov, 22:32», a partir de «2026-11-17» y «22:32». */
function legible(fecha: string, hora: string) {
  if (!fecha) return "—";
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(a, m - 1, d).getDay();
  return `${DIAS_SEMANA[dia]} ${d} ${MESES[m - 1]}${hora ? `, ${hora}` : ""}`;
}

const aMs = (fecha: string, hora: string) => {
  const [a, m, d] = fecha.split("-").map(Number);
  const [h, mi] = (hora || "00:00").split(":").map(Number);
  return new Date(a, m - 1, d, h, mi).getTime();
};

function textoDuracion(horas: number) {
  if (horas <= 0) return "";
  if (horas < 24) return `${Math.round(horas)} h`;
  if (horas % 24 === 0) return `${horas / 24} ${horas === 24 ? "día" : "días"}`;
  return `${Math.floor(horas / 24)} d ${Math.round(horas % 24)} h`;
}

/** Una fecha AAAA-MM-DD más (o menos) unos días. */
function sumarDias(iso: string, n: number) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Una fecha más unos meses; si el mes de llegada no tiene ese día, cae en su último día (31 de enero + 1 mes = 28 o 29 de febrero). */
function sumarMeses(iso: string, n: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const destino = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth(), Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/**
 * Cuándo termina una labor que parte en `fecha` (y `hora`) y dura `n` de una unidad. Con hora de inicio, termina
 * exactamente esa duración después. Sin hora de inicio, el último día cuenta entero: una labor de 2 días que parte el
 * 5 termina el 6. Devuelve null si falta algún dato (por ejemplo, la hora para contar horas).
 */
function calcularFin(fecha: string, hora: string, n: number, unidad: UnidadDuracion): { fecha: string; hora: string } | null {
  if (!fecha || !(n > 0)) return null;
  if (unidad === "HORAS") {
    if (!hora) return null;
    const [h, mi] = hora.split(":").map(Number);
    const total = h * 60 + mi + Math.round(n * 60);
    const resto = total % 1440;
    return { fecha: sumarDias(fecha, Math.floor(total / 1440)), hora: `${dos(Math.floor(resto / 60))}:${dos(resto % 60)}` };
  }
  const entero = Math.max(1, Math.round(n));
  const fin = unidad === "DIAS" ? sumarDias(fecha, entero) : unidad === "SEMANAS" ? sumarDias(fecha, entero * 7) : unidad === "MESES" ? sumarMeses(fecha, entero) : sumarMeses(fecha, entero * 12);
  return hora ? { fecha: fin, hora } : { fecha: sumarDias(fin, -1), hora: "" };
}

/** Una fila del formulario: la etiqueta a la izquierda y el campo a la derecha (en el celular, uno sobre otro). */
function Fila({ id, label, opcional, ayuda, children }: { id?: string; label: string; opcional?: boolean; ayuda?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5">
      <div className="sm:pt-3">
        <label htmlFor={id} className="text-[13px] font-semibold">
          {label}
          {opcional ? <span className={cn("font-normal", GRIS)}> · opcional</span> : null}
        </label>
        {ayuda ? <p className={cn("hidden text-xs leading-snug sm:block", GRIS)}>{ayuda}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Registrar una labor del comité y los materiales del inventario que usa. */
export function LaborDialog({
  labor,
  insumos,
  rutas = [],
  responsables = [],
  rutaInicial,
  insumoInicial,
  ordenInicial,
  onCerrar,
}: {
  labor: LaborFila | null;
  insumos: Insumo[];
  rutas?: RutaOpcion[];
  /** Nombres entre los que se elige el responsable. Sin lista, se escribe a mano. */
  responsables?: string[];
  rutaInicial?: string;
  insumoInicial?: string;
  /** La orden de reparación de la que nace la labor: el formulario parte lleno y la labor queda enlazada a ella. */
  ordenInicial?: { id: string; titulo: string; lugar: string | null; descripcion: string | null };
  onCerrar: () => void;
}) {
  const [resultado, enviar, pendiente] = useActionState<ResultadoLabores | null, FormData>(guardarLabor, null);
  const [borrando, iniciarBorrado] = useTransition();
  const [confirmaBorrar, setConfirmaBorrar] = useState(false);
  const editando = labor !== null;
  const [titulo, setTitulo] = useState(labor?.titulo ?? ordenInicial?.titulo ?? "");
  const [estado, setEstado] = useState<EstadoLabor>(labor?.estado ?? "PROGRAMADA");
  const [tipo, setTipo] = useState(labor?.tipo ?? (ordenInicial ? "REPARACION" : rutaInicial ? "LECTURA" : "MANTENCION"));
  const [rutasSel, setRutasSel] = useState<string[]>(() => (labor ? labor.rutas.map((r) => r.id) : rutaInicial ? [rutaInicial] : []));
  const [responsable, setResponsable] = useState(labor?.responsable ?? "");
  const [lineas, setLineas] = useState<Linea[]>(
    labor
      ? labor.materiales.filter((m) => m.insumoId).map((m, i) => ({ clave: i, insumoId: m.insumoId as string, cantidad: String(m.cantidad) }))
      : insumoInicial && insumos.some((i) => i.id === insumoInicial)
        ? [{ clave: 0, insumoId: insumoInicial, cantidad: "1" }]
        : []
  );
  const [siguiente, setSiguiente] = useState(100);
  // Inicio y término, y cuánto dura: al elegir la duración, el término se calcula solo.
  const [fecha, setFecha] = useState(labor?.fecha ?? hoyEnChile());
  const [hora, setHora] = useState(labor?.hora ?? "");
  const [fin, setFin] = useState(labor?.fechaTermino ?? "");
  const [horaFin, setHoraFin] = useState(labor?.horaFin ?? "");
  const [durN, setDurN] = useState("");
  const [durU, setDurU] = useState<UnidadDuracion>("DIAS");
  const [otraDuracion, setOtraDuracion] = useState(false);

  function recalcular(nuevo: { fecha?: string; hora?: string; durN?: string; durU?: UnidadDuracion }) {
    const f = nuevo.fecha ?? fecha;
    const h = nuevo.hora ?? hora;
    const n = nuevo.durN ?? durN;
    const u = nuevo.durU ?? durU;
    const r = calcularFin(f, h, Number(n.replace(",", ".")), u);
    if (r) {
      setFin(r.fecha);
      setHoraFin(r.hora);
    }
  }

  function elegirDuracion(d: (typeof DURACIONES)[number]) {
    setOtraDuracion(false);
    // Contar horas necesita una hora de inicio: si no hay, parte a las 08:00.
    const h = d.u === "HORAS" && !hora ? "08:00" : hora;
    if (h !== hora) setHora(h);
    setDurN(d.n);
    setDurU(d.u);
    recalcular({ hora: h, durN: d.n, durU: d.u });
  }

  const T = TIPO[tipo] ?? TIPO.OTRO;
  const TipoIcono = T.icono;

  useEffect(() => {
    if (resultado?.ok) {
      toast.success(editando ? "Labor actualizada" : "Labor registrada");
      avisarCambio("inventario");
      onCerrar();
    }
  }, [resultado, editando, onCerrar]);

  const delInventario = new Map(insumos.map((i) => [i.id, i]));
  // El stock disponible de un material: si esta labor ya lo descontó, lo que se ve en inventario ya no incluye su cantidad.
  const yaDescontado = (insumoId: string) => (labor?.descontada ? (labor.materiales.find((m) => m.insumoId === insumoId)?.cantidad ?? 0) : 0);

  function cambiar(clave: number, parte: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...parte } : l)));
  }

  const cantidadDe = (l: Linea) => Number(l.cantidad.replace(",", ".")) || 0;
  const disponibleDe = (l: Linea) => {
    const m = delInventario.get(l.insumoId);
    return m ? m.stock + yaDescontado(m.id) : 0;
  };
  // Al marcarla como hecha, lo que se usa no puede pasar de lo que hay.
  const excede = (l: Linea) => estado === "HECHA" && Boolean(delInventario.get(l.insumoId)) && cantidadDe(l) > disponibleDe(l);
  const lineaValida = (l: Linea) => Boolean(l.insumoId) && cantidadDe(l) > 0 && !excede(l);

  // El término no puede ser anterior al inicio.
  const finAntes = estado !== "HECHA" && Boolean(fin) && aMs(fin, horaFin || "23:59") < aMs(fecha, hora);
  const horas = fecha && fin ? (aMs(fin, horaFin || hora) - aMs(fecha, hora)) / 3_600_000 : 0;
  const puedeGuardar = titulo.trim().length > 0 && !finAntes && lineas.every(lineaValida);
  const total = lineas.reduce((t, l) => t + (delInventario.get(l.insumoId)?.costo ?? 0) * cantidadDe(l), 0);
  const hayExceso = lineas.some(excede);

  const materiales = JSON.stringify(lineas.filter((l) => l.insumoId && cantidadDe(l) > 0).map((l) => ({ insumoId: l.insumoId, cantidad: cantidadDe(l) })));

  function borrar() {
    if (!labor) return;
    iniciarBorrado(async () => {
      const r = await eliminarLabor(labor.id);
      if (r.ok) {
        toast.success("Labor borrada");
        avisarCambio("inventario");
        onCerrar();
      } else {
        toast.error(r.error);
        setConfirmaBorrar(false);
      }
    });
  }

  const duracionActiva = (d: (typeof DURACIONES)[number]) => (durN !== "" ? durN === d.n && durU === d.u : Boolean(hora) && Math.round(horas) === d.horas);
  const mostrarOtra = otraDuracion || (durN !== "" && !DURACIONES.some((d) => d.n === durN && d.u === durU));
  const opcionesResponsable = responsable && !responsables.includes(responsable) ? [responsable, ...responsables] : responsables;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[94dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(860px,92vh)] sm:w-[720px] sm:max-w-[calc(100vw-48px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0"
      >
        <form action={enviar} className="flex min-h-0 flex-1 flex-col">
          {editando && <input type="hidden" name="id" value={labor.id} />}
          {ordenInicial && <input type="hidden" name="ordenId" value={ordenInicial.id} />}
          <input type="hidden" name="materiales" value={materiales} />
          <input type="hidden" name="rutas" value={JSON.stringify(rutasSel)} />
          <input type="hidden" name="estado" value={estado} />

          {/* Encabezado: qué labor es y en qué estado está */}
          <div className="shrink-0 border-b border-[#F0EEF6] px-5 pt-5 pb-4 sm:px-7">
            <div className="flex items-start gap-3.5">
              <span aria-hidden className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", T.tono)}>
                <TipoIcono className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs font-medium", GRIS)}>
                  {editando ? `L-${labor.numero}` : "Nueva labor"} · {textoTipoLabor(tipo)}
                </p>
                <DialogTitle className="truncate text-lg leading-snug font-semibold">{titulo.trim() || (editando ? "Editar labor" : "Nueva labor")}</DialogTitle>
                <DialogDescription className="sr-only">Los materiales se descuentan al marcarla como hecha.</DialogDescription>
              </div>
              <DialogClose aria-label="Cerrar" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
                <X className="size-[18px]" />
              </DialogClose>
            </div>
            <div role="radiogroup" aria-label="Estado" className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-[#F4F3F9] p-1">
              {ESTADOS.map((e) => {
                const Icono = e.icono;
                const activo = e.valor === estado;
                return (
                  <button key={e.valor} type="button" role="radio" aria-checked={activo} onClick={() => setEstado(e.valor)} className={cn("flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors", activo ? e.activo : `${GRIS} hover:text-[#15132B]`)}>
                    <Icono className="size-4" aria-hidden />
                    {e.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Trabajo */}
            <section aria-label="Trabajo" className="space-y-4 px-5 py-5 sm:px-7">
              <Fila id="lab-titulo" label="¿Qué se hace?">
                <Input id="lab-titulo" name="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Cambio de conexiones en Las Rosas" maxLength={140} className={CAMPO} autoFocus required />
              </Fila>
              <Fila id="lab-tipo" label="Tipo">
                <select id="lab-tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={SELECT}>
                  {TIPOS_LABOR.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.texto}
                    </option>
                  ))}
                </select>
              </Fila>
              <Fila id="lab-desc" label="Detalle" opcional>
                <textarea id="lab-desc" name="descripcion" defaultValue={labor?.descripcion ?? ordenInicial?.descripcion ?? ""} rows={2} maxLength={1000} placeholder="Instrucciones para quien la hace" className="w-full resize-none rounded-xl border border-[#E4E1F0] bg-white px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
              </Fila>
            </section>

            {/* Cuándo */}
            <section aria-label="Cuándo" className="space-y-4 border-t border-[#F0EEF6] bg-[#FBFAFE] px-5 py-5 sm:px-7">
              <Fila id="lab-fecha" label="Inicio" ayuda="La hora es opcional">
                <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                  <Input
                    id="lab-fecha"
                    name="fecha"
                    type="date"
                    aria-label="Fecha de inicio"
                    value={fecha}
                    onChange={(e) => {
                      setFecha(e.target.value);
                      recalcular({ fecha: e.target.value });
                    }}
                    className={CAMPO}
                    required
                  />
                  <Input
                    name="hora"
                    type="time"
                    aria-label="Hora de inicio"
                    value={hora}
                    onChange={(e) => {
                      setHora(e.target.value);
                      recalcular({ hora: e.target.value });
                    }}
                    className={CAMPO}
                  />
                </div>
              </Fila>

              {estado === "HECHA" ? (
                <Fila id="lab-termino" label="Terminó el">
                  <Input id="lab-termino" name="fechaTermino" type="date" value={fin || hoyEnChile()} onChange={(e) => setFin(e.target.value)} className={CAMPO} />
                </Fila>
              ) : (
                <>
                  <Fila label="Duración" opcional ayuda="Calcula el término">
                    <div className="flex flex-wrap gap-1.5">
                      {DURACIONES.map((d) => {
                        const on = duracionActiva(d);
                        return (
                          <button key={d.texto} type="button" aria-pressed={on} onClick={() => elegirDuracion(d)} className={cn("h-9 rounded-full px-3.5 text-[13px] font-semibold ring-1 transition-colors", on ? "bg-[#3A0CE3] text-white ring-[#3A0CE3]" : "bg-white text-[#46435C] ring-[#E4E1F0] hover:bg-[#F7F5FF]")}>
                            {d.texto}
                          </button>
                        );
                      })}
                      <button type="button" aria-pressed={mostrarOtra} onClick={() => setOtraDuracion((v) => !v)} className={cn("h-9 rounded-full px-3.5 text-[13px] font-semibold ring-1 transition-colors", mostrarOtra ? "bg-[#3A0CE3] text-white ring-[#3A0CE3]" : "bg-white text-[#46435C] ring-[#E4E1F0] hover:bg-[#F7F5FF]")}>
                        Otra
                      </button>
                    </div>
                    {mostrarOtra ? (
                      <div className="mt-2 flex gap-2">
                        <Input
                          aria-label="Cuánto dura"
                          value={durN}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d,.]/g, "").slice(0, 5);
                            setDurN(v);
                            recalcular({ durN: v });
                          }}
                          inputMode="decimal"
                          placeholder="Ej.: 3"
                          className={cn(CAMPO, "w-28")}
                        />
                        <select
                          aria-label="Unidad de la duración"
                          value={durU}
                          onChange={(e) => {
                            const u = e.target.value as UnidadDuracion;
                            setDurU(u);
                            recalcular({ durU: u });
                          }}
                          className={cn(SELECT, "flex-1")}
                        >
                          {UNIDADES.map((u) => (
                            <option key={u.valor} value={u.valor}>
                              {u.texto}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    {durU === "HORAS" && !hora && durN !== "" ? <p className="mt-1.5 text-xs text-[#8F4400]">Para contar horas, indica la hora de inicio.</p> : null}
                  </Fila>

                  <Fila id="lab-termino" label="Término" opcional>
                    <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                      <Input
                        id="lab-termino"
                        name="fechaTermino"
                        type="date"
                        aria-label="Fecha de término"
                        min={fecha}
                        value={fin}
                        onChange={(e) => {
                          setFin(e.target.value);
                          setDurN("");
                        }}
                        className={cn(CAMPO, finAntes && "border-[#E5484D]")}
                      />
                      <Input
                        name="horaFin"
                        type="time"
                        aria-label="Hora de término"
                        value={horaFin}
                        onChange={(e) => {
                          setHoraFin(e.target.value);
                          setDurN("");
                        }}
                        className={CAMPO}
                      />
                    </div>
                  </Fila>

                  <div className="sm:pl-[170px]">
                    {finAntes ? (
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#A32020]">
                        <AlertTriangle className="size-4" aria-hidden />
                        El término es anterior al inicio.
                      </p>
                    ) : (
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-white px-3 py-2 text-[13px] ring-1 ring-[#ECEAF4]">
                        <span className="font-semibold">{legible(fecha, hora)}</span>
                        <ArrowRight className="size-3.5 text-[#A19FB2]" aria-hidden />
                        <span className="font-semibold">{fin ? legible(fin, horaFin) : "sin término"}</span>
                        {horas > 0 ? <span className={cn("ml-auto text-xs", GRIS)}>dura {textoDuracion(horas)}</span> : null}
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* Dónde y quién */}
            <section aria-label="Dónde y quién" className="space-y-4 border-t border-[#F0EEF6] px-5 py-5 sm:px-7">
              {rutas.length > 0 && (
                <Fila label="Ruta" opcional ayuda="Socios que se visitan">
                  <div className="flex flex-wrap gap-2">
                    {rutas.map((r) => {
                      const activa = rutasSel.includes(r.id);
                      return (
                        <button key={r.id} type="button" aria-pressed={activa} onClick={() => setRutasSel((l) => (activa ? l.filter((x) => x !== r.id) : [...l, r.id]))} className={cn("flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors", activa ? "border-[#3A0CE3] bg-[#F7F5FF] text-[#2A07A8]" : "border-[#E4E1F0] text-[#46435C] hover:bg-[#F8F7FC]")}>
                          <span aria-hidden className={cn("size-2 rounded-full", activa ? "bg-[#3A0CE3]" : "bg-[#CFCBE0]")} />
                          {r.nombre}
                        </button>
                      );
                    })}
                  </div>
                  {rutasSel.length > 0 ? (
                    <p className="mt-2 flex items-center gap-2 rounded-lg bg-[#F7F5FF] px-3 py-2 text-[13px]">
                      <Route className="size-4 shrink-0 text-[#6B46F5]" aria-hidden />
                      <span className={GRIS}>
                        Se hace en todos los socios de {rutasSel.length === 1 ? "la ruta elegida" : `las ${rutasSel.length} rutas elegidas`}.
                      </span>
                    </p>
                  ) : null}
                </Fila>
              )}
              <Fila id="lab-lugar" label="Lugar" opcional>
                <div className="relative">
                  <MapPin className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8F8CA3]" aria-hidden />
                  <Input id="lab-lugar" name="lugar" defaultValue={labor?.lugar ?? ordenInicial?.lugar ?? ""} placeholder="Sector, caseta o pozo" maxLength={160} className={cn(CAMPO, "pl-9")} />
                </div>
              </Fila>
              <Fila id="lab-responsable" label="Responsable" opcional>
                {opcionesResponsable.length > 0 ? (
                  <div className="relative">
                    <UserRound className={cn("pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2", responsable ? "text-[#8F8CA3]" : "text-[#8A4B00]")} aria-hidden />
                    <select id="lab-responsable" name="responsable" value={responsable} onChange={(e) => setResponsable(e.target.value)} className={cn(SELECT, "pl-9", !responsable && "text-[#8A4B00]")}>
                      <option value="">Sin asignar</option>
                      {opcionesResponsable.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <Input id="lab-responsable" name="responsable" value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre de quien la hace" maxLength={120} className={CAMPO} />
                )}
              </Fila>
            </section>

            {/* Materiales */}
            <section aria-label="Materiales del inventario" className="border-t border-[#F0EEF6] px-5 py-5 sm:px-7">
              <div className="flex items-baseline justify-between">
                <p className="flex items-center gap-2 text-[13px] font-semibold">
                  <Package className="size-4 text-[#3A0CE3]" aria-hidden />
                  Materiales a usar
                </p>
                {total > 0 ? (
                  <p className="text-[13px] tabular-nums">
                    <span className={GRIS}>Total </span>
                    <b>{clp(total)}</b>
                  </p>
                ) : null}
              </div>
              <p className={cn("mt-0.5 text-xs", GRIS)}>{estado === "HECHA" ? "Al guardar, se descuentan del inventario." : "Se descuentan del inventario cuando la labor queda como hecha."}</p>

              {insumos.length === 0 ? <p className={cn("mt-3 text-[13px]", GRIS)}>Primero carga materiales en Inventario para poder usarlos aquí.</p> : null}

              {lineas.length > 0 ? (
                <ul className="mt-3 divide-y divide-[#F3F1F8] rounded-xl ring-1 ring-[#ECEAF4]">
                  {lineas.map((l) => {
                    const mat = delInventario.get(l.insumoId);
                    const disponible = disponibleDe(l);
                    const cantidad = cantidadDe(l);
                    const sobra = excede(l);
                    return (
                      <li key={l.clave} className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap">
                        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                          <select aria-label="Material" value={l.insumoId} onChange={(e) => cambiar(l.clave, { insumoId: e.target.value })} className="h-9 w-full rounded-lg border-0 bg-transparent px-1 text-sm font-medium outline-none hover:bg-[#F7F6FB] focus-visible:ring-2 focus-visible:ring-ring">
                            <option value="">Elegir material…</option>
                            {insumos.map((i) => (
                              <option key={i.id} value={i.id} disabled={lineas.some((x) => x.insumoId === i.id && x.clave !== l.clave)}>
                                {i.nombre}
                              </option>
                            ))}
                          </select>
                          {mat ? (
                            <p className={cn("px-1 text-xs", sobra ? "font-medium text-[#A32020]" : GRIS)}>
                              {sobra ? `Solo hay ${formatoCantidad(disponible)} ${unidadCorta(mat.unidad)} en bodega` : `Quedan ${formatoCantidad(disponible)} ${unidadCorta(mat.unidad)}${mat.costo > 0 ? ` · ${clp(mat.costo)} c/u` : ""}${cantidad > 0 ? ` · quedarán ${formatoCantidad(disponible - cantidad)}` : ""}`}
                            </p>
                          ) : null}
                        </div>
                        <div className={cn("flex h-9 items-center rounded-lg ring-1", sobra ? "ring-[#E5484D]" : "ring-[#E4E1F0]")}>
                          <button type="button" aria-label="Menos" onClick={() => cambiar(l.clave, { cantidad: formatoCantidadCampo(Math.max(0, cantidad - 1)) })} className="flex size-9 items-center justify-center text-[#5B5970] hover:text-[#15132B]">
                            −
                          </button>
                          <input aria-label="Cantidad" inputMode="decimal" value={l.cantidad} onChange={(e) => cambiar(l.clave, { cantidad: e.target.value.replace(/[^\d.,]/g, "").slice(0, 10) })} className="w-12 bg-transparent text-center text-sm font-semibold tabular-nums outline-none" />
                          <button type="button" aria-label="Más" onClick={() => cambiar(l.clave, { cantidad: formatoCantidadCampo(cantidad + 1) })} className="flex size-9 items-center justify-center text-[#5B5970] hover:text-[#15132B]">
                            +
                          </button>
                        </div>
                        <span className="w-[84px] text-right text-sm font-semibold tabular-nums">{mat && mat.costo > 0 ? clp(mat.costo * cantidad) : "—"}</span>
                        <button type="button" aria-label={`Quitar ${mat?.nombre ?? "material"}`} onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))} className="flex size-9 items-center justify-center rounded-lg text-[#8F8CA3] hover:bg-[#FDF3F3] hover:text-[#A32020]">
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <button
                type="button"
                disabled={insumos.length === 0}
                onClick={() => {
                  setLineas((ls) => [...ls, { clave: siguiente, insumoId: "", cantidad: "1" }]);
                  setSiguiente((n) => n + 1);
                }}
                className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C9BCFB] text-[13px] font-semibold text-[#2A07A8] hover:bg-[#FAF8FF] disabled:opacity-50"
              >
                <Plus className="size-4" aria-hidden />
                Agregar material
              </button>
            </section>

            {resultado && !resultado.ok && (
              <p className="px-5 pb-5 text-[13px] text-[#A32020] sm:px-7" role="alert">
                {resultado.error}
              </p>
            )}
          </div>

          {/* Pie */}
          <div className="shrink-0 border-t border-[#F0EEF6] bg-[#FAFAFD] px-5 py-3.5 sm:px-7">
            {confirmaBorrar && labor ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 text-[13px] text-[#7A1A1A]">
                  <b>¿Borrar L-{labor.numero}?</b> {labor.descontada ? "Los materiales que descontó vuelven al inventario." : "No se puede deshacer."}
                </p>
                <Button type="button" variant="ghost" onClick={() => setConfirmaBorrar(false)} disabled={borrando} className="h-10 rounded-lg font-semibold text-[#46435C]">
                  No
                </Button>
                <Button type="button" onClick={borrar} disabled={borrando} className="h-10 rounded-lg bg-[#D92D20] px-4 font-semibold hover:bg-[#D92D20]/90">
                  {borrando ? <Loader2 className="animate-spin" /> : null}
                  Sí, borrar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {editando ? (
                  <Button type="button" variant="ghost" onClick={() => setConfirmaBorrar(true)} disabled={borrando || pendiente} aria-label="Borrar labor" className="h-11 rounded-xl px-3 font-semibold text-[#A32020] hover:bg-[#FDF3F3] hover:text-[#A32020]">
                    <Trash2 className="size-4" />
                    <span className="hidden sm:inline">Borrar</span>
                  </Button>
                ) : null}
                {hayExceso ? <p className="hidden min-w-0 flex-1 truncate text-xs font-medium text-[#A32020] sm:block">Falta stock de un material</p> : <span className="flex-1" />}
                <Button type="button" variant="ghost" onClick={onCerrar} className="h-11 rounded-xl font-semibold text-[#46435C]">
                  Cancelar
                </Button>
                <Button type="submit" disabled={pendiente || borrando || !puedeGuardar} className="h-11 rounded-xl px-5 font-semibold">
                  {pendiente ? <Loader2 className="animate-spin" /> : null}
                  {editando ? "Guardar cambios" : "Registrar labor"}
                </Button>
              </div>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** La cantidad como se escribe en el campo: sin decimales de más y con coma. */
function formatoCantidadCampo(n: number) {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}
