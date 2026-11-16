"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Copy, KeyRound, Loader2, Mail, ShieldCheck, Smartphone, Users, X, type LucideIcon } from "lucide-react";
import { generarInvitacionOperador } from "@/app/panel/lecturas/actions";
import { eliminarTrabajador, guardarTrabajador, type ResultadoPersonal } from "@/app/panel/personal/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmar } from "@/components/ui/confirmar";
import {
  AFPS,
  CARGOS_SUGERIDOS,
  JORNADA_SEMANAL_LEGAL,
  TASA_CESANTIA,
  TASA_RETENCION_HONORARIOS,
  TEXTO_ACCESO,
  horasPorDia,
  liquidacionEstimada,
  tasaAfp,
  textoTasa,
  valorDeHoraExtra,
  valorHoraOrdinaria,
  type AccesoPanel,
  type TrabajadorFila,
} from "@/lib/personal-comun";

const GRIS = "text-[#5B5970]";
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const inputCls = "h-11 rounded-xl border-[#E4E1F0] shadow-none";
const iniciales = (s: string) =>
  s
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Una tasa guardada en centésimas se muestra como la escribe la gente: 1058 → «10,58». */
const aTextoTasa = (c: number) => (c / 100).toString().replace(".", ",");
const deTextoTasa = (t: string) => {
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const soloDigitos = (t: string, largo = 9) => t.replace(/\D/g, "").slice(0, largo);
const dinero = (t: string) => (t ? `$${Number(t).toLocaleString("es-CL")}` : "");

type Tipo = "mensual" | "diario" | "honorarios";
const TIPOS: { id: Tipo; nombre: string; desc: string }[] = [
  { id: "mensual", nombre: "Sueldo mensual", desc: "Contrato con sueldo fijo cada mes" },
  { id: "diario", nombre: "Pago por día", desc: "Se paga por los días trabajados" },
  { id: "honorarios", nombre: "Honorarios", desc: "Boleta de honorarios, sin contrato" },
];
const PASOS = ["Datos", "Sueldo", "Previsión", "Acceso"];

function Campo({ label, ayuda, children, className = "" }: { label: string; ayuda?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="text-[13px] font-semibold">{label}</span>
      <div className="mt-1.5">{children}</div>
      {ayuda ? <span className={`mt-1 block text-xs leading-snug ${GRIS}`}>{ayuda}</span> : null}
    </div>
  );
}

/** Dos o tres botones para elegir una opción, como el selector de la maqueta. */
function Opciones<T extends string>({ valor, opciones, onCambio }: { valor: T; opciones: readonly (readonly [T, string])[]; onCambio: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-xl bg-[#F4F3F9] p-1" style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
      {opciones.map(([k, t]) => (
        <button key={k} type="button" onClick={() => onCambio(k)} className={`h-9 rounded-lg text-[13px] font-semibold ${valor === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

/** Agregar a una persona del comité, o corregir su ficha, en cuatro pasos: datos, sueldo, previsión y acceso. */
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
  const [paso, setPaso] = useState(0);

  const [nombre, setNombre] = useState(persona?.nombre ?? inicial?.nombre ?? "");
  const [cargo, setCargo] = useState(persona?.cargo ?? inicial?.cargo ?? "");
  const [rut, setRut] = useState(persona?.rut ?? "");
  const [telefono, setTelefono] = useState(persona?.telefono ?? "");
  const [email, setEmail] = useState(persona?.email ?? inicial?.email ?? "");
  const [ingreso, setIngreso] = useState(persona?.fechaIngreso ?? "");
  const [notas, setNotas] = useState(persona?.notas ?? "");

  const [tipo, setTipo] = useState<Tipo>(persona ? (persona.contrato === "HONORARIO" ? "honorarios" : persona.porDia ? "diario" : "mensual") : "mensual");
  const [sueldo, setSueldo] = useState(persona?.sueldo ? String(persona.sueldo) : "");
  const [valorDia, setValorDia] = useState(persona?.valorDia ? String(persona.valorDia) : "");
  const [jornada, setJornada] = useState(String(persona?.jornadaSemanal ?? JORNADA_SEMANAL_LEGAL).replace(".", ","));
  const [diasSemana, setDiasSemana] = useState(persona?.diasSemana ?? 5);
  const [valorExtra, setValorExtra] = useState(persona?.valorHoraExtra ? String(persona.valorHoraExtra) : "");
  const [noImp, setNoImp] = useState(persona?.noImponible ? String(persona.noImponible) : "");
  const [cesantia, setCesantia] = useState(persona?.cesantia ?? true);

  const [afp, setAfp] = useState(persona?.afp ?? "");
  const [afpTasaTexto, setAfpTasaTexto] = useState(persona ? aTextoTasa(persona.afpTasa) : "");
  const [salud, setSalud] = useState<"Fonasa" | "Isapre">(persona && persona.saludTasa !== 700 ? "Isapre" : "Fonasa");
  const [saludTexto, setSaludTexto] = useState(persona ? aTextoTasa(persona.saludTasa) : "7");

  useEffect(() => {
    if (estado?.ok) {
      toast.success(editando ? "Ficha actualizada" : "Persona agregada");
      onCerrar();
    }
  }, [estado, editando, onCerrar]);

  function elegirAfp(nombreAfp: string) {
    setAfp(nombreAfp);
    const a = AFPS.find((x) => x.nombre === nombreAfp);
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

  const contrato = tipo === "honorarios" ? "HONORARIO" : "SUELDO";
  const porDia = tipo === "diario";
  const bruto = Number(sueldo) || 0;
  const datosJornada = {
    sueldo: bruto,
    valorDia: Number(valorDia) || null,
    porDia,
    jornadaSemanal: Number(jornada.replace(",", ".")) || 0,
    diasSemana,
    valorHoraExtra: Number(valorExtra) || null,
  };
  const ficha = { contrato: contrato as "SUELDO" | "HONORARIO", afpTasa: deTextoTasa(afpTasaTexto), saludTasa: deTextoTasa(saludTexto), cesantia, noImponible: Number(noImp) || 0 };
  const calculo = liquidacionEstimada(ficha, bruto);
  const horasDia = String(Math.round(horasPorDia(datosJornada) * 10) / 10).replace(".", ",");
  const ordinaria = valorHoraOrdinaria(datosJornada);

  const pasoOk = [
    Boolean(nombre.trim() && cargo.trim()),
    porDia ? Number(valorDia) > 0 : bruto > 0,
    true,
    !email.trim() || email.includes("@"),
  ];
  const falta = !nombre.trim() ? "Escribe el nombre" : !cargo.trim() ? "Escribe el cargo" : !pasoOk[1] ? (porDia ? "Indica el valor por día" : "Indica el sueldo") : !pasoOk[3] ? "El correo no es válido" : null;
  const ultimo = paso === PASOS.length - 1;

  const filas =
    contrato === "HONORARIO"
      ? [{ t: `Retención honorarios (${textoTasa(TASA_RETENCION_HONORARIOS)})`, v: calculo.desc.retencion }]
      : [
          { t: `AFP (${textoTasa(ficha.afpTasa)})`, v: calculo.desc.afp },
          { t: `Salud (${textoTasa(ficha.saludTasa)})`, v: calculo.desc.salud },
          ...(cesantia ? [{ t: `Cesantía (${textoTasa(TASA_CESANTIA)})`, v: calculo.desc.cesantia }] : []),
        ];

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex h-[94dvh] max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:h-[min(720px,92vh)] sm:w-[920px] sm:max-w-[min(920px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0"
      >
        <form
          action={enviar}
          className="flex min-h-0 flex-1 flex-col"
          onKeyDown={(e) => {
            // Enter en un campo avanza de paso en vez de guardar a medias.
            if (e.key === "Enter" && !ultimo && e.target instanceof HTMLInputElement) {
              e.preventDefault();
              if (pasoOk[paso]) setPaso(paso + 1);
            }
          }}
        >
          {editando && <input type="hidden" name="id" value={persona.id} />}
          <input type="hidden" name="nombre" value={nombre} />
          <input type="hidden" name="cargo" value={cargo} />
          <input type="hidden" name="rut" value={rut} />
          <input type="hidden" name="telefono" value={telefono} />
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="fechaIngreso" value={ingreso} />
          <input type="hidden" name="notas" value={notas} />
          <input type="hidden" name="contrato" value={contrato} />
          <input type="hidden" name="porDia" value={porDia ? "si" : "no"} />
          <input type="hidden" name="sueldo" value={sueldo} />
          <input type="hidden" name="valorDia" value={valorDia} />
          <input type="hidden" name="jornadaSemanal" value={jornada} />
          <input type="hidden" name="diasSemana" value={diasSemana} />
          <input type="hidden" name="valorHoraExtra" value={valorExtra} />
          <input type="hidden" name="noImponible" value={noImp} />
          <input type="hidden" name="afp" value={afp} />
          <input type="hidden" name="afpTasa" value={afpTasaTexto} />
          <input type="hidden" name="saludTasa" value={saludTexto} />
          <input type="hidden" name="cesantia" value={cesantia ? "si" : "no"} />
          <input type="hidden" name="activo" value={persona && !persona.activo ? "no" : "si"} />

          <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold">{editando ? "Editar ficha" : "Nueva persona"}</DialogTitle>
              <p className={`mt-0.5 text-[13px] ${GRIS}`}>Con estos datos se arma su liquidación cada mes.</p>
            </div>
            <DialogClose aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
              <X className="size-[18px]" />
            </DialogClose>
          </div>

          <ol className="flex gap-1 border-b border-[#F0EEF6] px-4 sm:px-6">
            {PASOS.map((p, i) => (
              <li key={p} className="flex-1 sm:flex-none">
                <button
                  type="button"
                  onClick={() => setPaso(i)}
                  aria-current={paso === i ? "step" : undefined}
                  className={`relative flex h-12 w-full items-center justify-center gap-2 px-2 text-[13px] font-semibold sm:justify-start sm:px-3 ${paso === i ? "text-[#2A07A8]" : GRIS}`}
                >
                  <span className={`flex size-5 items-center justify-center rounded-full text-[11px] ${paso === i ? "bg-[#3A0CE3] text-white" : pasoOk[i] && i < paso ? "bg-[#E6F6EF] text-[#0A7A52]" : "bg-[#F1F0F6] text-[#77748C]"}`}>
                    {pasoOk[i] && i < paso ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{p}</span>
                  {paso === i ? <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#3A0CE3]" /> : null}
                </button>
              </li>
            ))}
          </ol>

          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-h-0 overflow-y-auto px-6 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {paso === 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo label="Nombre completo" className="sm:col-span-2">
                    <Input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder="Ej.: Juan Pérez Lagos" className={inputCls} />
                  </Campo>
                  <Campo label="Cargo">
                    <Input value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={60} placeholder="Ej.: Operador" list="per-cargos" className={inputCls} />
                    <datalist id="per-cargos">
                      {CARGOS_SUGERIDOS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </Campo>
                  <Campo label="RUT">
                    <Input value={rut} onChange={(e) => setRut(e.target.value)} maxLength={20} placeholder="12.345.678-9" className={inputCls} />
                  </Campo>
                  <Campo label="Fecha de ingreso">
                    <Input type="date" value={ingreso} onChange={(e) => setIngreso(e.target.value)} className={inputCls} />
                  </Campo>
                  <Campo label="Teléfono">
                    <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={30} placeholder="+56 9 1234 5678" className={inputCls} />
                  </Campo>
                  <Campo label="Correo" className="sm:col-span-2" ayuda={!pasoOk[3] ? <span className="text-[#A32020]">El correo no es válido</span> : undefined}>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} placeholder="nombre@correo.cl" className={inputCls} />
                  </Campo>
                  <Campo label="Notas" className="sm:col-span-2">
                    <Input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} className={inputCls} />
                  </Campo>
                </div>
              ) : paso === 1 ? (
                <div className="space-y-5">
                  <div>
                    <span className="text-[13px] font-semibold">Tipo de contrato</span>
                    <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                      {TIPOS.map((x) => (
                        <button
                          key={x.id}
                          type="button"
                          onClick={() => setTipo(x.id)}
                          aria-pressed={tipo === x.id}
                          className={`rounded-xl border p-3 text-left ${tipo === x.id ? "border-[#3A0CE3] bg-[#F4F1FF] ring-1 ring-[#3A0CE3]" : "border-[#E4E1F0] hover:bg-[#F8F7FC]"}`}
                        >
                          <span className={`block text-sm font-semibold ${tipo === x.id ? "text-[#2A07A8]" : ""}`}>{x.nombre}</span>
                          <span className={`mt-0.5 block text-xs leading-snug ${GRIS}`}>{x.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {porDia ? (
                      <Campo label="Valor por día trabajado">
                        <Input inputMode="numeric" value={dinero(valorDia)} onChange={(e) => setValorDia(soloDigitos(e.target.value))} placeholder="$0" className={`${inputCls} text-right font-semibold tabular-nums`} />
                      </Campo>
                    ) : (
                      <Campo label={tipo === "honorarios" ? "Monto bruto mensual de la boleta" : "Sueldo bruto mensual"} ayuda={tipo === "mensual" && bruto ? `Día: ${clp((Number(valorDia) || bruto / 30))}` : undefined}>
                        <Input inputMode="numeric" value={dinero(sueldo)} onChange={(e) => setSueldo(soloDigitos(e.target.value))} placeholder="$0" className={`${inputCls} text-right font-semibold tabular-nums`} />
                      </Campo>
                    )}
                    {tipo !== "honorarios" ? (
                      <Campo label="Duración del contrato" ayuda={cesantia ? `Se descuenta seguro de cesantía (${textoTasa(TASA_CESANTIA)})` : "A plazo fijo no se descuenta cesantía"}>
                        <Opciones
                          valor={cesantia ? "indefinido" : "plazo"}
                          opciones={[
                            ["indefinido", "Indefinido"],
                            ["plazo", "Plazo fijo"],
                          ]}
                          onCambio={(v) => setCesantia(v === "indefinido")}
                        />
                      </Campo>
                    ) : null}
                  </div>

                  {tipo !== "honorarios" ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Campo label="Jornada semanal" ayuda={`${JORNADA_SEMANAL_LEGAL} horas desde el 26-04-2026 (Ley 21.561)`}>
                          <div className="relative">
                            <Input inputMode="decimal" value={jornada} onChange={(e) => setJornada(e.target.value.replace(/[^\d,.]/g, "").slice(0, 5))} className={`${inputCls} pr-16`} />
                            <span className={`absolute top-1/2 right-3.5 -translate-y-1/2 text-sm ${GRIS}`}>horas</span>
                          </div>
                        </Campo>
                        <Campo label="Días a la semana" ayuda={`Su día dura ${horasDia} horas`}>
                          <Opciones
                            valor={String(diasSemana)}
                            opciones={[
                              ["5", "5 días"],
                              ["6", "6 días"],
                              ["4", "4 días"],
                            ]}
                            onCambio={(v) => setDiasSemana(Number(v))}
                          />
                        </Campo>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {!porDia ? (
                          <Campo label="Valor del día (opcional)">
                            <Input inputMode="numeric" value={dinero(valorDia)} onChange={(e) => setValorDia(soloDigitos(e.target.value))} placeholder={bruto ? `${clp(bruto / 30)} (sueldo ÷ 30)` : "$0"} className={`${inputCls} text-right tabular-nums`} />
                          </Campo>
                        ) : null}
                        <Campo label="Hora extra (opcional)">
                          <Input inputMode="numeric" value={dinero(valorExtra)} onChange={(e) => setValorExtra(soloDigitos(e.target.value))} placeholder={`${clp(valorDeHoraExtra({ ...datosJornada, valorHoraExtra: null }))} (legal)`} className={`${inputCls} text-right tabular-nums`} />
                        </Campo>
                      </div>
                    </>
                  ) : null}

                  <Campo label="Colación y movilización al mes">
                    <Input inputMode="numeric" value={dinero(noImp)} onChange={(e) => setNoImp(soloDigitos(e.target.value, 8))} placeholder="$0" className={`${inputCls} text-right tabular-nums`} />
                  </Campo>

                  {tipo === "mensual" && ordinaria > 0 ? (
                    <p className={`rounded-xl bg-[#F8F7FC] px-3.5 py-2.5 text-xs ${GRIS}`}>
                      Hora ordinaria <b className="font-semibold text-[#15132B]">{clp(ordinaria)}</b> · hora extra <b className="font-semibold text-[#15132B]">{clp(valorDeHoraExtra(datosJornada))}</b>
                    </p>
                  ) : null}
                  {tipo === "honorarios" ? <p className={`rounded-xl bg-[#F8F7FC] px-3.5 py-3 text-sm ${GRIS}`}>Se retiene el {textoTasa(TASA_RETENCION_HONORARIOS)} de la boleta. Sin AFP ni salud.</p> : null}
                </div>
              ) : paso === 2 ? (
                contrato === "HONORARIO" ? (
                  <p className={`rounded-xl bg-[#F8F7FC] px-4 py-6 text-center text-sm ${GRIS}`}>A honorarios no hay descuentos previsionales. Sigue al paso de acceso.</p>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Campo label="AFP">
                        <Select
                          items={[...AFPS.map((a) => ({ value: a.nombre, label: `${a.nombre} · ${textoTasa(tasaAfp(a.comision))}` })), ...(afp && !AFPS.some((a) => a.nombre === afp) ? [{ value: afp, label: afp }] : [])]}
                          value={afp || null}
                          onValueChange={(v) => elegirAfp(v ?? "")}
                        >
                          <SelectTrigger className="h-11 w-full rounded-xl border-[#E4E1F0] px-3">
                            <SelectValue placeholder="Elige la AFP…" />
                          </SelectTrigger>
                          <SelectContent>
                            {AFPS.map((a) => (
                              <SelectItem key={a.nombre} value={a.nombre}>
                                {a.nombre} · {textoTasa(tasaAfp(a.comision))}
                              </SelectItem>
                            ))}
                            {afp && !AFPS.some((a) => a.nombre === afp) ? <SelectItem value={afp}>{afp}</SelectItem> : null}
                          </SelectContent>
                        </Select>
                      </Campo>
                      <Campo label="Descuento AFP" ayuda="10 % más la comisión. Confírmala en su liquidación.">
                        <div className="relative">
                          <Input inputMode="decimal" value={afpTasaTexto} onChange={(e) => setAfpTasaTexto(e.target.value.replace(/[^\d,.]/g, "").slice(0, 6))} placeholder="10,58" className={`${inputCls} pr-9 text-right tabular-nums`} />
                          <span className={`absolute top-1/2 right-3.5 -translate-y-1/2 text-sm ${GRIS}`}>%</span>
                        </div>
                      </Campo>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Campo label="Salud">
                        <Opciones
                          valor={salud}
                          opciones={[
                            ["Fonasa", "Fonasa"],
                            ["Isapre", "Isapre"],
                          ]}
                          onCambio={(v) => {
                            setSalud(v);
                            if (v === "Fonasa") setSaludTexto("7");
                          }}
                        />
                      </Campo>
                      <Campo label="Descuento de salud" ayuda={salud === "Fonasa" ? "Fonasa descuenta 7 %" : "Isapre: 7 % o el valor de su plan, si es mayor"}>
                        <div className="relative">
                          <Input inputMode="decimal" disabled={salud === "Fonasa"} value={saludTexto} onChange={(e) => setSaludTexto(e.target.value.replace(/[^\d,.]/g, "").slice(0, 6))} placeholder="7" className={`${inputCls} pr-9 text-right tabular-nums`} />
                          <span className={`absolute top-1/2 right-3.5 -translate-y-1/2 text-sm ${GRIS}`}>%</span>
                        </div>
                      </Campo>
                    </div>
                    <p className={`flex items-start gap-2 rounded-xl bg-[#F8F7FC] px-3.5 py-2.5 text-xs ${GRIS}`}>
                      <ShieldCheck className="mt-px size-4 shrink-0 text-[#0A7A52]" aria-hidden />
                      Seguro de cesantía: {cesantia ? `se descuenta ${textoTasa(TASA_CESANTIA)} (contrato indefinido).` : "no se descuenta (contrato a plazo fijo)."}
                    </p>
                  </div>
                )
              ) : (
                <AccesoAlPanel acceso={acceso} correo={email} puedeTesorero={puedeTesorero} onCorreo={() => setPaso(0)} />
              )}
            </div>

            <aside className="hidden border-l border-[#F0EEF6] bg-[#FAFAFD] p-5 md:flex md:flex-col">
              <div className="flex items-center gap-3">
                <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-[#ECE8FD] text-sm font-bold text-[#2A07A8]">
                  {nombre.trim() ? iniciales(nombre) : <Users className="size-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{nombre.trim() || "Nueva persona"}</span>
                  <span className={`block truncate text-xs ${GRIS}`}>
                    {cargo.trim() || "Sin cargo"} · {TIPOS.find((x) => x.id === tipo)!.nombre}
                  </span>
                </span>
              </div>
              <p className={`mt-5 text-xs font-semibold tracking-wide uppercase ${GRIS}`}>Liquidación estimada</p>
              <div className="mt-2 rounded-xl bg-white p-3.5 ring-1 ring-[#EFEDF6]">
                {porDia ? (
                  <p className={`py-3 text-center text-sm ${GRIS}`}>{Number(valorDia) ? `${clp(Number(valorDia))} por día · según los días trabajados` : "Indica el valor por día"}</p>
                ) : bruto ? (
                  <dl className="text-sm">
                    <div className="flex justify-between py-1.5">
                      <dt className={GRIS}>Sueldo bruto</dt>
                      <dd className="font-semibold tabular-nums">{clp(calculo.bruto)}</dd>
                    </div>
                    {filas.map((f) => (
                      <div key={f.t} className="flex justify-between gap-2 py-1.5">
                        <dt className={GRIS}>− {f.t}</dt>
                        <dd className="text-[#A32020] tabular-nums">{clp(f.v)}</dd>
                      </div>
                    ))}
                    {calculo.colacion > 0 ? (
                      <div className="flex justify-between gap-2 py-1.5">
                        <dt className={GRIS}>+ Colación</dt>
                        <dd className="text-[#075A3C] tabular-nums">{clp(calculo.colacion)}</dd>
                      </div>
                    ) : null}
                    <div className="mt-1.5 flex items-baseline justify-between border-t border-[#E9E6F3] pt-2.5">
                      <dt className="font-semibold">Líquido</dt>
                      <dd className="text-xl font-semibold tabular-nums">{clp(calculo.liquido)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className={`py-4 text-center text-sm ${GRIS}`}>Ingresa el sueldo para calcular</p>
                )}
              </div>
              {!porDia && bruto ? (
                <div className="mt-3 flex items-baseline justify-between rounded-xl bg-[#F1EEFD] px-3.5 py-2.5 text-sm">
                  <span className="text-[#2A07A8]">Costo mensual</span>
                  <b className="font-semibold text-[#2A07A8] tabular-nums">{clp(bruto + calculo.colacion)}</b>
                </div>
              ) : null}
              <p className={`mt-3 text-[11px] leading-relaxed ${GRIS}`}>Referencial: sin tope imponible ni impuesto único.</p>
            </aside>
          </div>

          <div className="flex items-center gap-2 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
            <div className="min-w-0 flex-1">
              {editando ? (
                <Button type="button" variant="ghost" className="h-11 px-3 text-[0.9rem] text-destructive hover:text-destructive" onClick={borrar} disabled={borrando || pendiente}>
                  {borrando && <Loader2 className="animate-spin" />}
                  Borrar
                </Button>
              ) : null}
              {estado && !estado.ok ? (
                <p className="truncate text-xs text-[#A32020]" role="alert">
                  {estado.error}
                </p>
              ) : ultimo && falta ? (
                <p className="truncate text-xs text-[#A32020]">{falta}</p>
              ) : !editando && !porDia && bruto ? (
                <p className="truncate text-xs md:hidden">
                  <span className={GRIS}>Líquido estimado</span> <b className="font-semibold tabular-nums">{clp(calculo.liquido)}</b>
                </p>
              ) : null}
            </div>
            {paso > 0 ? (
              <Button type="button" variant="outline" onClick={() => setPaso(paso - 1)} className="h-11 rounded-xl border-[#E4E1F0] bg-white font-semibold">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Atrás</span>
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onCerrar} className="h-11 rounded-xl border-[#E4E1F0] bg-white font-semibold">
                Cancelar
              </Button>
            )}
            {!ultimo ? (
              <Button type="button" disabled={!pasoOk[paso]} onClick={() => setPaso(paso + 1)} className="h-11 rounded-xl px-5 font-semibold">
                Siguiente
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={pendiente || borrando || Boolean(falta)} className="h-11 rounded-xl px-5 font-semibold">
                {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {editando ? "Guardar cambios" : "Agregar persona"}
              </Button>
            )}
          </div>
        </form>
        {dialogo}
      </DialogContent>
    </Dialog>
  );
}

const OPCIONES_ACCESO: { rol: "OPERADOR" | "TESORERO"; nombre: string; desc: string; icono: LucideIcon }[] = [
  { rol: "OPERADOR", nombre: "Operador de terreno", desc: "Usa Modo terreno: lecturas, cortes y labores", icono: Smartphone },
  { rol: "TESORERO", nombre: "Tesorero", desc: "Entra al panel: pagos, socios y caja", icono: KeyRound },
];

/**
 * El acceso de una persona a Facilapr: si ya tiene cuenta lo dice; si no, genera la invitación (un enlace de un
 * solo uso) para que cree la suya como operador o como tesorero. Son botones sueltos: no envían la ficha.
 */
function AccesoAlPanel({ acceso, correo, puedeTesorero, onCorreo }: { acceso: AccesoPanel | null; correo: string; puedeTesorero: boolean; onCorreo: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [generando, iniciar] = useTransition();
  const tieneCorreo = correo.includes("@");

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
    <div className="space-y-3">
      <p className="text-[13px] font-semibold">¿Usará Facilapr?</p>
      {acceso ? (
        <p className="flex items-center gap-3 rounded-xl border border-[#3A0CE3] bg-[#F4F1FF] p-3.5 text-sm font-semibold ring-1 ring-[#3A0CE3]">
          <Check className="size-4 text-[#3A0CE3]" aria-hidden />
          {acceso === "DESACTIVADO" ? "Tiene cuenta, pero se le quitó el acceso" : `Tiene cuenta como ${TEXTO_ACCESO[acceso].toLowerCase()}`}
        </p>
      ) : (
        <>
          <p className={`rounded-xl border border-[#E4E1F0] p-3.5 text-sm ${GRIS}`}>Sin acceso. Solo figura para sueldo y asistencia.</p>
          {OPCIONES_ACCESO.filter((o) => o.rol === "OPERADOR" || puedeTesorero).map((o) => {
            const I = o.icono;
            return (
              <button key={o.rol} type="button" disabled={generando} onClick={() => invitar(o.rol)} className="flex w-full items-center gap-3 rounded-xl border border-[#E4E1F0] p-3.5 text-left hover:bg-[#F8F7FC] disabled:opacity-70">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F3F9] text-[#5B5970]">
                  {generando ? <Loader2 className="size-5 animate-spin" /> : <I className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Invitar como {o.nombre.toLowerCase()}</span>
                  <span className={`block text-xs ${GRIS}`}>{o.desc}</span>
                </span>
              </button>
            );
          })}
          {url ? (
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[#E4E1F0] bg-[#F8F7FC] px-3 py-2">
              <span title={url} className="min-w-0 flex-1 truncate text-[0.85rem]">
                {url}
              </span>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={copiar}>
                {copiado ? <Check className="text-forest" /> : <Copy />}
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            </div>
          ) : null}
          <p className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs ${tieneCorreo ? `bg-[#F8F7FC] ${GRIS}` : "bg-[#FFF6E8] text-[#7A4A00]"}`}>
            <Mail className="mt-px size-4 shrink-0" aria-hidden />
            {tieneCorreo ? (
              <>
                Que cree su cuenta con <b className="font-semibold">{correo}</b> para quedar ligada a esta ficha.
              </>
            ) : (
              <>
                Falta su correo para ligar la cuenta.{" "}
                <button type="button" onClick={onCorreo} className="font-semibold underline">
                  Agrégalo en Datos
                </button>
                .
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
