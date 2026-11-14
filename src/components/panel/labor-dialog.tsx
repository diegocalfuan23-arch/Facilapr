"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, ClipboardPlus, Clock3, Loader2, Package, Plus, Trash2, X, type LucideIcon } from "lucide-react";
import { eliminarLabor, guardarLabor, type ResultadoLabores } from "@/app/panel/labores/actions";
import { avisarCambio } from "@/lib/avisos-datos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { formatoCantidad, unidadCorta, type Insumo } from "@/lib/inventario-comun";
import { TIPOS_LABOR, type EstadoLabor, type LaborFila } from "@/lib/labores-comun";
import { cn } from "@/lib/utils";
import { useConfirmar } from "@/components/ui/confirmar";

const campo = "h-11 rounded-xl px-3 text-[0.95rem]";
const etiqueta = "text-[0.8rem] font-semibold";
const selectClase =
  "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** El color de la franja de arriba y del botón de cada estado: la franja cambia según el estado que se elige. */
const ESTADOS: { valor: EstadoLabor; nombre: string; icono: LucideIcon; banda: string; activo: string }[] = [
  { valor: "PROGRAMADA", nombre: "Programada", icono: CalendarClock, banda: "bg-sky-700", activo: "border-sky-600 bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300" },
  { valor: "EN_CURSO", nombre: "En curso", icono: Clock3, banda: "bg-amber-700", activo: "border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-300" },
  { valor: "HECHA", nombre: "Hecha", icono: CheckCircle2, banda: "bg-emerald-700", activo: "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" },
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

const dos = (n: number) => String(n).padStart(2, "0");

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

function Campo({ id, label, opcional, className, children }: { id: string; label: string; opcional?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={etiqueta}>
        {label}
        {opcional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </label>
      {children}
    </div>
  );
}

/** Registrar una labor del comité y los materiales del inventario que usa. */
export function LaborDialog({ labor, insumos, insumoInicial, onCerrar }: { labor: LaborFila | null; insumos: Insumo[]; insumoInicial?: string; onCerrar: () => void }) {
  const { confirmar, dialogo } = useConfirmar();
  const [resultado, enviar, pendiente] = useActionState<ResultadoLabores | null, FormData>(guardarLabor, null);
  const [borrando, iniciarBorrado] = useTransition();
  const editando = labor !== null;
  const [titulo, setTitulo] = useState(labor?.titulo ?? "");
  const [estado, setEstado] = useState<EstadoLabor>(labor?.estado ?? "PROGRAMADA");
  const [lineas, setLineas] = useState<Linea[]>(
    labor
      ? labor.materiales.filter((m) => m.insumoId).map((m, i) => ({ clave: i, insumoId: m.insumoId as string, cantidad: String(m.cantidad) }))
      : insumoInicial && insumos.some((i) => i.id === insumoInicial)
        ? [{ clave: 0, insumoId: insumoInicial, cantidad: "1" }]
        : []
  );
  const [siguiente, setSiguiente] = useState(100);
  // Inicio y término, y cuánto dura: al escribir la duración, el término se calcula solo.
  const [fecha, setFecha] = useState(labor?.fecha ?? hoyEnChile());
  const [hora, setHora] = useState(labor?.hora ?? "");
  const [fin, setFin] = useState(labor?.fechaTermino ?? "");
  const [horaFin, setHoraFin] = useState(labor?.horaFin ?? "");
  const [durN, setDurN] = useState("");
  const [durU, setDurU] = useState<UnidadDuracion>("DIAS");

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
  const actual = ESTADOS.find((e) => e.valor === estado) ?? ESTADOS[0];

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
  const puedeGuardar = titulo.trim().length > 0 && lineas.every(lineaValida);

  const materiales = JSON.stringify(lineas.filter((l) => l.insumoId && cantidadDe(l) > 0).map((l) => ({ insumoId: l.insumoId, cantidad: cantidadDe(l) })));

  async function borrar() {
    if (!labor) return;
    if (!(await confirmar({ titulo: `¿Borrar la labor L-${labor.numero}?`, descripcion: labor.descontada ? "Los materiales que descontó vuelven al inventario." : "No se puede deshacer.", boton: "Borrar" }))) return;
    iniciarBorrado(async () => {
      const r = await eliminarLabor(labor.id);
      if (r.ok) {
        toast.success("Labor borrada");
        avisarCambio("inventario");
        onCerrar();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent showCloseButton={false} className="flex max-h-[calc(100dvh-24px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px] sm:p-0">
        <form action={enviar} className="flex min-h-0 flex-1 flex-col">
          {editando && <input type="hidden" name="id" value={labor.id} />}
          <input type="hidden" name="materiales" value={materiales} />
          <input type="hidden" name="estado" value={estado} />

          {/* La franja de arriba cambia de color con el estado elegido. */}
          <div className={cn("flex shrink-0 items-center gap-3 py-4 pr-3 pl-5 text-white transition-colors", actual.banda)}>
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <ClipboardPlus className="size-[22px]" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl leading-tight font-bold text-white">{editando ? `Labor L-${labor.numero}` : "Nueva labor"}</DialogTitle>
              <DialogDescription className="text-[0.8rem] text-white/90">Los materiales se descuentan al marcarla como hecha.</DialogDescription>
            </div>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/20 hover:text-white">
              <X className="size-5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <Campo id="lab-titulo" label="¿Qué se hace?">
              <Input id="lab-titulo" name="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Cambio de medidores del sector norte" maxLength={140} className={campo} autoFocus required />
            </Campo>

            <div className="flex flex-col gap-1.5">
              <span id="lab-estado" className={etiqueta}>
                Estado
              </span>
              <div role="radiogroup" aria-labelledby="lab-estado" className="grid grid-cols-3 gap-2">
                {ESTADOS.map((e) => {
                  const Icono = e.icono;
                  const activo = e.valor === estado;
                  return (
                    <button
                      key={e.valor}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => setEstado(e.valor)}
                      className={cn(
                        "flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-[0.85rem] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        activo ? e.activo : "border-input text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <Icono className="hidden size-4 sm:block" aria-hidden />
                      {e.nombre}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="lab-tipo" label="Tipo">
                <select id="lab-tipo" name="tipo" defaultValue={labor?.tipo ?? "MANTENCION"} className={selectClase}>
                  {TIPOS_LABOR.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.texto}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo id="lab-fecha" label="Fecha de inicio">
                <Input
                  id="lab-fecha"
                  name="fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    recalcular({ fecha: e.target.value });
                  }}
                  className={campo}
                  required
                />
              </Campo>
              <Campo id="lab-hora" label="Hora de inicio" opcional>
                <Input
                  id="lab-hora"
                  name="hora"
                  type="time"
                  value={hora}
                  onChange={(e) => {
                    setHora(e.target.value);
                    recalcular({ hora: e.target.value });
                  }}
                  className={campo}
                />
              </Campo>
              {estado === "HECHA" ? (
                <Campo id="lab-termino" label="Fecha en que se terminó" className="sm:col-span-2">
                  <Input id="lab-termino" name="fechaTermino" type="date" value={fin || hoyEnChile()} onChange={(e) => setFin(e.target.value)} className={campo} />
                </Campo>
              ) : (
                <>
                  <Campo id="lab-dura" label="Cuánto dura" opcional className="sm:col-span-2">
                    <div className="flex gap-2">
                      <Input
                        id="lab-dura"
                        value={durN}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d,.]/g, "").slice(0, 5);
                          setDurN(v);
                          recalcular({ durN: v });
                        }}
                        inputMode="decimal"
                        placeholder="Ej.: 3"
                        className={cn(campo, "w-28")}
                      />
                      <select
                        aria-label="Unidad de la duración"
                        value={durU}
                        onChange={(e) => {
                          const u = e.target.value as UnidadDuracion;
                          setDurU(u);
                          recalcular({ durU: u });
                        }}
                        className={cn(selectClase, "flex-1")}
                      >
                        {UNIDADES.map((u) => (
                          <option key={u.valor} value={u.valor}>
                            {u.texto}
                          </option>
                        ))}
                      </select>
                    </div>
                    {durU === "HORAS" && !hora && durN !== "" && <span className="text-[0.75rem] text-amber-700 dark:text-amber-300">Para contar horas, indica la hora de inicio.</span>}
                  </Campo>
                  <Campo id="lab-termino" label="Termina el" opcional>
                    <Input
                      id="lab-termino"
                      name="fechaTermino"
                      type="date"
                      value={fin}
                      onChange={(e) => {
                        setFin(e.target.value);
                        setDurN("");
                      }}
                      className={campo}
                    />
                  </Campo>
                  <Campo id="lab-horafin" label="A las" opcional>
                    <Input
                      id="lab-horafin"
                      name="horaFin"
                      type="time"
                      value={horaFin}
                      onChange={(e) => {
                        setHoraFin(e.target.value);
                        setDurN("");
                      }}
                      className={campo}
                    />
                  </Campo>
                  <p className="-mt-2 text-[0.75rem] text-muted-foreground sm:col-span-2">
                    Escribe cuánto dura y el término se calcula solo (lo puedes ajustar). Sin hora de inicio, el último día cuenta entero. La labor pasa sola a «En curso» al llegar su inicio y a «Hecha» al llegar su término, descontando los materiales del inventario.
                  </p>
                </>
              )}
              <Campo id="lab-lugar" label="Lugar" opcional>
                <Input id="lab-lugar" name="lugar" defaultValue={labor?.lugar ?? ""} placeholder="Sector, caseta o pozo" maxLength={160} className={campo} />
              </Campo>
              <Campo id="lab-responsable" label="Responsable" opcional>
                <Input id="lab-responsable" name="responsable" defaultValue={labor?.responsable ?? ""} placeholder="Nombre de quien la hace" maxLength={120} className={campo} />
              </Campo>
            </div>

            <Campo id="lab-desc" label="Detalle" opcional>
              <Textarea id="lab-desc" name="descripcion" defaultValue={labor?.descripcion ?? ""} rows={2} maxLength={1000} className="min-h-[68px] resize-y" />
            </Campo>

            <section aria-label="Materiales del inventario" className="rounded-2xl bg-muted/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-[0.95rem] font-bold">
                  <Package className="size-[18px] text-primary" aria-hidden />
                  Materiales del inventario
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 rounded-xl bg-card font-semibold text-primary"
                  disabled={insumos.length === 0}
                  onClick={() => {
                    setLineas((ls) => [...ls, { clave: siguiente, insumoId: "", cantidad: "" }]);
                    setSiguiente((n) => n + 1);
                  }}
                >
                  <Plus />
                  Agregar
                </Button>
              </div>

              {insumos.length === 0 && <p className="mt-3 text-[0.8rem] text-muted-foreground">Primero carga materiales en Inventario para poder usarlos aquí.</p>}
              {insumos.length > 0 && lineas.length === 0 && <p className="mt-3 text-[0.8rem] text-muted-foreground">Esta labor no usa materiales por ahora.</p>}

              {lineas.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {lineas.map((l) => {
                    const mat = delInventario.get(l.insumoId);
                    const disponible = disponibleDe(l);
                    const cantidad = cantidadDe(l);
                    const sobra = excede(l);
                    return (
                      <div key={l.clave} className="rounded-xl bg-card p-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <select aria-label="Material" value={l.insumoId} onChange={(e) => cambiar(l.clave, { insumoId: e.target.value })} className={cn(selectClase, "min-w-0 flex-1")}>
                            <option value="">Elegir material…</option>
                            {insumos.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.nombre}
                              </option>
                            ))}
                          </select>
                          <div className="relative w-24 shrink-0 sm:w-28">
                            <Input
                              aria-label="Cantidad"
                              value={l.cantidad}
                              onChange={(e) => cambiar(l.clave, { cantidad: e.target.value.replace(/[^\d.,]/g, "").slice(0, 10) })}
                              inputMode="decimal"
                              placeholder="Cant."
                              className={cn(campo, "pr-9", sobra && "border-destructive")}
                            />
                            {mat && <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[0.8rem] font-medium text-muted-foreground">{unidadCorta(mat.unidad)}</span>}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Quitar ${mat?.nombre ?? "material"}`}
                            onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}
                            className="size-11 shrink-0 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        {mat && (
                          <p className={cn("mt-2 text-[0.8rem] font-medium", sobra ? "text-destructive" : "text-muted-foreground")}>
                            {sobra
                              ? `Solo hay ${formatoCantidad(disponible)} ${unidadCorta(mat.unidad)} en inventario: no se podrá marcar como hecha.`
                              : `Disponible ${formatoCantidad(disponible)} ${unidadCorta(mat.unidad)}${cantidad > 0 ? ` · quedarán ${formatoCantidad(disponible - cantidad)} ${unidadCorta(mat.unidad)}` : ""}`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-3 text-[0.75rem] text-muted-foreground">
                {estado === "HECHA" ? "Al guardar, estos materiales se descuentan del inventario." : "Se descuentan del inventario cuando la labor pasa a Hecha. Si la reabres, vuelven."}
              </p>
            </section>

            {resultado && !resultado.ok && (
              <p className="text-[0.85rem] text-destructive" role="alert">
                {resultado.error}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-card px-5 py-3">
            {editando ? (
              <Button type="button" variant="ghost" className="h-11 rounded-full px-4 font-semibold text-destructive" onClick={borrar} disabled={borrando || pendiente}>
                {borrando && <Loader2 className="animate-spin" />}
                Borrar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" className="h-11 rounded-full px-5 font-semibold" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" className="h-11 rounded-full px-6 font-semibold" disabled={pendiente || borrando || !puedeGuardar}>
                {pendiente && <Loader2 className="animate-spin" />}
                {editando ? "Guardar cambios" : "Registrar labor"}
              </Button>
            </div>
          </div>
        </form>
        {dialogo}
      </DialogContent>
    </Dialog>
  );
}
