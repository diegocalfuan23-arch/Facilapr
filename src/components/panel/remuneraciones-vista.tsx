"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  deshacerPago,
  eliminarRemuneracion,
  generarMes,
  guardarRemuneracion,
  pagarRemuneracion,
  type ResultadoRemuneraciones,
} from "@/app/panel/remuneraciones/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MEDIOS_MOVIMIENTO, hoyEnChile, textoMedioLinea } from "@/lib/finanzas-comun";
import { descuentosLegales } from "@/lib/personal-comun";
import { descuentoPorDias, valorDelDia, type RemuneracionFila } from "@/lib/rrhh-comun";
import { cn } from "@/lib/utils";
import { useConfirmar } from "@/components/ui/confirmar";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const campo = "h-10 px-3 text-[0.95rem]";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";
const etiquetaKpi = "text-[0.8rem] font-medium tracking-wide uppercase";
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Un monto con formato de dinero que guarda solo los dígitos. */
function MontoInput({ id, valor, onCambio, autoFocus }: { id: string; valor: string; onCambio: (v: string) => void; autoFocus?: boolean }) {
  return (
    <Input
      id={id}
      value={valor ? `$${Number(valor).toLocaleString("es-CL")}` : ""}
      onChange={(e) => onCambio(e.target.value.replace(/\D/g, "").slice(0, 9))}
      placeholder="$0"
      inputMode="numeric"
      className={campo}
      autoFocus={autoFocus}
    />
  );
}

