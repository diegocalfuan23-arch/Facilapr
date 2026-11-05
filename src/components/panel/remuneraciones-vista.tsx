"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, FileText, Loader2 } from "lucide-react";
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
import { horasPorDia, valorDeHoraExtra, valorHoraOrdinaria } from "@/lib/personal-comun";
import { cn } from "@/lib/utils";
import { useConfirmar } from "@/components/ui/confirmar";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCorta = (iso: string) => iso.split("-").reverse().join("-");
const campo = "h-10 px-3 text-[0.95rem]";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";
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
  const [noImp, setNoImp] = useState(fila.noImponible ? String(fila.noImponible) : "");
  const [horasExtra, setHorasExtra] = useState(fila.horasExtra ? String(fila.horasExtra).replace(".", ",") : "");
  const [horas, setHoras] = useState(fila.horasDescontadas ? String(fila.horasDescontadas).replace(".", ",") : "");
  const [diasTrab, setDiasTrab] = useState(String(fila.porDia && fila.valorDiaFicha ? Math.round(fila.sueldoBase / fila.valorDiaFicha) : 0));
  // El valor del día con que quedó esta liquidación (si ya tenía días descontados), el de la ficha, o el sueldo ÷ 30.
  const [valorDia, setValorDia] = useState(
    String(fila.diasDescontados > 0 && fila.horasDescontadas === 0 && fila.descAusencias > 0 ? Math.round(fila.descAusencias / fila.diasDescontados) : valorDelDia(fila.sueldoBase, fila.valorDiaFicha))
  );

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Liquidación guardada");
      onCerrar();
    }
  }, [estado, onCerrar]);

  const baseNum = fila.porDia ? (Number(diasTrab) || 0) * (Number(valorDia) || 0) : Number(base) || 0;
  const horasNum = Number(horas.replace(",", ".")) || 0;
  const diasNoPagados = fila.porDia ? 0 : Number(dias) || 0;
  const horasDia = horasPorDia(fila);
  const descAusencias = descuentoPorDias(baseNum, diasNoPagados, Number(valorDia) || null, horasNum, horasDia);
  // Las horas extras: el valor fijado en la ficha o la hora ordinaria con recargo.
  const jornada = { sueldo: baseNum, valorDia: Number(valorDia) || fila.valorDiaFicha, porDia: fila.porDia, jornadaSemanal: fila.jornadaSemanal, diasSemana: fila.diasSemana, valorHoraExtra: fila.valorHoraExtraFicha };
  const horasExtraNum = Number(horasExtra.replace(",", ".")) || 0;
  const valorExtra = valorDeHoraExtra(jornada);
  const montoExtra = Math.round(horasExtraNum * valorExtra);
  const formatoNumero = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
  const detalleNoPagado = [diasNoPagados > 0 ? `${diasNoPagados} ${diasNoPagados === 1 ? "día" : "días"}` : null, horasNum > 0 ? `${formatoNumero(horasNum)} h` : null].filter(Boolean).join(" + ");
  const diasPagados = Math.max(0, 30 - diasNoPagados - horasNum / horasDia);
  const imponible = Math.max(0, baseNum - descAusencias) + (Number(bonos) || 0) + montoExtra;
  const legales = descuentosLegales({ contrato: fila.contrato, afpTasa: fila.afpTasa, saludTasa: fila.saludTasa, cesantia: fila.cesantiaPaga }, imponible);
  const totalDescuentos = legales.total + (Number(otros) || 0);
  const noImpNum = Number(noImp) || 0;
  const liquido = Math.max(0, imponible - totalDescuentos) + noImpNum;

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
          <input type="hidden" name="horasDescontadas" value={horasNum} />
          <input type="hidden" name="horasExtra" value={horasExtraNum} />
          <input type="hidden" name="noImponible" value={noImpNum} />
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
            La AFP, la salud y el seguro de cesantía se calculan solos con la ficha de la persona. En «otros» van otros descuentos; las cuotas de anticipos y préstamos se cargan solas al armar el mes.
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
          <div>
            <label htmlFor="rem-horas" className={etiqueta}>
              Horas de permiso sin goce
            </label>
            <Input
              id="rem-horas"
              value={horas}
              onChange={(e) => setHoras(e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))}
              inputMode="decimal"
              placeholder="0"
              className={cn(campo, "sm:w-32")}
            />
            <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
              El día de esta persona dura {formatoNumero(horasDia)} horas: cada hora descuenta esa parte del valor del día.
              {fila.ausenciasMes.horasPermisoSinGoce > 0 && horasNum !== fila.ausenciasMes.horasPermisoSinGoce && (
                <>
                  {" "}
                  Este mes tuvo {formatoNumero(fila.ausenciasMes.horasPermisoSinGoce)} h de permiso sin goce.{" "}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setHoras(String(fila.ausenciasMes.horasPermisoSinGoce).replace(".", ","))}>
                    Usar {formatoNumero(fila.ausenciasMes.horasPermisoSinGoce)}
                  </button>
                </>
              )}
            </p>
          </div>
          <div>
            <label htmlFor="rem-noimp" className={etiqueta}>
              Colación y movilización
            </label>
            <MontoInput id="rem-noimp" valor={noImp} onCambio={setNoImp} />
            <p className="mt-1.5 text-[0.75rem] text-muted-foreground">No es imponible: se suma al líquido sin descontar AFP ni salud.</p>
          </div>
          <div>
            <label htmlFor="rem-extra" className={etiqueta}>
              Horas extras
            </label>
            <Input
              id="rem-extra"
              value={horasExtra}
              onChange={(e) => setHorasExtra(e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))}
              inputMode="decimal"
              placeholder="0"
              className={cn(campo, "sm:w-32")}
            />
            <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
              Cada hora extra vale {clp.format(valorExtra)}
              {fila.valorHoraExtraFicha ? " (fijado en su ficha)" : ` (hora ordinaria ${clp.format(Math.round(valorHoraOrdinaria(jornada)))} más 50 % de recargo)`}. Cuentan como parte de lo que gana.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-[0.9rem]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sueldo bruto</span>
              <span className="tabular-nums">{clp.format(baseNum)}</span>
            </div>
            {!fila.porDia && (
              <div className="flex justify-between text-muted-foreground">
                <span>Días pagados</span>
                <span className="tabular-nums">{formatoNumero(diasPagados)} de 30</span>
              </div>
            )}
            {descAusencias > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>No pagado ({detalleNoPagado})</span>
                <span className="tabular-nums">-{clp.format(descAusencias)}</span>
              </div>
            )}
            {montoExtra > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Horas extras ({formatoNumero(horasExtraNum)} h)</span>
                <span className="tabular-nums">+{clp.format(montoExtra)}</span>
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
            {noImpNum > 0 && (
              <div className="mt-1 flex justify-between text-muted-foreground">
                <span>Colación y movilización (no imponible)</span>
                <span className="tabular-nums">+{clp.format(noImpNum)}</span>
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
/** El libro de remuneraciones del mes en una planilla con punto y coma, la que abre bien el Excel en español. */
function descargarLibro(filas: RemuneracionFila[], periodo: string) {
  const celda = (t: string | number | null) => `"${String(t ?? "").replace(/"/g, '""')}"`;
  const encabezado = [
    "persona",
    "cargo",
    "forma_de_pago",
    "sueldo_base",
    "dias_no_pagados",
    "horas_no_pagadas",
    "descuento_por_ausencias",
    "horas_extras",
    "monto_horas_extras",
    "bonos",
    "colacion_movilizacion",
    "afp",
    "salud",
    "seguro_cesantia",
    "retencion_honorarios",
    "otros_descuentos",
    "total_descuentos",
    "liquido",
    "estado",
    "fecha_pago",
    "medio_de_pago",
  ];
  const cuerpo = filas.map((f) => [
    f.trabajador,
    f.cargo,
    f.contrato === "HONORARIO" ? "Honorarios" : "Sueldo",
    f.sueldoBase,
    f.diasDescontados,
    f.horasDescontadas,
    f.descAusencias,
    f.horasExtra,
    f.montoHorasExtra,
    f.bonos,
    f.noImponible,
    f.descAfp,
    f.descSalud,
    f.descCesantia,
    f.retencion,
    f.otrosDescuentos,
    f.descuentos,
    f.liquido,
    f.estado === "PAGADA" ? "Pagada" : "Por pagar",
    f.fechaPago ?? "",
    f.medio ?? "",
  ]);
  const csv = "\uFEFF" + [encabezado, ...cuerpo].map((fila) => fila.map(celda).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `remuneraciones-${periodo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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

  const avance = total > 0 ? Math.round((pagado / total) * 100) : 0;
  const acciones = (f: RemuneracionFila) => <AccionesFila f={f} ocupado={ocupado} onPagar={() => setPagando(f)} onQuitar={() => void borrar(f)} onDeshacer={() => void deshacer(f)} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Un solo recuadro con los tres números y cuánto va pagado: ocupa una fila, no tres tarjetas. */}
      <section aria-label="Resumen" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-6 py-4">
            <p className="text-[0.8rem] text-muted-foreground">Total del mes</p>
            <p className="mt-1 text-[1.5rem] leading-none font-bold tabular-nums">{clp.format(total)}</p>
            <p className="mt-2 text-[0.75rem] text-muted-foreground">
              {filas.length} {filas.length === 1 ? "liquidación" : "liquidaciones"}
            </p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[0.8rem] text-muted-foreground">Pagado</p>
            <p className="mt-1 text-[1.5rem] leading-none font-bold text-emerald-700 tabular-nums dark:text-emerald-400">{clp.format(pagado)}</p>
            <p className="mt-2 text-[0.75rem] text-muted-foreground">{avance} % del mes</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[0.8rem] text-muted-foreground">Por pagar</p>
            <p className={cn("mt-1 text-[1.5rem] leading-none font-bold tabular-nums", pendiente > 0 && "text-amber-700 dark:text-amber-300")}>{clp.format(pendiente)}</p>
            <p className="mt-2 text-[0.75rem] text-muted-foreground">{filas.filter((f) => f.estado !== "PAGADA").length} pendientes</p>
          </div>
        </div>
        <div className="h-1 bg-muted" role="img" aria-label={`${avance} % del mes pagado`}>
          <div className="h-full bg-emerald-600" style={{ width: `${avance}%` }} />
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
        <div className="flex flex-wrap gap-2">
          {filas.length > 0 && (
            <Button variant="outline" className="h-10 rounded-full px-4 text-[0.9rem]" onClick={() => descargarLibro(filas, periodo)} title="Planilla del mes para tu contador o la directiva">
              <Download />
              Libro del mes
            </Button>
          )}
          <Button className="h-10 rounded-full px-5 text-[0.95rem]" onClick={armar} disabled={ocupado}>
            {ocupado && <Loader2 className="animate-spin" />}
            {filas.length === 0 ? "Armar el mes" : "Agregar a quienes falten"}
          </Button>
        </div>
      </div>

      {filas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-14 text-center">
          <p className="text-[1rem] font-medium">Este mes aún no tiene liquidaciones</p>
          <p className="mx-auto mt-2 max-w-xl text-[0.9rem] text-muted-foreground">
            Pulsa «Armar el mes» y se crea una liquidación por cada persona activa, con su sueldo, los días y horas no pagados, las cuotas de préstamos y su colación. Después ajustas lo que haga falta y pagas.
          </p>
        </div>
      ) : (
        <>
          {/* Pantallas anchas: tabla. */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <table className="w-full border-collapse text-[0.92rem]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  {["Persona", "Haberes", "Descuentos", "Líquido", "Estado", ""].map((c, i) => (
                    <th key={i} className={cn("px-5 py-3 font-medium whitespace-nowrap", c === "Líquido" && "text-right")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const pagada = f.estado === "PAGADA";
                  const legales = f.descuentos - f.otrosDescuentos;
                  return (
                    <tr key={f.id} onClick={() => !pagada && setEditando(f)} className={cn("border-b border-border last:border-0", !pagada && "cursor-pointer hover:bg-muted/40")}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{f.trabajador}</span>
                          {f.porDia && <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">Por día</span>}
                        </div>
                        <div className="text-[0.8rem] text-muted-foreground">{f.cargo}</div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="tabular-nums">{clp.format(f.sueldoBase)}</div>
                        <Detalle f={f} />
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap tabular-nums">
                        {f.descuentos ? <span className="text-muted-foreground">-{clp.format(f.descuentos)}</span> : <span className="text-muted-foreground">—</span>}
                        {f.otrosDescuentos > 0 && (
                          <div className="text-[0.75rem] text-muted-foreground">
                            legales {clp.format(legales)} · otros {clp.format(f.otrosDescuentos)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[1rem] font-semibold whitespace-nowrap tabular-nums">{clp.format(f.liquido)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <EstadoPago f={f} />
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{acciones(f)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Celular: una tarjeta por persona. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {filas.map((f) => {
              const pagada = f.estado === "PAGADA";
              return (
                <li key={f.id} onClick={() => !pagada && setEditando(f)} className={cn("rounded-xl border border-border bg-card p-4", !pagada && "cursor-pointer")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.trabajador}</p>
                      <p className="truncate text-[0.8rem] text-muted-foreground">{f.cargo}</p>
                    </div>
                    <p className="shrink-0 text-[1.15rem] font-bold tabular-nums">{clp.format(f.liquido)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <EstadoPago f={f} />
                    <span className="text-[0.8rem] text-muted-foreground tabular-nums">
                      {clp.format(f.sueldoBase)} · -{clp.format(f.descuentos)}
                    </span>
                  </div>
                  <Detalle f={f} className="mt-2" />
                  <div className="mt-2 flex justify-end border-t border-border pt-2">{acciones(f)}</div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {dialogo}
      {editando && <EditarDialog key={editando.id} fila={editando} onCerrar={cerrarEdicion} />}
      {pagando && <PagarDialog key={pagando.id} fila={pagando} onCerrar={cerrarPago} />}
    </div>
  );
}

/** Lo que sube o baja el sueldo base de una liquidación, en líneas chicas: ausencias, horas extras, bonos y colación. */
function Detalle({ f, className }: { f: RemuneracionFila; className?: string }) {
  const lineas: { texto: string; tono: string }[] = [];
  if (f.descAusencias > 0) {
    const partes = [f.diasDescontados > 0 ? `${f.diasDescontados} ${f.diasDescontados === 1 ? "día" : "días"}` : null, f.horasDescontadas > 0 ? `${String(f.horasDescontadas).replace(".", ",")} h` : null].filter(Boolean).join(" + ");
    lineas.push({ texto: `-${clp.format(f.descAusencias)} no pagado (${partes})`, tono: "text-red-600 dark:text-red-400" });
  }
  if (f.montoHorasExtra > 0) lineas.push({ texto: `+${clp.format(f.montoHorasExtra)} horas extras (${String(f.horasExtra).replace(".", ",")} h)`, tono: "text-muted-foreground" });
  if (f.bonos > 0) lineas.push({ texto: `+${clp.format(f.bonos)} bonos`, tono: "text-muted-foreground" });
  if (f.noImponible > 0) lineas.push({ texto: `+${clp.format(f.noImponible)} colación y movilización`, tono: "text-muted-foreground" });
  if (lineas.length === 0) return null;
  return (
    <div className={cn("flex flex-col text-[0.75rem] tabular-nums", className)}>
      {lineas.map((l) => (
        <span key={l.texto} className={l.tono}>
          {l.texto}
        </span>
      ))}
    </div>
  );
}

function EstadoPago({ f }: { f: RemuneracionFila }) {
  const pagada = f.estado === "PAGADA";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[0.78rem] font-medium whitespace-nowrap",
        pagada ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
      )}
    >
      {pagada ? `Pagada ${f.fechaPago ? fechaCorta(f.fechaPago) : ""} · ${textoMedioLinea(f.medio ?? "OTRO")}` : "Por pagar"}
    </span>
  );
}

/** El PDF de la liquidación y las acciones de una fila: pagar o quitar, o deshacer el pago. */
function AccionesFila({ f, ocupado, onPagar, onQuitar, onDeshacer }: { f: RemuneracionFila; ocupado: boolean; onPagar: () => void; onQuitar: () => void; onDeshacer: () => void }) {
  const pagada = f.estado === "PAGADA";
  return (
    <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <a
        href={`/panel/remuneraciones/liquidacion/${f.id}`}
        target="_blank"
        rel="noopener"
        aria-label={`Liquidación de ${f.trabajador} en PDF`}
        title="Liquidación en PDF, para imprimir y firmar"
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <FileText className="size-4" />
      </a>
      {pagada ? (
        <Button variant="ghost" className="h-9 px-3 text-[0.85rem] text-muted-foreground" disabled={ocupado} onClick={onDeshacer}>
          Deshacer pago
        </Button>
      ) : (
        <>
          <Button variant="ghost" className="h-9 px-3 text-[0.85rem] text-muted-foreground" disabled={ocupado} onClick={onQuitar}>
            Quitar
          </Button>
          <Button variant="outline" className="h-9 rounded-full px-4 text-[0.85rem]" onClick={onPagar}>
            Pagar
          </Button>
        </>
      )}
    </span>
  );
}
