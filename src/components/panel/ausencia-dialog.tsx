"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Paperclip, X } from "lucide-react";
import { eliminarAusencia, guardarAusencia, type ResultadoAusencias } from "@/app/panel/ausencias/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASES, claseDe, cruces, type ClaseAusencia, type SaldoVacaciones } from "@/lib/ausencias-clases";
import { FERIADOS_NACIONALES } from "@/lib/feriados";
import { hoyEnChile } from "@/lib/finanzas-comun";
import { diasDe, type AusenciaFila, type EstadoAusencia, type TipoAusencia } from "@/lib/rrhh-comun";
import { useConfirmar } from "@/components/ui/confirmar";

const GRIS = "text-[#5B5970]";
const numero = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
const dia = (iso: string) => new Date(`${iso}T12:00:00`).getDay();

/** La clase (vacaciones, permiso con o sin goce, licencia) como el tipo y el «sin goce» que guarda el servidor. */
const tipoDe = (c: ClaseAusencia): TipoAusencia => (c === "VACACIONES" ? "VACACIONES" : c === "LICENCIA" ? "LICENCIA" : "PERMISO");

const ESTADOS: { valor: EstadoAusencia; texto: string }[] = [
  { valor: "APROBADA", texto: "Aprobada" },
  { valor: "SOLICITADA", texto: "Solicitada" },
  { valor: "RECHAZADA", texto: "Rechazada" },
];

