"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  HandCoins,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Undo2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  cambiarRevision,
  consultarRemuneraciones,
  deshacerPago,
  eliminarRemuneracion,
  generarMes,
  guardarRemuneracion,
  pagarRemuneracion,
  recalcularRemuneraciones,
  type ResultadoRemuneraciones,
} from "@/app/panel/remuneraciones/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { MEDIOS_MOVIMIENTO, hoyEnChile, textoMedioLinea } from "@/lib/finanzas-comun";
import { descuentosLegales } from "@/lib/personal-comun";
import { descuentoPorDias, desfaseConAsistencia, valorDelDia, type DatosRemuneraciones, type EstadoRemuneracion, type RemuneracionFila } from "@/lib/rrhh-comun";
import { horasPorDia, valorDeHoraExtra, valorHoraOrdinaria } from "@/lib/personal-comun";
import { montoEnPalabras } from "@/lib/monto-en-palabras";
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
              {fila.ausenciasMes.horasExtra > 0 && horasExtraNum !== fila.ausenciasMes.horasExtra && (
                <>
                  {" "}
                  En Asistencia hay {formatoNumero(fila.ausenciasMes.horasExtra)} h este mes.{" "}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setHorasExtra(String(fila.ausenciasMes.horasExtra).replace(".", ","))}>
                    Usar {formatoNumero(fila.ausenciasMes.horasExtra)}
                  </button>
                </>
              )}
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

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";

/** Lo que se gana antes de descuentos: el sueldo del mes menos lo no pagado, más horas extras y bonos. */
const imponibleDe = (f: RemuneracionFila) => Math.max(0, f.sueldoBase - f.descAusencias) + f.montoHorasExtra + f.bonos;
const pct = (basis: number) => `${(basis / 100).toLocaleString("es-CL")} %`;
const fechaDiaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const diasTrabajadosDe = (f: RemuneracionFila) => (f.valorDiaFicha ? Math.round(f.sueldoBase / f.valorDiaFicha) : null);

/** Lo que se muestra bajo el imponible en la lista: cuántos días se pagan y si hay horas extras. */
function resumenDias(f: RemuneracionFila) {
  const extra = f.montoHorasExtra > 0 ? ` + ${String(f.horasExtra).replace(".", ",")} h extra` : "";
  if (f.porDia) {
    const d = diasTrabajadosDe(f);
    return `${d === null ? "Días trabajados" : `${d} ${d === 1 ? "día" : "días"} × ${clp.format(f.valorDiaFicha ?? 0)}`}${extra}`;
  }
  return `${f.diasDescontados > 0 ? `${30 - f.diasDescontados} de 30 días` : "Mes completo"}${extra}`;
}

function EstadoChip({ f }: { f: RemuneracionFila }) {
  if (f.estado === "PAGADA") {
    return (
      <span title={`Pagada el ${f.fechaPago ? fechaCorta(f.fechaPago) : ""} · ${textoMedioLinea(f.medio ?? "OTRO")}`} className="inline-flex items-center gap-1 rounded-full bg-[#E6F6EF] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#075A3C]">
        <Check className="size-3.5" aria-hidden />
        Pagada {f.fechaPago ? fechaDiaMes(f.fechaPago) : ""}
      </span>
    );
  }
  if (f.estado === "LISTA") return <span className="inline-flex rounded-full bg-[#FFF3E5] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#8F4400]">Lista para pagar</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FDEFEF] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#A32020]">
      <AlertTriangle className="size-3.5" aria-hidden />
      Revisar
    </span>
  );
}

type Origen = "Personal" | "Asistencia" | "Préstamos" | "Manual";
const ICONO_ORIGEN: Record<Origen, LucideIcon> = { Personal: Users, Asistencia: CalendarCheck2, Préstamos: HandCoins, Manual: FileText };
type Linea = { concepto: string; monto: number; origen: Origen; detalle?: string; tono?: "aviso" };

function IconoOrigen({ origen, positivo }: { origen: Origen; positivo: boolean }) {
  const Icono = ICONO_ORIGEN[origen];
  return (
    <span aria-hidden className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", positivo ? "bg-[#E6F6EF] text-[#0A7A52]" : "bg-[#F4F3F9] text-[#5B5970]")}>
      <Icono className="size-3.5" />
    </span>
  );
}

function LineaFila({ l, signo }: { l: Linea; signo: 1 | -1 }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <IconoOrigen origen={l.origen} positivo={signo > 0} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{l.concepto}</span>
        <span className={cn("block text-xs", l.tono === "aviso" ? "text-[#8F4400]" : GRIS)}>
          Desde {l.origen}
          {l.detalle ? ` · ${l.detalle}` : ""}
        </span>
      </span>
      <span className={cn("shrink-0 font-semibold tabular-nums", signo < 0 && "text-[#A32020]")}>
        {signo < 0 ? "-" : ""}
        {clp.format(l.monto)}
      </span>
    </li>
  );
}