function EditarDialog({ fila, onCerrar }: { fila: RemuneracionFila; onCerrar: () => void }) {
  const [estado, enviar, pendiente] = useActionState<ResultadoRemuneraciones | null, FormData>(guardarRemuneracion, null);
  const [base, setBase] = useState(String(fila.sueldoBase));
  const [bonos, setBonos] = useState(fila.bonos ? String(fila.bonos) : "");
  const [otros, setOtros] = useState(fila.otrosDescuentos ? String(fila.otrosDescuentos) : "");
  const [dias, setDias] = useState(String(fila.diasDescontados));
  // A quien cobra por día: los días trabajados salen del sueldo base guardado y del valor del día.
  const [diasTrab, setDiasTrab] = useState(String(fila.porDia && fila.valorDiaFicha ? Math.round(fila.sueldoBase / fila.valorDiaFicha) : 0));
  // El valor del día con que quedó esta liquidación (si ya tenía días descontados), el de la ficha, o el sueldo ÷ 30.
  const [valorDia, setValorDia] = useState(
    String(fila.diasDescontados > 0 && fila.descAusencias > 0 ? Math.round(fila.descAusencias / fila.diasDescontados) : valorDelDia(fila.sueldoBase, fila.valorDiaFicha))
  );

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Liquidación guardada");
      onCerrar();
    }
  }, [estado, onCerrar]);

  const baseNum = fila.porDia ? (Number(diasTrab) || 0) * (Number(valorDia) || 0) : Number(base) || 0;
  const descAusencias = fila.porDia ? 0 : descuentoPorDias(baseNum, Number(dias) || 0, Number(valorDia) || null);
  const imponible = Math.max(0, baseNum - descAusencias) + (Number(bonos) || 0);
  const legales = descuentosLegales({ contrato: fila.contrato, afpTasa: fila.afpTasa, saludTasa: fila.saludTasa, cesantia: fila.cesantiaPaga }, imponible);
  const totalDescuentos = legales.total + (Number(otros) || 0);
  const liquido = Math.max(0, imponible - totalDescuentos);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-lg sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Liquidación de {fila.trabajador}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">{fila.cargo} · {fila.periodo}</DialogDescription>
        </DialogHeader>
        <form action={enviar} className="mt-2 flex flex-col gap-4">
          <input type="hidden" name="id" value={fila.id} />
          <input type="hidden" name="sueldoBase" value={baseNum} />
          <input type="hidden" name="bonos" value={bonos} />
          <input type="hidden" name="otrosDescuentos" value={otros} />
          <input type="hidden" name="diasDescontados" value={fila.porDia ? 0 : dias} />
          <input type="hidden" name="valorDia" value={valorDia} />
          <div className="grid gap-4 sm:grid-cols-3">
            {fila.porDia ? (
              <div>
                <label htmlFor="rem-diastrab" className={etiqueta}>
                  Días trabajados
                </label>
                <Input id="rem-diastrab" value={diasTrab} onChange={(e) => setDiasTrab(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={campo} autoFocus />
              </div>
            ) : (
              <div>
                <label htmlFor="rem-base" className={etiqueta}>
                  Sueldo bruto
                </label>
                <MontoInput id="rem-base" valor={base} onCambio={setBase} autoFocus />
              </div>
            )}
            <div>
              <label htmlFor="rem-bonos" className={etiqueta}>
                Bonos y extras
              </label>
              <MontoInput id="rem-bonos" valor={bonos} onCambio={setBonos} />
            </div>
            <div>
              <label htmlFor="rem-otros" className={etiqueta}>
                Otros descuentos
              </label>
              <MontoInput id="rem-otros" valor={otros} onCambio={setOtros} />
            </div>
          </div>
          <p className="text-[0.75rem] text-muted-foreground">
            La AFP, la salud y el seguro de cesantía se calculan solos con la ficha de la persona. En «otros» van anticipos, préstamos y similares.
          </p>
          {fila.porDia ? (
            <div className="flex flex-col gap-2">
              <div>
                <label htmlFor="rem-valordia-dia" className={etiqueta}>
                  Valor por día trabajado
                </label>
                <MontoInput id="rem-valordia-dia" valor={valorDia} onCambio={setValorDia} />
              </div>
              <p className="text-[0.75rem] text-muted-foreground">
                Según la asistencia de este mes: {fila.ausenciasMes.trabajados} {fila.ausenciasMes.trabajados === 1 ? "día" : "días"} con presente o atraso.
                {Number(diasTrab) !== fila.ausenciasMes.trabajados && (
                  <>
                    {" "}
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => setDiasTrab(String(fila.ausenciasMes.trabajados))}>
                      Usar {fila.ausenciasMes.trabajados}
                    </button>
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor="rem-dias" className={etiqueta}>
                Días que no se pagan
              </label>
              <Input
                id="rem-dias"
                value={dias}
                onChange={(e) => setDias(e.target.value.replace(/\D/g, "").slice(0, 2))}
                inputMode="numeric"
                className={cn(campo, "sm:w-32")}
              />
            </div>
            <div>
              <label htmlFor="rem-valordia" className={etiqueta}>
                Valor del día
              </label>
              <MontoInput id="rem-valordia" valor={valorDia} onCambio={setValorDia} />
            </div>
          </div>
          <div className="-mt-2">
            <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
              Este mes: {fila.ausenciasMes.faltas} {fila.ausenciasMes.faltas === 1 ? "falta" : "faltas"}, {fila.ausenciasMes.licencia} de licencia, {fila.ausenciasMes.permisoSinGoce} de permiso sin goce.
              {fila.ausenciasMes.vacaciones > 0 && ` Tuvo ${fila.ausenciasMes.vacaciones} de vacaciones, que se pagan.`}
              {Number(dias) !== fila.ausenciasMes.descontables && (
                <>
                  {" "}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setDias(String(fila.ausenciasMes.descontables))}>
                    Usar {fila.ausenciasMes.descontables}
                  </button>
                </>
              )}
            </p>
          </div>
            </>
          )}
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-[0.9rem]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sueldo bruto</span>
              <span className="tabular-nums">{clp.format(baseNum)}</span>
            </div>
            {descAusencias > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Días no pagados ({dias})</span>
                <span className="tabular-nums">-{clp.format(descAusencias)}</span>
              </div>
            )}
            {(Number(bonos) || 0) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Bonos y extras</span>
                <span className="tabular-nums">+{clp.format(Number(bonos))}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-border pt-1">
              <span className="text-muted-foreground">Total haberes</span>
              <span className="tabular-nums">{clp.format(imponible)}</span>
            </div>
            {fila.contrato === "HONORARIO" ? (
              <div className="mt-1 flex justify-between text-muted-foreground">
                <span>Retención de honorarios</span>
                <span className="tabular-nums">-{clp.format(legales.retencion)}</span>
              </div>
            ) : (
              <>
                <div className="mt-1 flex justify-between text-muted-foreground">
                  <span>AFP</span>
                  <span className="tabular-nums">-{clp.format(legales.afp)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Salud</span>
                  <span className="tabular-nums">-{clp.format(legales.salud)}</span>
                </div>
                {legales.cesantia > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Seguro de cesantía</span>
                    <span className="tabular-nums">-{clp.format(legales.cesantia)}</span>
                  </div>
                )}
              </>
            )}
            {(Number(otros) || 0) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Otros descuentos</span>
                <span className="tabular-nums">-{clp.format(Number(otros))}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="font-medium">Líquido a pagar</span>
              <span className="text-[1.15rem] font-bold tabular-nums">{clp.format(liquido)}</span>
            </div>
          </div>
          <div>
            <label htmlFor="rem-nota" className={etiqueta}>
              Nota (opcional)
            </label>
            <Input id="rem-nota" name="nota" defaultValue={fila.nota ?? ""} placeholder="Ej.: horas extra de octubre, adelanto descontado…" maxLength={200} className={campo} />
          </div>
          {estado && !estado.ok && (
            <p className="text-[0.8rem] text-destructive" role="alert">
              {estado.error}
            </p>
          )}
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10 rounded-full px-5 text-[0.95rem]" disabled={pendiente}>
              {pendiente && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PagarDialog({ fila, onCerrar }: { fila: RemuneracionFila; onCerrar: () => void }) {
  const [estado, enviar, pendiente] = useActionState<ResultadoRemuneraciones | null, FormData>(pagarRemuneracion, null);

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Pago registrado y anotado en Caja");
      onCerrar();
    }
  }, [estado, onCerrar]);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Pagar a {fila.trabajador}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">
            Se anotan {clp.format(fila.liquido)} como egreso de Remuneraciones en la Caja.
          </DialogDescription>
        </DialogHeader>
        <form action={enviar} className="mt-2 flex flex-col gap-4">
          <input type="hidden" name="id" value={fila.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pgo-fecha" className={etiqueta}>
                Fecha del pago
              </label>
              <Input id="pgo-fecha" name="fecha" type="date" defaultValue={hoyEnChile()} className={campo} required />
            </div>
            <div>
              <label htmlFor="pgo-medio" className={etiqueta}>
                Medio de pago
              </label>
              <select id="pgo-medio" name="medio" defaultValue="TRANSFERENCIA" className={selectClase}>
                {MEDIOS_MOVIMIENTO.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.texto}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {estado && !estado.ok && (
            <p className="text-[0.8rem] text-destructive" role="alert">
              {estado.error}
            </p>
          )}
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10 rounded-full px-5 text-[0.95rem]" disabled={pendiente}>
              {pendiente && <Loader2 className="animate-spin" />}
              Registrar pago
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Las remuneraciones de un mes: se arma la liquidación de cada persona (base, bonos, descuentos),
 * y al pagarla queda como egreso en la Caja.
 */
export function RemuneracionesVista({
  filas,
  periodo,
  anterior,
  siguiente,
  mesTexto,
}: {
  filas: RemuneracionFila[];
  periodo: string;
  anterior: string;
  siguiente: string;
  mesTexto: string;
}) {
  const { confirmar, dialogo } = useConfirmar();
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [editando, setEditando] = useState<RemuneracionFila | null>(null);
  const [pagando, setPagando] = useState<RemuneracionFila | null>(null);
  const cerrarEdicion = useCallback(() => setEditando(null), []);
  const cerrarPago = useCallback(() => setPagando(null), []);

  const total = filas.reduce((s, f) => s + f.liquido, 0);
  const pagado = filas.filter((f) => f.estado === "PAGADA").reduce((s, f) => s + f.liquido, 0);
  const pendiente = total - pagado;

  function armar() {
    iniciar(async () => {
      const r = await generarMes(periodo);
      if (r.ok) toast.success("Mes armado");
      else toast.error(r.error);
    });
  }
  async function deshacer(f: RemuneracionFila) {
    if (!(await confirmar({ titulo: `¿Deshacer el pago a ${f.trabajador}?`, descripcion: "También se quita de la Caja.", boton: "Deshacer pago" }))) return;
    iniciar(async () => {
      const r = await deshacerPago(f.id);
      if (r.ok) toast.success("Pago deshecho");
      else toast.error(r.error);
    });
  }
  async function borrar(f: RemuneracionFila) {
    if (!(await confirmar({ titulo: `¿Quitar la liquidación de ${f.trabajador}?`, descripcion: "Se quita solo de este mes.", boton: "Quitar" }))) return;
    iniciar(async () => {
      const r = await eliminarRemuneracion(f.id);
      if (r.ok) toast.success("Liquidación quitada");
      else toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className={cn(etiquetaKpi, "text-muted-foreground")}>Total del mes</p>
          <p className="mt-3 text-[2rem] leading-none font-bold tabular-nums">{clp.format(total)}</p>
          <p className="mt-2 text-[0.8rem] text-muted-foreground">{filas.length} {filas.length === 1 ? "liquidación" : "liquidaciones"}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className={cn(etiquetaKpi, "text-emerald-800 dark:text-emerald-300")}>Pagado</p>
          <p className="mt-3 text-[2rem] leading-none font-bold text-emerald-800 tabular-nums dark:text-emerald-300">{clp.format(pagado)}</p>
        </div>
        <div className={cn("rounded-xl border p-5", pendiente > 0 ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10" : "border-border bg-card")}>
          <p className={cn(etiquetaKpi, pendiente > 0 ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>Por pagar</p>
          <p className={cn("mt-3 text-[2rem] leading-none font-bold tabular-nums", pendiente > 0 && "text-amber-800 dark:text-amber-300")}>{clp.format(pendiente)}</p>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Mes anterior" className="size-10 rounded-full" onClick={() => router.push(`/panel/remuneraciones?mes=${anterior}`)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-36 text-center text-[0.95rem] font-medium capitalize">{mesTexto}</span>
          <Button variant="outline" size="icon" aria-label="Mes siguiente" className="size-10 rounded-full" onClick={() => router.push(`/panel/remuneraciones?mes=${siguiente}`)}>
            <ChevronRight />
          </Button>
        </div>
        <Button className="h-10 rounded-full px-5 text-[0.95rem]" onClick={armar} disabled={ocupado}>
          {ocupado && <Loader2 className="animate-spin" />}
          {filas.length === 0 ? "Armar el mes" : "Agregar a quienes falten"}
        </Button>
      </div>

      {filas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-[1.05rem] font-medium">Este mes aún no tiene liquidaciones</p>
          <p className="mx-auto mt-2 max-w-xl px-4 text-[0.95rem] text-muted-foreground">
            Pulsa «Armar el mes» y se crea una liquidación por cada persona activa, con su sueldo base. Después ajustas bonos y descuentos y pagas.
          </p>
        </div>
      ) : (
        <div className="scroll-fino overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-200 border-collapse text-[0.95rem]">
            <thead>
              <tr className="border-b border-border bg-card">
                {["Persona", "Sueldo bruto", "Bonos", "Descuentos", "Líquido", "Estado", ""].map((c) => (
                  <th key={c} className="px-5 py-4 text-left font-medium whitespace-nowrap text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const pagada = f.estado === "PAGADA";
                return (
                  <tr key={f.id} onClick={() => !pagada && setEditando(f)} className={cn("border-b border-border last:border-0 hover:bg-card/50", !pagada && "cursor-pointer")}>
                    <td className="px-5 py-4">
                      <div className="font-medium">{f.trabajador}</div>
                      <div className="text-[0.8rem] text-muted-foreground">{f.cargo}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap tabular-nums">
                      {clp.format(f.sueldoBase)}
                      {f.diasDescontados > 0 && <div className="text-[0.75rem] text-red-600 dark:text-red-400">-{f.diasDescontados} {f.diasDescontados === 1 ? "día" : "días"} no pagados</div>}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{f.bonos ? `+${clp.format(f.bonos)}` : "—"}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted-foreground tabular-nums">{f.descuentos ? `-${clp.format(f.descuentos)}` : "—"}</td>
                    <td className="px-5 py-4 font-medium whitespace-nowrap tabular-nums">{clp.format(f.liquido)}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-[0.8rem] font-medium",
                          pagada ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                        )}
                      >
                        {pagada ? `Pagada ${f.fechaPago ? fechaCorta(f.fechaPago) : ""} · ${textoMedioLinea(f.medio ?? "OTRO")}` : "Por pagar"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {pagada ? (
                        <Button variant="ghost" className="h-9 px-3 text-[0.85rem] text-muted-foreground" disabled={ocupado} onClick={() => deshacer(f)}>
                          Deshacer pago
                        </Button>
                      ) : (
                        <span className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            className="h-9 px-3 text-[0.85rem] text-muted-foreground"
                            disabled={ocupado}
                            onClick={(e) => {
                              e.stopPropagation();
                              borrar(f);
                            }}
                          >
                            Quitar
                          </Button>
                          <Button
                            variant="outline"
                            className="h-9 rounded-full px-4 text-[0.85rem]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPagando(f);
                            }}
                          >
                            Pagar
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogo}
      {editando && <EditarDialog key={editando.id} fila={editando} onCerrar={cerrarEdicion} />}
      {pagando && <PagarDialog key={pagando.id} fila={pagando} onCerrar={cerrarPago} />}
    </div>
  );
}