/** Registrar unas vacaciones, un permiso o una licencia médica. Los días se calculan solos. */
export function AusenciaDialog({
  ausencia,
  tipo,
  personas,
  saldos,
  ajenas = [],
  onCerrar,
}: {
  ausencia: AusenciaFila | null;
  /** Lo que se registra: vacaciones o licencia (los permisos se eligen dentro de Vacaciones). */
  tipo: "VACACIONES" | "LICENCIA";
  personas: { id: string; nombre: string }[];
  /** Solo en vacaciones: lo que le queda a cada persona. */
  saldos?: SaldoVacaciones[];
  /** Las demás ausencias del comité (con su estado actual): sirven para avisar si estas fechas se cruzan con las de otra persona. */
  ajenas?: AusenciaFila[];
  onCerrar: () => void;
}) {
  const { confirmar, dialogo } = useConfirmar();
  const [estado, enviar, pendiente] = useActionState<ResultadoAusencias | null, FormData>(guardarAusencia, null);
  const [borrando, iniciarBorrado] = useTransition();
  const editando = ausencia !== null;
  const hoy = hoyEnChile();

  const clasesOfrecidas: ClaseAusencia[] = tipo === "LICENCIA" ? ["LICENCIA"] : ["VACACIONES", "CON_GOCE", "SIN_GOCE"];
  const [clase, setClase] = useState<ClaseAusencia>(ausencia ? claseDe(ausencia) : clasesOfrecidas[0]);
  const [personaId, setPersonaId] = useState(ausencia?.trabajadorId ?? personas[0]?.id ?? "");
  const [desde, setDesde] = useState(ausencia?.desde ?? hoy);
  const [hasta, setHasta] = useState(ausencia?.hasta ?? hoy);
  // Un permiso puede ser de unas horas dentro de un solo día.
  const [porHoras, setPorHoras] = useState(ausencia?.horas != null);
  const [horas, setHoras] = useState(ausencia?.horas != null ? String(ausencia.horas).replace(".", ",") : "");
  const [aprobada, setAprobada] = useState(true);
  const [estadoEditado, setEstadoEditado] = useState<EstadoAusencia>(ausencia?.estado ?? "APROBADA");
  const [archivo, setArchivo] = useState("");

  const tipoReal = tipoDe(clase);
  const esPermiso = tipoReal === "PERMISO";
  const esLicencia = tipoReal === "LICENCIA";
  const modoHoras = esPermiso && porHoras;
  const rangoOk = hasta >= desde;
  const dias = rangoOk ? diasDe(tipoReal, desde, modoHoras ? desde : hasta) : 0;
  const estadoFinal: EstadoAusencia = editando ? estadoEditado : aprobada ? "APROBADA" : "SOLICITADA";

  // Lo que le queda a la persona: si se edita unas vacaciones ya aprobadas, esos días ya están descontados del saldo.
  const saldoPersona = saldos?.find((s) => s.id === personaId) ?? null;
  const saldo = saldoPersona?.saldo ?? null;
  const primerAnio = saldoPersona !== null && saldoPersona.ganados === 0 && saldoPersona.desde !== null;
  const yaDescontado = ausencia && ausencia.tipo === "VACACIONES" && ausencia.estado === "APROBADA" && ausencia.trabajadorId === personaId ? ausencia.dias : 0;
  const disponibles = saldo === null ? null : saldo + yaDescontado;
  const queda = disponibles === null ? null : disponibles - dias;
  const excede = clase === "VACACIONES" && queda !== null && queda < 0;
  const nombrePersona = personas.find((p) => p.id === personaId)?.nombre.split(" ")[0] ?? "";
  const choques = rangoOk && personaId ? cruces({ id: ausencia?.id ?? "_", trabajadorId: personaId, desde, hasta: modoHoras ? desde : hasta }, ajenas) : [];
  const quedarian = personas.length - 1 - new Set(choques.map((c) => c.trabajadorId)).size;
  const rangoCorto = (c: AusenciaFila) => (c.desde === c.hasta ? c.desde.split("-").reverse().slice(0, 2).join("-") : `${c.desde.split("-").reverse().slice(0, 2).join("-")} al ${c.hasta.split("-").reverse().slice(0, 2).join("-")}`);
  const feriados = Object.keys(FERIADOS_NACIONALES).filter((f) => f >= desde && f <= hasta && dia(f) !== 0 && dia(f) !== 6);

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Registro actualizado" : "Registro guardado");
      onCerrar();
    }
  }, [estado, editando, onCerrar]);

  async function borrar() {
    if (!ausencia) return;
    if (!(await confirmar({ titulo: "¿Borrar este registro?", descripcion: "No se puede deshacer.", boton: "Borrar" }))) return;
    iniciarBorrado(async () => {
      const r = await eliminarAusencia(ausencia.id);
      if (r.ok) {
        toast.success("Registro borrado");
        onCerrar();
      } else {
        toast.error(r.error);
      }
    });
  }

  const valido = Boolean(personaId) && rangoOk && (modoHoras ? Number(horas.replace(",", ".")) > 0 : dias > 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[94dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[92vh] sm:w-[560px] sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0"
      >
        <form action={enviar} className="flex min-h-0 flex-1 flex-col">
          {editando && <input type="hidden" name="id" value={ausencia.id} />}
          <input type="hidden" name="tipo" value={tipoReal} />
          <input type="hidden" name="trabajadorId" value={personaId} />
          <input type="hidden" name="estado" value={estadoFinal} />
          {esPermiso && clase === "SIN_GOCE" ? <input type="hidden" name="sinGoce" value="si" /> : null}
          {modoHoras ? <input type="hidden" name="hasta" value={desde} /> : null}
          {/* La nota larga que ya tenía el registro se conserva aunque aquí solo se edite el detalle. */}
          <input type="hidden" name="nota" value={ausencia?.nota ?? ""} />
          {/* El motivo de un rechazo se conserva mientras siga rechazada. */}
          <input type="hidden" name="motivoRechazo" value={ausencia?.motivoRechazo ?? ""} />

          <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold">{editando ? "Editar ausencia" : tipo === "LICENCIA" ? "Registrar licencia" : "Registrar ausencia"}</DialogTitle>
              <p className={`mt-0.5 text-[13px] ${GRIS}`}>{tipo === "LICENCIA" ? "Licencia médica del personal." : "Vacaciones, permisos o licencias del personal."}</p>
            </div>
            <DialogClose aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
              <X className="size-[18px]" />
            </DialogClose>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="block">
              <span className="text-[13px] font-semibold">Persona</span>
              <Select items={personas.map((p) => ({ value: p.id, label: p.nombre }))} value={personaId} onValueChange={(v) => setPersonaId(v ?? "")}>
                <SelectTrigger className="mt-1.5 h-11 w-full rounded-xl border-[#E4E1F0] px-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {personas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {clasesOfrecidas.length > 1 ? (
              <div>
                <span className="text-[13px] font-semibold">Tipo</span>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {clasesOfrecidas.map((c) => {
                    const x = CLASES[c];
                    return (
                      <button key={c} type="button" onClick={() => setClase(c)} aria-pressed={clase === c} className={`rounded-xl border px-3 py-2.5 text-left ${clase === c ? "border-[#3A0CE3] bg-[#F4F1FF] ring-1 ring-[#3A0CE3]" : "border-[#E4E1F0] hover:bg-[#F8F7FC]"}`}>
                        <span className="flex items-center gap-2 text-[13px] font-semibold">
                          <span aria-hidden className={`size-2 rounded-full ${x.color}`} />
                          {x.texto}
                        </span>
                        <span className={`mt-0.5 block text-[11px] ${GRIS}`}>{x.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {esPermiso ? (
              <div role="radiogroup" aria-label="Duración del permiso" className="grid grid-cols-2 gap-1 rounded-lg bg-[#F4F3F9] p-1">
                {(
                  [
                    [false, "Uno o más días"],
                    [true, "Unas horas"],
                  ] as const
                ).map(([valor, texto]) => (
                  <button key={texto} type="button" role="radio" aria-checked={porHoras === valor} onClick={() => setPorHoras(valor)} className={`h-8 rounded-md text-[13px] font-semibold ${porHoras === valor ? "bg-white text-[#2A07A8] shadow-sm" : GRIS}`}>
                    {texto}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[13px] font-semibold">{modoHoras ? "Día" : "Desde"}</span>
                <Input name="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] shadow-none" />
              </label>
              {modoHoras ? (
                <label className="block">
                  <span className="text-[13px] font-semibold">Horas</span>
                  <Input name="horas" value={horas} onChange={(e) => setHoras(e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))} inputMode="decimal" placeholder="Ej.: 2,5" required className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] shadow-none" />
                </label>
              ) : (
                <label className="block">
                  <span className="text-[13px] font-semibold">Hasta</span>
                  <Input name="hasta" type="date" min={desde} value={hasta} onChange={(e) => setHasta(e.target.value)} required className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] shadow-none" />
                </label>
              )}
            </div>

            {rangoOk ? (
              modoHoras ? (
                <p className="rounded-xl bg-[#F8F7FC] px-4 py-3 text-xs text-[#5B5970]">{clase === "SIN_GOCE" ? "Esas horas se descuentan en la liquidación del mes. No gastan días de vacaciones." : "No descuenta sueldo ni días de vacaciones."}</p>
              ) : (
                <div className={`rounded-xl px-4 py-3 ${excede ? "bg-[#FFF6E8]" : "bg-[#F8F7FC]"}`}>
                  <p className="flex items-baseline justify-between text-sm">
                    <span className={GRIS}>{esLicencia ? "Días corridos" : "Días hábiles"}</span>
                    <b className="text-lg font-semibold tabular-nums">{dias}</b>
                  </p>
                  <p className={`text-xs ${GRIS}`}>
                    {esLicencia ? "Se cuentan todos los días del período" : `Sin contar sábados, domingos ni feriados${feriados.length ? ` (${feriados.map((f) => FERIADOS_NACIONALES[f]).join(", ")})` : ""}`}
                  </p>
                  {clase === "VACACIONES" && disponibles !== null ? (
                    <p className={`mt-2 border-t border-black/5 pt-2 text-[13px] ${excede ? "font-medium text-[#7A4A00]" : ""}`}>
                      {primerAnio && saldoPersona?.desde ? (
                        `${nombrePersona || "La persona"} aún no cumple un año en el comité: podrá tomar vacaciones desde el ${saldoPersona.desde.split("-").reverse().join("-")}.`
                      ) : queda !== null && queda < 0 ? (
                        `Le faltan ${numero(-queda)} días: tiene ${numero(disponibles)} disponibles.`
                      ) : (
                        <>
                          {nombrePersona ? `A ${nombrePersona} le` : "Le"} quedarán <b className="font-semibold">{numero(queda ?? 0)} de {numero(disponibles)}</b> días disponibles.
                        </>
                      )}
                    </p>
                  ) : null}
                </div>
              )
            ) : (
              <p className="text-xs text-[#A32020]">La fecha de término debe ser igual o posterior al inicio.</p>
            )}

            {choques.length > 0 ? (
              <p className="flex items-start gap-2 rounded-xl bg-[#FFF6E8] px-3.5 py-2.5 text-[13px] text-[#7A4A00]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Se cruza con {choques.map((c) => `${c.trabajador.split(" ")[0]} (${CLASES[claseDe(c)].texto.toLowerCase()}, ${rangoCorto(c)})`).join(" y ")}. Quedarían {Math.max(0, quedarian)} de {personas.length} trabajando.
                </span>
              </p>
            ) : null}

            {esLicencia ? (
              <label className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#C9BCFB] px-3.5 py-3 text-left text-sm hover:bg-[#FAF8FF]">
                <Paperclip className="size-4 shrink-0 text-[#6B46F5]" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{archivo || (ausencia?.adjuntoId ? "Reemplazar la licencia médica adjunta" : "Adjuntar licencia médica")}</span>
                  <span className={`block text-xs ${GRIS}`}>PDF o foto, de hasta 3 MB. Puedes agregarla después.</span>
                </span>
                <input type="file" name="archivo" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0]?.name ?? "")} />
              </label>
            ) : null}

            <label className="block">
              <span className="text-[13px] font-semibold">
                {esLicencia ? "Folio o motivo" : "Nota"} <span className={`font-normal ${GRIS}`}>(opcional)</span>
              </span>
              <Input name="detalle" defaultValue={ausencia?.detalle ?? ""} maxLength={200} placeholder={esLicencia ? "Ej.: folio 123456" : "Ej.: queda de turno Pedro"} className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] shadow-none" />
            </label>

            {editando ? (
              <div>
                <span className="text-[13px] font-semibold">Estado</span>
                <div role="radiogroup" aria-label="Estado" className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-[#F4F3F9] p-1">
                  {ESTADOS.map((e) => (
                    <button key={e.valor} type="button" role="radio" aria-checked={estadoEditado === e.valor} onClick={() => setEstadoEditado(e.valor)} className={`h-8 rounded-md text-[13px] font-semibold ${estadoEditado === e.valor ? "bg-white text-[#2A07A8] shadow-sm" : GRIS}`}>
                      {e.texto}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E4E1F0] p-3">
                <input type="checkbox" checked={aprobada} onChange={(e) => setAprobada(e.target.checked)} className="size-[18px] accent-[#3A0CE3]" />
                <span className="text-sm">
                  <span className="font-semibold">Dejar aprobada</span>
                  <span className={`block text-xs ${GRIS}`}>Desmárcalo si la directiva todavía debe aprobarla.</span>
                </span>
              </label>
            )}

            {estado && !estado.ok ? (
              <p role="alert" className="rounded-xl bg-[#FDECEC] px-3 py-2.5 text-sm font-medium text-[#A32020]">
                {estado.error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
            {editando ? (
              <Button type="button" variant="ghost" onClick={borrar} disabled={borrando || pendiente} className="h-11 rounded-xl px-3 font-semibold text-[#A32020] hover:text-[#A32020]">
                {borrando && <Loader2 className="animate-spin" />}
                Borrar
              </Button>
            ) : null}
            <span className="flex-1" />
            <DialogClose render={<Button type="button" variant="outline" className="h-11 rounded-xl border-[#E4E1F0] bg-white font-semibold" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendiente || borrando || !valido} className="h-11 rounded-xl px-5 font-semibold">
              {pendiente && <Loader2 className="animate-spin" />}
              {editando ? "Guardar cambios" : "Registrar"}
            </Button>
          </div>
        </form>
        {dialogo}
      </DialogContent>
    </Dialog>
  );
}