function NumeroBloque({ n, primario }: { n: number; primario?: boolean }) {
  return (
    <span aria-hidden className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-bold", primario ? "bg-primary text-white" : "bg-[#ECE8FD] text-[#2A07A8]")}>
      {n}
    </span>
  );
}

/** Los haberes y descuentos de una liquidación, línea por línea y con el módulo de donde sale cada uno. */
function lineasDe(f: RemuneracionFila) {
  const haberes: Linea[] = [];
  if (f.porDia) {
    const d = diasTrabajadosDe(f);
    haberes.push({ concepto: d === null ? "Días trabajados" : `${d} ${d === 1 ? "día trabajado" : "días trabajados"} a ${clp.format(f.valorDiaFicha ?? 0)}`, monto: f.sueldoBase, origen: "Asistencia", detalle: "días con presente o atraso" });
  } else {
    haberes.push({ concepto: `Sueldo base`, monto: f.sueldoBase, origen: "Personal" });
  }
  const descuentoAus = f.descAusencias;
  const noPagado = [f.diasDescontados > 0 ? `${f.diasDescontados} ${f.diasDescontados === 1 ? "día" : "días"}` : null, f.horasDescontadas > 0 ? `${String(f.horasDescontadas).replace(".", ",")} h` : null].filter(Boolean).join(" + ");
  if (f.horasExtra > 0 || f.montoHorasExtra > 0) {
    const valor = f.horasExtra > 0 ? Math.round(f.montoHorasExtra / f.horasExtra) : 0;
    haberes.push({ concepto: `Horas extras: ${String(f.horasExtra).replace(".", ",")} h${valor ? ` a ${clp.format(valor)}` : ""}`, monto: f.montoHorasExtra, origen: "Asistencia" });
  }
  if (f.bonos > 0) haberes.push({ concepto: "Bonos y extras", monto: f.bonos, origen: "Manual" });

  const descuentos: Linea[] = [];
  if (f.contrato === "HONORARIO") {
    if (f.retencion > 0) descuentos.push({ concepto: "Retención de honorarios", monto: f.retencion, origen: "Personal" });
  } else {
    if (f.descCesantia > 0) descuentos.push({ concepto: "Seguro de cesantía", monto: f.descCesantia, origen: "Personal", detalle: "aporte trabajador" });
    if (f.descAfp > 0) descuentos.push({ concepto: `AFP ${pct(f.afpTasa)}`, monto: f.descAfp, origen: "Personal" });
    if (f.descSalud > 0) descuentos.push({ concepto: `Salud ${pct(f.saludTasa)}`, monto: f.descSalud, origen: "Personal" });
  }
  for (const c of f.cuotasPrestamo) descuentos.push({ concepto: c.concepto, monto: c.monto, origen: "Préstamos" });
  const manual = f.otrosDescuentos - f.cuotasPrestamo.reduce((t, c) => t + c.monto, 0);
  if (manual > 0) descuentos.push({ concepto: "Otros descuentos", monto: manual, origen: "Manual" });
  return { haberes, noPagado, descuentoAus, descuentos };
}

/** El detalle de una liquidación: de dónde sale cada monto, lo que se descuenta y lo que se paga. */
function PanelLiquidacion({
  f,
  mesTexto,
  ocupado,
  onCerrar,
  onEditar,
  onRecalcular,
  onRevision,
  onPagar,
  onDeshacer,
}: {
  f: RemuneracionFila;
  mesTexto: string;
  ocupado: boolean;
  onCerrar: () => void;
  onEditar: () => void;
  onRecalcular: () => void;
  onRevision: (lista: boolean) => void;
  onPagar: () => void;
  onDeshacer: () => void;
}) {
  const { haberes, noPagado, descuentoAus, descuentos } = lineasDe(f);
  const imponible = imponibleDe(f);
  const pagada = f.estado === "PAGADA";
  const sinDias = f.porDia && f.ausenciasMes.trabajados === 0 && !pagada;
  const desfase = desfaseConAsistencia(f);
  const liquidoCero = f.liquido <= 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-medium capitalize", GRIS)}>Liquidación de {mesTexto}</p>
          <p className="truncate text-lg font-semibold">{f.trabajador}</p>
          <p className={cn("text-[13px]", GRIS)}>
            {f.cargo} · {f.porDia ? `Por día${f.valorDiaFicha ? ` (${clp.format(f.valorDiaFicha)})` : ""}` : f.contrato === "HONORARIO" ? "Honorarios" : "Sueldo mensual"}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onCerrar} className="size-9 rounded-lg">
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-[#F0EEF6] overflow-y-auto">
        {(sinDias || desfase) && (
          <div className="flex flex-col gap-2 bg-[#FFF8EF] px-5 py-3 text-[13px] text-[#7A3B00]">
            {sinDias && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex-1">Cobra por día y no tiene días marcados en Asistencia este mes.</span>
                <a href="/panel/asistencia" className="shrink-0 font-semibold underline underline-offset-2">
                  Ir a Asistencia
                </a>
              </div>
            )}
            {desfase && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex-1">{desfase}</span>
                <button type="button" onClick={onRecalcular} disabled={ocupado} className="shrink-0 font-semibold underline underline-offset-2">
                  Recalcular
                </button>
              </div>
            )}
          </div>
        )}

        <section className="px-5 py-4">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            <NumeroBloque n={1} />
            <span className="flex-1">Haberes imponibles</span>
            <span className="tabular-nums">{clp.format(imponible)}</span>
          </p>
          <ul className="flex flex-col gap-3">
            {haberes.slice(0, 1).map((l) => (
              <LineaFila key={l.concepto} l={l} signo={1} />
            ))}
            {descuentoAus > 0 && (
              <li className="flex items-start gap-3 text-sm">
                <IconoOrigen origen="Asistencia" positivo={false} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">No pagado ({noPagado})</span>
                  <span className="block text-xs text-[#8F4400]">Faltas, licencias y permisos sin goce · desde Asistencia</span>
                </span>
                <span className="shrink-0 font-semibold text-[#A32020] tabular-nums">-{clp.format(descuentoAus)}</span>
              </li>
            )}
            {haberes.slice(1).map((l) => (
              <LineaFila key={l.concepto} l={l} signo={1} />
            ))}
          </ul>
          {f.noImponible > 0 && (
            <>
              <p className={cn("mt-4 mb-2 flex justify-between text-xs font-semibold tracking-wide uppercase", GRIS)}>
                <span>No imponibles</span>
                <span className="tabular-nums">{clp.format(f.noImponible)}</span>
              </p>
              <p className="flex justify-between gap-3 text-sm">
                <span>
                  Colación y movilización <span className={cn("text-xs", GRIS)}>· sin imposiciones</span>
                </span>
                <span className="font-semibold tabular-nums">{clp.format(f.noImponible)}</span>
              </p>
            </>
          )}
          <div className="mt-3 flex flex-col gap-1 rounded-lg bg-[#F8F7FC] px-3 py-2 text-[13px]">
            <span className="flex justify-between">
              <span className={GRIS}>Total imponible</span>
              <b className="font-semibold tabular-nums">{clp.format(imponible)}</b>
            </span>
            <span className="flex justify-between">
              <span className={GRIS}>Total haberes</span>
              <b className="font-semibold tabular-nums">{clp.format(imponible + f.noImponible)}</b>
            </span>
          </div>
        </section>

        <section className="px-5 py-4">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            <NumeroBloque n={2} />
            <span className="flex-1">Descuentos</span>
            <span className={cn("tabular-nums", f.descuentos > 0 && "text-[#A32020]")}>{f.descuentos > 0 ? "-" : ""}{clp.format(f.descuentos)}</span>
          </p>
          {descuentos.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {descuentos.map((l, i) => (
                <LineaFila key={`${l.concepto}-${i}`} l={l} signo={-1} />
              ))}
            </ul>
          ) : (
            <p className={cn("text-sm", GRIS)}>Sin descuentos.</p>
          )}
          {f.contrato === "HONORARIO" && f.retencion === 0 && <p className={cn("mt-2 text-xs", GRIS)}>Honorarios: no lleva imposiciones.</p>}
        </section>

        <section className="bg-[#F8F7FC] px-5 py-4">
          <p className="flex items-center gap-2">
            <NumeroBloque n={3} primario />
            <span className="flex-1 font-semibold">Total a pagar</span>
            <span className="text-[22px] font-semibold tabular-nums">{clp.format(f.liquido)}</span>
          </p>
          <p className={cn("mt-1 pl-7 text-xs tabular-nums", GRIS)}>
            {clp.format(imponible + f.noImponible)} − {clp.format(f.descuentos)}
          </p>
          <p className={cn("mt-1 pl-7 text-xs first-letter:uppercase", GRIS)}>Son: {montoEnPalabras(f.liquido)} pesos.</p>
          {pagada && (
            <p className="mt-2 flex items-center gap-1.5 pl-7 text-[13px] font-semibold text-[#075A3C]">
              <Check className="size-4" aria-hidden />
              Pagado el {f.fechaPago ? fechaCorta(f.fechaPago) : ""} · {textoMedioLinea(f.medio ?? "OTRO")}
            </p>
          )}
          {f.nota && <p className={cn("mt-2 pl-7 text-xs", GRIS)}>Nota: {f.nota}</p>}
        </section>

        {!pagada && (
          <div className="flex flex-wrap gap-1 px-5 py-3">
            <Button variant="ghost" size="sm" onClick={onEditar} className="-ml-2 h-8 rounded-lg px-2 text-[13px] font-semibold text-[#2A07A8]">
              <Pencil className="size-4" />
              Editar liquidación
            </Button>
            <Button variant="ghost" size="sm" onClick={onRecalcular} disabled={ocupado} className="h-8 rounded-lg px-2 text-[13px] font-semibold text-[#2A07A8]">
              <RefreshCw className="size-4" />
              Recalcular desde Asistencia
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-[#F0EEF6] p-4">
        {pagada ? (
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 flex-1 rounded-lg border-[#E4E1F0] font-semibold" render={<a href={`/panel/remuneraciones/liquidacion/${f.id}`} target="_blank" rel="noopener" />}>
              <FileText />
              Ver liquidación
            </Button>
            <Button variant="ghost" onClick={onDeshacer} disabled={ocupado} className="h-10 rounded-lg px-3 font-semibold text-[#A32020] hover:bg-[#FDECEC] hover:text-[#A32020]">
              <Undo2 className="size-4" />
              Deshacer pago
            </Button>
          </div>
        ) : f.estado === "PENDIENTE" ? (
          <Button onClick={() => onRevision(true)} disabled={liquidoCero || ocupado} className="h-11 w-full rounded-lg font-semibold">
            {liquidoCero ? "Sin monto que pagar" : "Marcar como revisada"}
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <Button onClick={onPagar} className="h-11 rounded-lg font-semibold">
              Pagar {clp.format(f.liquido)}
            </Button>
            <p className={cn("text-center text-xs", GRIS)}>
              Queda registrado como egreso en la Caja.{" "}
              <a href={`/panel/remuneraciones/liquidacion/${f.id}`} target="_blank" rel="noopener" className="font-semibold text-[#2A07A8] underline underline-offset-2">
                Ver liquidación
              </a>{" "}
              ·{" "}
              <button type="button" onClick={() => onRevision(false)} disabled={ocupado} className="font-semibold text-[#2A07A8] underline underline-offset-2">
                Volver a revisar
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PagarDialog({ filas, onCerrar }: { filas: RemuneracionFila[]; onCerrar: () => void }) {
  const [estado, enviar, pendiente] = useActionState<ResultadoRemuneraciones | null, FormData>(pagarRemuneracion, null);
  const total = filas.reduce((t, f) => t + f.liquido, 0);
  const uno = filas.length === 1 ? filas[0] : null;

  useEffect(() => {
    if (estado?.ok) {
      toast.success(uno ? "Pago registrado y anotado en Caja" : `${filas.length} pagos registrados y anotados en Caja`);
      onCerrar();
    }
  }, [estado, onCerrar, uno, filas.length]);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-md sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">{uno ? `Pagar a ${uno.trabajador}` : `Pagar ${filas.length} liquidaciones`}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">
            {uno ? `Se anotan ${clp.format(total)} como egreso de Remuneraciones en la Caja.` : `Se anotan ${filas.length} egresos de Remuneraciones en la Caja, por ${clp.format(total)} en total.`}
          </DialogDescription>
        </DialogHeader>
        <form action={enviar} className="mt-2 flex flex-col gap-4">
          {filas.map((f) => (
            <input key={f.id} type="hidden" name="id" value={f.id} />
          ))}
          {!uno && (
            <ul className="flex flex-col gap-1 rounded-lg bg-[#F8F7FC] px-3 py-2 text-[0.85rem]">
              {filas.map((f) => (
                <li key={f.id} className="flex justify-between gap-3">
                  <span className="truncate">{f.trabajador}</span>
                  <span className="tabular-nums">{clp.format(f.liquido)}</span>
                </li>
              ))}
            </ul>
          )}
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
              {uno ? "Registrar pago" : `Registrar ${filas.length} pagos`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
    f.estado === "PAGADA" ? "Pagada" : f.estado === "LISTA" ? "Lista para pagar" : "Por revisar",
    f.fechaPago ?? "",
    f.medio ?? "",
  ]);
  const csv = "﻿" + [encabezado, ...cuerpo].map((fila) => fila.map(celda).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `remuneraciones-${periodo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type Filtro = "todas" | EstadoRemuneracion;

/**
 * Las remuneraciones de un mes: se arma la liquidación de cada persona con lo que dicen Asistencia, permisos y
 * préstamos, se revisa, y al pagarla queda como egreso en la Caja.
 */
export function RemuneracionesVista({
  datos,
  periodo,
  anterior,
  siguiente,
  mesTexto,
  mesEnCurso,
}: {
  datos: DatosRemuneraciones;
  periodo: string;
  anterior: string;
  siguiente: string;
  mesTexto: string;
  mesEnCurso: boolean;
}) {
  const { confirmar, dialogo } = useConfirmar();
  const router = useRouter();
  const cliente = useQueryClient();
  // Parte con lo que trajo el servidor y se actualiza sola: cada 30 segundos y al volver a la pestaña.
  const clave = ["remuneraciones", periodo];
  const { data } = useQuery({ queryKey: clave, queryFn: () => consultarRemuneraciones(periodo), initialData: datos, refetchInterval: 30_000 });
  const { filas, faltan } = data;
  /** Después de cualquier cambio, la lista se vuelve a pedir enseguida. */
  const volverAPedir = useCallback(() => void cliente.invalidateQueries({ queryKey: ["remuneraciones"] }), [cliente]);
  const [ocupado, iniciar] = useTransition();
  const [editando, setEditando] = useState<RemuneracionFila | null>(null);
  const [pagando, setPagando] = useState<RemuneracionFila[] | null>(null);
  // null = el primero de la lista; "" = el panel se cerró a propósito.
  const [sel, setSel] = useState<string | null>(null);
  const [movil, setMovil] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const cerrarEdicion = useCallback(() => {
    setEditando(null);
    volverAPedir();
  }, [volverAPedir]);
  const cerrarPago = useCallback(() => {
    setPagando(null);
    volverAPedir();
  }, [volverAPedir]);

  const imponibleTotal = filas.reduce((s, f) => s + imponibleDe(f), 0);
  const descuentosTotal = filas.reduce((s, f) => s + f.descuentos, 0);
  const total = filas.reduce((s, f) => s + f.liquido, 0);
  const pagado = filas.filter((f) => f.estado === "PAGADA").reduce((s, f) => s + f.liquido, 0);
  const avance = total > 0 ? Math.round((pagado / total) * 100) : 0;
  const listas = filas.filter((f) => f.estado === "LISTA");
  const porRevisar = filas.filter((f) => f.estado === "PENDIENTE");
  const sinPagar = filas.filter((f) => f.estado !== "PAGADA");
  const conCambios = sinPagar.filter((f) => desfaseConAsistencia(f) || (f.porDia && f.ausenciasMes.trabajados === 0));
  const pagadas = filas.length - sinPagar.length;

  const actual = sel === "" ? null : (filas.find((f) => f.id === sel) ?? filas[0] ?? null);
  const texto = busqueda.trim().toLowerCase();
  const visibles = filas.filter((f) => (filtro === "todas" || f.estado === filtro) && (!texto || `${f.trabajador} ${f.cargo}`.toLowerCase().includes(texto)));

  const pasos = [
    { t: "Asistencia del mes", d: conCambios.length ? `${conCambios.length} por revisar` : "Al día", ok: conCambios.length === 0, Icono: CalendarCheck2 },
    { t: "Liquidaciones", d: porRevisar.length ? `${porRevisar.length} por revisar` : listas.length ? `${listas.length} ${listas.length === 1 ? "lista" : "listas"} para pagar` : "Revisadas", ok: porRevisar.length === 0, Icono: FileText },
    { t: "Pago", d: `${pagadas} de ${filas.length} pagadas`, ok: sinPagar.length === 0, Icono: Banknote },
  ];

  function armar() {
    iniciar(async () => {
      const r = await generarMes(periodo);
      if (r.ok) toast.success("Liquidaciones armadas");
      else toast.error(r.error);
      volverAPedir();
    });
  }
  async function recalcular(objetivo: RemuneracionFila[]) {
    const pendientes = objetivo.filter((f) => f.estado !== "PAGADA");
    if (pendientes.length === 0) return;
    const ok = await confirmar({
      titulo: pendientes.length === 1 ? `¿Recalcular la liquidación de ${pendientes[0].trabajador}?` : `¿Recalcular las ${pendientes.length} liquidaciones sin pagar?`,
      descripcion: "Se vuelven a leer los días, permisos, horas extras y cuotas de préstamos. Los bonos, la colación, los otros descuentos y la nota se mantienen; los días y horas que hayas editado a mano se reemplazan. Las revisadas vuelven a «por revisar».",
      boton: "Recalcular",
      destructivo: false,
    });
    if (!ok) return;
    iniciar(async () => {
      const r = await recalcularRemuneraciones(pendientes.map((f) => f.id));
      if (r.ok) toast.success(r.cantidad === 1 ? "Liquidación recalculada" : `${r.cantidad} liquidaciones recalculadas`);
      else toast.error(r.error);
      volverAPedir();
    });
  }
  function revisar(f: RemuneracionFila, lista: boolean) {
    // El cambio de estado se ve al instante; si el servidor lo rechaza, vuelve a como estaba.
    const antes = cliente.getQueryData<DatosRemuneraciones>(clave);
    void cliente.cancelQueries({ queryKey: clave });
    cliente.setQueryData<DatosRemuneraciones>(clave, (d) => d && { ...d, filas: d.filas.map((x) => (x.id === f.id ? { ...x, estado: lista ? "LISTA" : "PENDIENTE" } : x)) });
    iniciar(async () => {
      const r = await cambiarRevision(f.id, lista);
      if (r.ok) toast.success(lista ? "Lista para pagar" : "Vuelve a «por revisar»");
      else {
        toast.error(r.error);
        cliente.setQueryData(clave, antes);
      }
      volverAPedir();
    });
  }
  async function deshacer(f: RemuneracionFila) {
    if (!(await confirmar({ titulo: `¿Deshacer el pago a ${f.trabajador}?`, descripcion: "También se quita de la Caja.", boton: "Deshacer pago" }))) return;
    iniciar(async () => {
      const r = await deshacerPago(f.id);
      if (r.ok) toast.success("Pago deshecho");
      else toast.error(r.error);
      volverAPedir();
    });
  }
  async function borrar(f: RemuneracionFila) {
    if (!(await confirmar({ titulo: `¿Quitar la liquidación de ${f.trabajador}?`, descripcion: "Se quita solo de este mes. Las cuotas de préstamos que llevaba quedan libres para el próximo armado.", boton: "Quitar" }))) return;
    iniciar(async () => {
      const r = await eliminarRemuneracion(f.id);
      if (r.ok) toast.success("Liquidación quitada");
      else toast.error(r.error);
      volverAPedir();
    });
  }

  const panel = actual ? (
    <PanelLiquidacion
      key={actual.id}
      f={actual}
      mesTexto={mesTexto}
      ocupado={ocupado}
      onCerrar={() => {
        setSel("");
        setMovil(false);
      }}
      onEditar={() => setEditando(actual)}
      onRecalcular={() => void recalcular([actual])}
      onRevision={(lista) => revisar(actual, lista)}
      onPagar={() => setPagando([actual])}
      onDeshacer={() => void deshacer(actual)}
    />
  ) : null;

  const indicadores: { k: string; v: string; d: string; tono?: string }[] = [
    { k: "1 · Total imponible", v: clp.format(imponibleTotal), d: "sueldo del mes + horas extras" },
    { k: "2 · Imposiciones y descuentos", v: descuentosTotal > 0 ? `-${clp.format(descuentosTotal)}` : clp.format(0), d: "AFP, salud, cesantía y préstamos", tono: "text-[#A32020]" },
    { k: "3 · Total a pagar", v: clp.format(total), d: `${avance} % ya pagado` },
    { k: "Pagado", v: clp.format(pagado), d: total - pagado > 0 ? `faltan ${clp.format(total - pagado)}` : "Todo pagado", tono: "text-[#075A3C]" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center rounded-xl bg-card p-1 shadow-[0_2px_8px_rgba(58,12,227,0.05)]">
          <Button variant="ghost" size="icon" aria-label="Mes anterior" className="size-9 rounded-lg" onClick={() => router.push(`/panel/remuneraciones?mes=${anterior}`)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-36 px-2 text-center text-sm font-semibold capitalize">{mesTexto}</span>
          <Button variant="ghost" size="icon" aria-label="Mes siguiente" className="size-9 rounded-lg" onClick={() => router.push(`/panel/remuneraciones?mes=${siguiente}`)}>
            <ChevronRight />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {sinPagar.length > 0 && (
            <Button variant="outline" className="h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold" disabled={ocupado} onClick={() => void recalcular(filas)} title="Vuelve a leer Asistencia, permisos y préstamos en las liquidaciones sin pagar">
              {ocupado ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              <span className="hidden sm:inline">Recalcular pendientes</span>
              <span className="sm:hidden">Recalcular</span>
            </Button>
          )}
          {filas.length > 0 && (
            <Button variant="outline" className="h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold" onClick={() => descargarLibro(filas, periodo)} title="Planilla del mes para tu contador o la directiva">
              <Download />
              <span className="hidden sm:inline">Libro del mes</span>
            </Button>
          )}
        </div>
      </div>

      {filas.length === 0 ? (
        <div className={cn("flex flex-col items-center rounded-2xl bg-card px-6 py-14 text-center", SOMBRA)}>
          <span className="flex size-11 items-center justify-center rounded-full bg-[#F4F3F9]">
            <FileText className="size-5 text-[#5B5970]" />
          </span>
          <h2 className="mt-4 text-[1rem] font-semibold">Este mes aún no tiene liquidaciones</h2>
          <p className={cn("mt-2 max-w-[56ch] text-[0.92rem] leading-relaxed", GRIS)}>
            Pulsa «Armar el mes» y se crea una liquidación por cada persona activa, con su sueldo, los días y horas no pagados, las horas extras, las cuotas de préstamos y su colación. Después revisas, ajustas lo que haga falta y pagas.
          </p>
          <Button className="mt-5 h-10 rounded-lg px-5 font-semibold" onClick={armar} disabled={ocupado}>
            {ocupado && <Loader2 className="animate-spin" />}
            Armar el mes
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            {indicadores.map((i) => (
              <div key={i.k} className={cn("min-w-0 rounded-2xl bg-card p-4 sm:p-6", SOMBRA)}>
                <p className={cn("truncate text-xs sm:text-[13px]", GRIS)}>{i.k}</p>
                <p className={cn("mt-1 truncate text-[17px] leading-none font-semibold tabular-nums sm:text-[28px]", i.tono)}>{i.v}</p>
                <p className={cn("mt-2 truncate text-xs", GRIS)}>{i.d}</p>
              </div>
            ))}
          </div>

          <div className={cn("rounded-2xl bg-card p-4 sm:px-6", SOMBRA)}>
            <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-0">
              {pasos.map((p, i) => (
                <li key={p.t} className="flex items-center gap-3 sm:pr-4">
                  <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", p.ok ? "bg-[#E6F6EF] text-[#0A7A52]" : "bg-[#FFF3E5] text-[#B86400]")}>
                    {p.ok ? <Check className="size-4" strokeWidth={3} /> : <p.Icono className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-xs", GRIS)}>Paso {i + 1}</span>
                    <span className="block truncate text-sm font-semibold">
                      {p.t} <span className={cn("font-normal", p.ok ? "text-[#075A3C]" : "text-[#8F4400]")}>· {p.d}</span>
                    </span>
                  </span>
                  {i < 2 && <ArrowRight className="hidden size-4 shrink-0 text-[#C9C6D8] sm:block" aria-hidden />}
                </li>
              ))}
            </ol>
            {mesEnCurso && sinPagar.length > 0 && (
              <p className={cn("mt-3 border-t border-[#F0EEF6] pt-3 text-xs", GRIS)}>
                El mes aún no termina: Asistencia y permisos pueden cambiar. Antes de pagar, usa «Recalcular» para tomar los datos al día.
              </p>
            )}
          </div>

          {faltan.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl bg-card/80 px-4 py-3 text-sm sm:flex-row sm:items-center">
              <Users className="hidden size-4 text-[#6B46F5] sm:block" aria-hidden />
              <span className={cn("flex-1", GRIS)}>
                <b className="font-semibold text-foreground">{faltan.map((f) => f.nombre).join(", ")}</b> {faltan.length === 1 ? "está" : "están"} en Personal pero no {faltan.length === 1 ? "tiene" : "tienen"} liquidación este mes.
              </span>
              <Button size="sm" variant="outline" onClick={armar} disabled={ocupado} className="h-9 self-start rounded-lg border-[#E4E1F0] bg-white font-semibold sm:self-auto">
                {ocupado ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />}
                Generar {faltan.length === 1 ? "liquidación" : "liquidaciones"}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className={cn("min-w-0 rounded-2xl bg-card", SOMBRA)}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EEF6] px-4 py-3 sm:px-6">
                <h2 className="shrink-0 text-[15px] font-semibold">
                  Liquidaciones <span className={cn("font-normal", GRIS)}>· {visibles.length}</span>
                </h2>
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                  <div className="relative min-w-0 flex-1 sm:max-w-[240px]">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input aria-label="Buscar persona" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar persona o cargo" className="h-9 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
                  </div>
                  <select aria-label="Estado" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className="h-9 rounded-lg border border-[#E4E1F0] bg-card px-2 text-[13px] font-medium">
                    <option value="todas">Todos los estados</option>
                    <option value="PENDIENTE">Por revisar</option>
                    <option value="LISTA">Listas para pagar</option>
                    <option value="PAGADA">Pagadas</option>
                  </select>
                </div>
                {listas.length > 1 && (
                  <Button size="sm" onClick={() => setPagando(listas)} className="h-9 rounded-lg px-3 font-semibold">
                    Pagar las {listas.length} listas
                  </Button>
                )}
              </div>
              <div className={cn("hidden grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_170px_36px] gap-3 border-b border-[#F3F1F8] bg-[#FAFAFD] px-6 py-2 text-xs font-medium md:grid", GRIS)}>
                <span>Persona</span>
                <span className="text-right">Imponible</span>
                <span className="text-right">Descuentos</span>
                <span className="text-right">Total a pagar</span>
                <span>Estado</span>
                <span />
              </div>
              {visibles.length === 0 && <p className={cn("px-6 py-12 text-center text-sm", GRIS)}>Nadie coincide con la búsqueda.</p>}
              <ul className="divide-y divide-[#F3F1F8]">
                {visibles.map((f) => {
                  const activo = actual?.id === f.id;
                  const pagada = f.estado === "PAGADA";
                  return (
                    <li key={f.id} className={cn("relative", activo ? "bg-[#F5F3FE] shadow-[inset_3px_0_0_#3A0CE3]" : "hover:bg-[#FBFAFF]")}>
                      <button
                        type="button"
                        onClick={() => {
                          setSel(f.id);
                          setMovil(true);
                        }}
                        aria-current={activo ? "true" : undefined}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-4 pr-12 text-left focus-visible:ring-2 focus-visible:ring-[#C4B7FA] focus-visible:outline-none focus-visible:ring-inset md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_170px] md:px-6 md:pr-14"
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-semibold">{f.trabajador}</span>
                            {f.porDia && <span className="shrink-0 rounded-md bg-[#F0EFF4] px-1.5 py-0.5 text-[11px] font-semibold text-[#4A4760]">Por día</span>}
                          </span>
                          <span className={cn("block text-[13px]", GRIS)}>{f.cargo}</span>
                        </span>
                        <span className="hidden text-right md:block">
                          <span className="block tabular-nums">{clp.format(imponibleDe(f))}</span>
                          <span className={cn("block text-xs", f.diasDescontados > 0 ? "text-[#8F4400]" : GRIS)}>{resumenDias(f)}</span>
                        </span>
                        <span className="hidden text-right md:block">
                          <span className="block tabular-nums">{f.descuentos > 0 ? `-${clp.format(f.descuentos)}` : "—"}</span>
                        </span>
                        <span className="text-right">
                          <span className="block text-[15px] font-semibold tabular-nums">{clp.format(f.liquido)}</span>
                          <span className={cn("block text-xs tabular-nums md:hidden", GRIS)}>
                            {clp.format(imponibleDe(f))} − {clp.format(f.descuentos)}
                          </span>
                        </span>
                        <span className="col-span-2 md:col-span-1">
                          <EstadoChip f={f} />
                        </span>
                      </button>
                      <span className="absolute top-3 right-3 md:top-1/2 md:-translate-y-1/2">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" aria-label={`Acciones de ${f.trabajador}`} className="size-8 rounded-lg">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.open(`/panel/remuneraciones/liquidacion/${f.id}`, "_blank", "noopener")}>
                              <FileText />
                              Ver liquidación (PDF)
                            </DropdownMenuItem>
                            {pagada ? (
                              <DropdownMenuItem onClick={() => void deshacer(f)}>
                                <Undo2 />
                                Deshacer pago
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={() => setEditando(f)}>
                                  <Pencil />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void recalcular([f])}>
                                  <RefreshCw />
                                  Recalcular desde Asistencia
                                </DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onClick={() => void borrar(f)}>
                                  <X />
                                  Quitar de este mes
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {panel && <div className={cn("hidden h-[min(720px,calc(100vh-2rem))] overflow-hidden rounded-2xl bg-card lg:sticky lg:top-4 lg:block", SOMBRA)}>{panel}</div>}
          </div>

          {panel && movil && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button type="button" aria-label="Cerrar" onClick={() => setMovil(false)} className="absolute inset-0 bg-[#15132B]/40" />
              <div className="absolute inset-x-0 bottom-0 h-[88vh] overflow-hidden rounded-t-2xl bg-white">{panel}</div>
            </div>
          )}
        </>
      )}

      {dialogo}
      {editando && <EditarDialog key={editando.id} fila={editando} onCerrar={cerrarEdicion} />}
      {pagando && <PagarDialog key={pagando.map((f) => f.id).join("-")} filas={pagando} onCerrar={cerrarPago} />}
    </div>
  );
}
