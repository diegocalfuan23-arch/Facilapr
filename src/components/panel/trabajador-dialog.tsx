"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2 } from "lucide-react";
import { generarInvitacionOperador } from "@/app/panel/lecturas/actions";
import { eliminarTrabajador, guardarTrabajador, type ResultadoPersonal } from "@/app/panel/personal/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmar } from "@/components/ui/confirmar";
import {
  AFPS,
  CARGOS_SUGERIDOS,
  TASA_CESANTIA,
  TASA_RETENCION_HONORARIOS,
  descuentosLegales,
  tasaAfp,
  textoTasa,
  JORNADA_SEMANAL_LEGAL,
  RECARGO_HORA_EXTRA,
  TEXTO_ACCESO,
  horasPorDia,
  valorDeHoraExtra,
  valorHoraOrdinaria,
  type AccesoPanel,
  type Contrato,
  type TrabajadorFila,
} from "@/lib/personal-comun";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const campo = "h-10 px-3 text-[0.95rem]";
const etiqueta = "mb-2 block text-[0.8rem] font-medium";
const selectClase =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Una tasa guardada en centésimas se muestra como la escribe la gente: 1058 → «10,58». */
const aTextoTasa = (c: number) => (c / 100).toString().replace(".", ",");
const deTextoTasa = (t: string) => {
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** Agregar a una persona del comité, o corregir su ficha: sueldo bruto, descuentos legales y líquido. */
export function TrabajadorDialog({
  persona,
  inicial = null,
  acceso = null,
  puedeTesorero = false,
  onCerrar,
}: {
  persona: TrabajadorFila | null;
  /** Datos con que parte una ficha nueva: se usa al crearla desde una cuenta del panel. */
  inicial?: { nombre: string; email: string; cargo: string } | null;
  /** El acceso al panel que ya tiene esta persona, si tiene cuenta con su mismo correo. */
  acceso?: AccesoPanel | null;
  /** El plan incluye Finanzas: solo entonces se puede invitar como tesorero. */
  puedeTesorero?: boolean;
  onCerrar: () => void;
}) {
  const { confirmar, dialogo } = useConfirmar();
  const [estado, enviar, pendiente] = useActionState<ResultadoPersonal | null, FormData>(guardarTrabajador, null);
  const [borrando, iniciarBorrado] = useTransition();
  const editando = persona !== null;
  const [sueldo, setSueldo] = useState(persona?.sueldo ? String(persona.sueldo) : "");
  const [valorDia, setValorDia] = useState(persona?.valorDia ? String(persona.valorDia) : "");
  const [porDia, setPorDia] = useState(persona?.porDia ?? false);
  const [jornada, setJornada] = useState(String(persona?.jornadaSemanal ?? JORNADA_SEMANAL_LEGAL).replace(".", ","));
  const [diasSemana, setDiasSemana] = useState(String(persona?.diasSemana ?? 5));
  const [valorExtra, setValorExtra] = useState(persona?.valorHoraExtra ? String(persona.valorHoraExtra) : "");
  const datosJornada = {
    sueldo: Number(sueldo) || 0,
    valorDia: Number(valorDia) || null,
    porDia,
    jornadaSemanal: Number(jornada.replace(",", ".")) || 0,
    diasSemana: Number(diasSemana) || 5,
    valorHoraExtra: Number(valorExtra) || null,
  };
  const [contrato, setContrato] = useState<Contrato>(persona?.contrato ?? "SUELDO");
  const [afp, setAfp] = useState(persona?.afp ?? "");
  const [afpTasaTexto, setAfpTasaTexto] = useState(persona ? aTextoTasa(persona.afpTasa) : "");
  const [saludTexto, setSaludTexto] = useState(persona ? aTextoTasa(persona.saludTasa) : "7");
  const [cesantia, setCesantia] = useState(persona?.cesantia ?? true);

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Ficha actualizada" : "Persona agregada");
      onCerrar();
    }
  }, [estado, editando, onCerrar]);

  function elegirAfp(nombre: string) {
    setAfp(nombre);
    const a = AFPS.find((x) => x.nombre === nombre);
    if (a) setAfpTasaTexto(aTextoTasa(tasaAfp(a.comision)));
  }

  async function borrar() {
    if (!persona) return;
    if (!(await confirmar({ titulo: `¿Borrar a «${persona.nombre}»?`, descripcion: "No se puede deshacer.", boton: "Borrar" }))) return;
    iniciarBorrado(async () => {
      const r = await eliminarTrabajador(persona.id);
      if (r.ok) {
        toast.success("Persona borrada");
        onCerrar();
      } else {
        toast.error(r.error);
      }
    });
  }

  const bruto = Number(sueldo) || 0;
  const desc = descuentosLegales({ contrato, afpTasa: deTextoTasa(afpTasaTexto), saludTasa: deTextoTasa(saludTexto), cesantia }, bruto);
  const liquido = bruto - desc.total;

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-xl sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">{editando ? "Editar ficha" : "Nueva persona"}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">Quien trabaja para el comité y cobra por ello.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="mt-2 flex flex-col gap-4">
          {editando && <input type="hidden" name="id" value={persona.id} />}
          <input type="hidden" name="sueldo" value={sueldo} />
          <input type="hidden" name="valorDia" value={valorDia} />
          <input type="hidden" name="porDia" value={porDia ? "si" : "no"} />
          <input type="hidden" name="jornadaSemanal" value={jornada} />
          <input type="hidden" name="diasSemana" value={diasSemana} />
          <input type="hidden" name="valorHoraExtra" value={valorExtra} />
          <input type="hidden" name="afp" value={afp} />
          <input type="hidden" name="afpTasa" value={afpTasaTexto} />
          <input type="hidden" name="saludTasa" value={saludTexto} />
          <input type="hidden" name="cesantia" value={cesantia ? "si" : "no"} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="per-nombre" className={etiqueta}>
                Nombre
              </label>
              <Input id="per-nombre" name="nombre" defaultValue={persona?.nombre ?? inicial?.nombre} maxLength={120} className={campo} autoFocus required />
            </div>
            <div>
              <label htmlFor="per-cargo" className={etiqueta}>
                Cargo
              </label>
              <Input id="per-cargo" name="cargo" list="per-cargos" defaultValue={persona?.cargo ?? inicial?.cargo} maxLength={60} className={campo} required />
              <datalist id="per-cargos">
                {CARGOS_SUGERIDOS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="per-rut" className={etiqueta}>
                RUT (opcional)
              </label>
              <Input id="per-rut" name="rut" defaultValue={persona?.rut ?? ""} placeholder="12.345.678-9" maxLength={20} className={campo} />
            </div>
            <div>
              <label htmlFor="per-telefono" className={etiqueta}>
                Teléfono (opcional)
              </label>
              <Input id="per-telefono" name="telefono" defaultValue={persona?.telefono ?? ""} maxLength={30} className={campo} />
            </div>
            <div>
              <label htmlFor="per-ingreso" className={etiqueta}>
                Fecha de ingreso (opcional)
              </label>
              <Input id="per-ingreso" name="fechaIngreso" type="date" defaultValue={persona?.fechaIngreso ?? ""} className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="per-email" className={etiqueta}>
                Correo (opcional)
              </label>
              <Input id="per-email" name="email" type="email" defaultValue={persona?.email ?? inicial?.email ?? ""} maxLength={120} className={campo} />
            </div>
          </div>

          <h3 className="mt-2 text-[0.95rem] font-medium">Sueldo</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="per-modalidad" className={etiqueta}>
                Cómo se le paga
              </label>
              <select id="per-modalidad" value={porDia ? "dia" : "mes"} onChange={(e) => setPorDia(e.target.value === "dia")} className={selectClase}>
                <option value="mes">Sueldo mensual</option>
                <option value="dia">Por día trabajado</option>
              </select>
              {porDia && <p className="mt-1.5 text-[0.75rem] text-muted-foreground">Cada mes se le paga según los días que trabajó, tomados de la asistencia. Los puedes ajustar al armar la liquidación.</p>}
            </div>
            <div>
              <label htmlFor="per-contrato" className={etiqueta}>
                Forma de pago
              </label>
              <select id="per-contrato" name="contrato" value={contrato} onChange={(e) => setContrato(e.target.value as Contrato)} className={selectClase}>
                <option value="SUELDO">Sueldo (con contrato)</option>
                <option value="HONORARIO">Honorarios (boleta)</option>
              </select>
            </div>
            {porDia ? (
              <div>
                <label htmlFor="per-valordia-dia" className={etiqueta}>
                  Valor por día trabajado
                </label>
                <Input
                  id="per-valordia-dia"
                  value={valorDia ? `$${Number(valorDia).toLocaleString("es-CL")}` : ""}
                  onChange={(e) => setValorDia(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="$0"
                  inputMode="numeric"
                  className={campo}
                />
              </div>
            ) : (
              <>
            <div>
              <label htmlFor="per-sueldo" className={etiqueta}>
                Sueldo bruto mensual
              </label>
              <Input
                id="per-sueldo"
                value={sueldo ? `$${Number(sueldo).toLocaleString("es-CL")}` : ""}
                onChange={(e) => setSueldo(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="$0"
                inputMode="numeric"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="per-valordia" className={etiqueta}>
                Valor del día (opcional)
              </label>
              <Input
                id="per-valordia"
                value={valorDia ? `$${Number(valorDia).toLocaleString("es-CL")}` : ""}
                onChange={(e) => setValorDia(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder={`$${Math.round((Number(sueldo) || 0) / 30).toLocaleString("es-CL")} (sueldo ÷ 30)`}
                inputMode="numeric"
                className={campo}
              />
              <p className="mt-1.5 text-[0.75rem] text-muted-foreground">Es lo que se descuenta por cada día que no trabaje. Si lo dejas vacío, se usa el sueldo dividido en 30.</p>
            </div>

              </>
            )}

            <div>
              <label htmlFor="per-jornada" className={etiqueta}>
                Jornada (horas por semana)
              </label>
              <Input id="per-jornada" value={jornada} onChange={(e) => setJornada(e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))} inputMode="decimal" className={campo} />
              <p className="mt-1.5 text-[0.75rem] text-muted-foreground">{JORNADA_SEMANAL_LEGAL} horas desde el 26-04-2026 (Ley 21.561). En una jornada parcial, las que corresponda.</p>
            </div>
            <div>
              <label htmlFor="per-diassem" className={etiqueta}>
                Días a la semana
              </label>
              <select id="per-diassem" value={diasSemana} onChange={(e) => setDiasSemana(e.target.value)} className={selectClase}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[0.75rem] text-muted-foreground">Su día dura {String(Math.round(horasPorDia(datosJornada) * 10) / 10).replace(".", ",")} horas.</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="per-extra" className={etiqueta}>
                Valor de la hora extra (opcional)
              </label>
              <Input
                id="per-extra"
                value={valorExtra ? `$${Number(valorExtra).toLocaleString("es-CL")}` : ""}
                onChange={(e) => setValorExtra(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder={`$${valorDeHoraExtra({ ...datosJornada, valorHoraExtra: null }).toLocaleString("es-CL")} (legal)`}
                inputMode="numeric"
                className={campo}
              />
              <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
                Hora ordinaria ${Math.round(valorHoraOrdinaria(datosJornada)).toLocaleString("es-CL")}; la extra lleva un recargo del {RECARGO_HORA_EXTRA * 100} % por ley. Si el comité paga otro valor, escríbelo aquí; vacío, se usa el legal.
              </p>
            </div>

            {contrato === "SUELDO" ? (
              <>
                <div>
                  <label htmlFor="per-afp" className={etiqueta}>
                    AFP
                  </label>
                  <select id="per-afp" value={afp} onChange={(e) => elegirAfp(e.target.value)} className={selectClase}>
                    <option value="">Elige la AFP…</option>
                    {AFPS.map((a) => (
                      <option key={a.nombre} value={a.nombre}>
                        {a.nombre}
                      </option>
                    ))}
                    {afp && !AFPS.some((a) => a.nombre === afp) && <option value={afp}>{afp}</option>}
                  </select>
                </div>
                <div>
                  <label htmlFor="per-afp-tasa" className={etiqueta}>
                    Descuento AFP (%)
                  </label>
                  <Input id="per-afp-tasa" value={afpTasaTexto} onChange={(e) => setAfpTasaTexto(e.target.value.replace(/[^\d,.]/g, "").slice(0, 6))} placeholder="10,58" inputMode="decimal" className={campo} />
                  <p className="mt-1.5 text-[0.75rem] text-muted-foreground">10 % más la comisión de la AFP. Confirma la comisión vigente en su liquidación.</p>
                </div>
                <div>
                  <label htmlFor="per-salud" className={etiqueta}>
                    Descuento de salud (%)
                  </label>
                  <Input id="per-salud" value={saludTexto} onChange={(e) => setSaludTexto(e.target.value.replace(/[^\d,.]/g, "").slice(0, 6))} placeholder="7" inputMode="decimal" className={campo} />
                  <p className="mt-1.5 text-[0.75rem] text-muted-foreground">7 % en Fonasa. En Isapre puede ser más.</p>
                </div>
                <label className="flex items-center gap-2 text-[0.9rem] sm:mt-7">
                  <input type="checkbox" checked={cesantia} onChange={(e) => setCesantia(e.target.checked)} className="size-4" />
                  Seguro de cesantía ({textoTasa(TASA_CESANTIA)})
                </label>
              </>
            ) : (
              <p className="text-[0.85rem] text-muted-foreground sm:col-span-2">A honorarios se retiene el {textoTasa(TASA_RETENCION_HONORARIOS)} de la boleta (tasa 2026) y no hay AFP ni salud.</p>
            )}
          </div>

          {!porDia && bruto > 0 && (
            <div className="rounded-xl border border-border bg-card px-4 py-3 text-[0.9rem]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sueldo bruto</span>
                <span className="tabular-nums">{clp.format(bruto)}</span>
              </div>
              {contrato === "SUELDO" ? (
                <>
                  <div className="mt-1 flex justify-between text-muted-foreground">
                    <span>AFP {afp && `(${afp})`}</span>
                    <span className="tabular-nums">-{clp.format(desc.afp)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Salud</span>
                    <span className="tabular-nums">-{clp.format(desc.salud)}</span>
                  </div>
                  {cesantia && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Seguro de cesantía</span>
                      <span className="tabular-nums">-{clp.format(desc.cesantia)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-1 flex justify-between text-muted-foreground">
                  <span>Retención de honorarios</span>
                  <span className="tabular-nums">-{clp.format(desc.retencion)}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium">Líquido a pagar</span>
                <span className="text-[1.15rem] font-bold tabular-nums">{clp.format(liquido)}</span>
              </div>
              <p className="mt-2 text-[0.75rem] text-muted-foreground">Estimación: no considera el tope imponible ni el impuesto único.</p>
            </div>
          )}

          {editando && <AccesoAlPanel acceso={acceso} tieneCorreo={Boolean(persona.email)} puedeTesorero={puedeTesorero} />}

          <div>
            <label htmlFor="per-notas" className={etiqueta}>
              Notas (opcional)
            </label>
            <Textarea id="per-notas" name="notas" defaultValue={persona?.notas ?? ""} rows={2} maxLength={500} />
          </div>
          {editando && (
            <div>
              <label htmlFor="per-activo" className={etiqueta}>
                Estado
              </label>
              <select id="per-activo" name="activo" defaultValue={persona.activo ? "si" : "no"} className={selectClase}>
                <option value="si">Activo</option>
                <option value="no">Inactivo (ya no trabaja en el comité)</option>
              </select>
            </div>
          )}

          {estado && !estado.ok && (
            <p className="text-[0.8rem] text-destructive" role="alert">
              {estado.error}
            </p>
          )}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {editando ? (
              <Button type="button" variant="ghost" className="h-10 px-4 text-[0.95rem] text-destructive" onClick={borrar} disabled={borrando || pendiente}>
                {borrando && <Loader2 className="animate-spin" />}
                Borrar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" className="h-10 rounded-full px-5 text-[0.95rem]" disabled={pendiente || borrando}>
                {pendiente && <Loader2 className="animate-spin" />}
                {editando ? "Guardar cambios" : "Agregar persona"}
              </Button>
            </div>
          </div>
        </form>
        {dialogo}
      </DialogContent>
    </Dialog>
  );
}

/**
 * El acceso de una persona al panel: si ya tiene cuenta lo dice; si no, genera la invitación (un enlace de un
 * solo uso) para que cree la suya como operador o como tesorero. Son botones sueltos: no envían la ficha.
 */
function AccesoAlPanel({ acceso, tieneCorreo, puedeTesorero }: { acceso: AccesoPanel | null; tieneCorreo: boolean; puedeTesorero: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [generando, iniciar] = useTransition();

  function invitar(rol: "OPERADOR" | "TESORERO") {
    setUrl(null);
    iniciar(async () => {
      const r = await generarInvitacionOperador(rol);
      if (r.ok) setUrl(r.url);
      else toast.error(r.error);
    });
  }

  async function copiar() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    toast.success("Enlace de invitación copiado");
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="text-[0.9rem] font-semibold">Acceso al panel</h3>
      {acceso ? (
        <p className="mt-1 text-[0.85rem] text-muted-foreground">
          {acceso === "DESACTIVADO" ? "Tiene cuenta, pero se le quitó el acceso." : `Tiene cuenta como ${TEXTO_ACCESO[acceso].toLowerCase()}.`} Se administra en Equipo.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">
            No tiene cuenta. Si necesita entrar al panel, invítala: se genera un enlace de un solo uso.
            {!tieneCorreo && " Para que quede ligada a esta ficha, guarda antes su correo y usa ese mismo al crear la cuenta."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-9 px-4 text-[0.85rem]" disabled={generando} onClick={() => invitar("OPERADOR")}>
              {generando && <Loader2 className="animate-spin" />}
              Invitar como operador
            </Button>
            {puedeTesorero && (
              <Button type="button" variant="outline" className="h-9 px-4 text-[0.85rem]" disabled={generando} onClick={() => invitar("TESORERO")}>
                Invitar como tesorero
              </Button>
            )}
          </div>
          {url && (
            <div className="mt-3 flex min-w-0 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 py-2">
              <span title={url} className="min-w-0 flex-1 truncate text-[0.85rem]">
                {url}
              </span>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={copiar}>
                {copiado ? <Check className="text-forest" /> : <Copy />}
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
