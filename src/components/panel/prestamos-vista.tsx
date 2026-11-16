"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Ban, CalendarClock, Check, CheckCircle2, ChevronRight, HandCoins, Loader2, Plus, Search, Trash2, UserPlus, Users, Wallet, X } from "lucide-react";
import { cerrarPrestamo, crearPrestamo, eliminarPrestamo, type ResultadoPrestamos } from "@/app/panel/prestamos/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirmar } from "@/components/ui/confirmar";
import { avisarCambio } from "@/lib/avisos-datos";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mesVecino } from "@/lib/finanzas-comun";
import { iniciales } from "@/lib/formato";
import { TEXTO_TIPO_PRESTAMO, cuotaDelMes, planDeDescuentos, type PrestamoFila, type TipoPrestamo } from "@/lib/prestamos-comun";
import { cn } from "@/lib/utils";

type Persona = { id: string; nombre: string; cargo: string; sueldo: number; activo: boolean };

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const fecha = (iso: string) => iso.split("-").reverse().join("-");
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesTxt = (periodo: string) => `${MES_CORTO[Number(periodo.slice(5, 7)) - 1]} ${periodo.slice(0, 4)}`;
const siguiente = (mes: string) => mesVecino(mes, 1);
const pctDelSueldo = (cuota: number, sueldo: number) => (sueldo > 0 ? (cuota / sueldo) * 100 : 0);
const formatoPct = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 1 });

const vigente = (p: PrestamoFila) => p.estado === "ACTIVO" && p.saldo > 0;
const saldado = (p: PrestamoFila) => p.saldo <= 0;

/** Cuándo se descuenta la próxima cuota (AAAA-MM), si el préstamo sigue vigente. */
const proxima = (p: PrestamoFila) => planDeDescuentos(p, siguiente).find((i) => i.estado === "PROXIMA")?.periodo ?? null;

const CHIP_TIPO: Record<TipoPrestamo, string> = { ANTICIPO: "bg-[#E3F3FD] text-[#0B5E94]", PRESTAMO: "bg-[#ECE8FD] text-[#2A07A8]" };

function Detalle({
  p,
  persona,
  hoy,
  trabajando,
  onCerrarPrestamo,
  onBorrar,
  onSalir,
}: {
  p: PrestamoFila;
  persona: Persona | null;
  hoy: string;
  trabajando: boolean;
  onCerrarPrestamo: () => void;
  onBorrar: () => void;
  onSalir?: () => void;
}) {
  const periodoActual = hoy.slice(0, 7);
  const plan = planDeDescuentos(p, siguiente);
  const pct = persona ? pctDelSueldo(p.cuotaMonto, persona.sueldo) : 0;
  const v = vigente(p);
  const puedeBorrar = p.cuotasDescontadas === 0;
  const puedeCerrar = p.estado === "ACTIVO" && !saldado(p);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-5 py-4">
        <span aria-hidden className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", p.tipo === "ANTICIPO" ? "bg-[#E3F3FD] text-[#0B6FB0]" : "bg-[#ECE8FD] text-[#3A0CE3]")}>
          {p.tipo === "ANTICIPO" ? <Wallet className="size-5" /> : <HandCoins className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium ${GRIS}`}>
            {TEXTO_TIPO_PRESTAMO[p.tipo]} · entregado el {fecha(p.fecha)}
          </p>
          <h2 className="truncate text-lg leading-tight font-semibold">{p.trabajador}</h2>
        </div>
        {onSalir ? (
          <Button type="button" variant="ghost" size="icon" aria-label="Cerrar" onClick={onSalir} className="size-9 rounded-lg lg:hidden">
            <X />
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 divide-y divide-[#F0EEF6] overflow-y-auto">
        <section className="px-5 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className={`text-xs ${GRIS}`}>{v ? "Saldo por descontar" : saldado(p) ? "Saldado" : "Cerrado"}</p>
              <p className="mt-0.5 text-[28px] leading-none font-semibold tabular-nums">{clp(p.saldo)}</p>
            </div>
            <div className="text-right">
              <p className={`text-xs ${GRIS}`}>Monto entregado</p>
              <p className="font-semibold tabular-nums">{clp(p.monto)}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1" aria-label={`${p.cuotasDescontadas} de ${p.cuotas} cuotas descontadas`}>
            {Array.from({ length: p.cuotas }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < p.cuotasDescontadas ? "bg-[#2FB386]" : i === p.cuotasDescontadas && v ? "bg-[#F0A23C]" : "bg-[#ECEAF4]"}`} />
            ))}
          </div>
          <p className={`mt-1.5 text-xs ${GRIS}`}>
            {p.cuotasDescontadas} de {p.cuotas} cuota{p.cuotas === 1 ? "" : "s"} descontada{p.cuotas === 1 ? "" : "s"} · {clp(p.cuotaMonto)} c/u
            {pct > 0 ? ` · ${formatoPct(pct)}% del sueldo` : ""}
          </p>
          {p.estado === "CERRADO" && p.saldo > 0 ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-[#FFF6E8] px-3 py-2 text-xs text-[#7A4A00]">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              Se dejó de descontar. Quedaron {clp(p.saldo)} sin descontar.
            </p>
          ) : null}
        </section>

        <section className="px-5 py-4">
          <p className="text-[13px] font-semibold">Plan de descuentos</p>
          {plan.length === 0 ? (
            <p className={`mt-2 text-sm ${GRIS}`}>No se descontó nada.</p>
          ) : (
            <ol className="mt-2 flex flex-col">
              {plan.map((i, k) => {
                const hecho = i.estado === "HECHO";
                const prox = i.estado === "PROXIMA";
                const esteMes = prox && i.periodo <= periodoActual;
                return (
                  <li key={`${i.periodo}-${k}`} className="flex items-center gap-3 py-2 text-sm">
                    <span
                      aria-hidden
                      className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", hecho ? "bg-[#E6F6EF] text-[#0A7A52]" : prox ? "bg-[#FFF3E0] text-[#8A4B00]" : "bg-[#F4F3F9] text-[#8A8799]")}
                    >
                      {hecho ? <Check className="size-3.5" strokeWidth={3} /> : k + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Liquidación de {mesTxt(i.periodo)}</span>
                      <span className={cn("block text-xs", hecho ? "text-[#075A3C]" : prox ? "text-[#8A4B00]" : GRIS)}>{hecho ? "Descontada" : prox ? (esteMes ? "Se descuenta este mes" : "Próxima") : "Pendiente"}</span>
                    </span>
                    <span className={cn("tabular-nums", hecho ? GRIS : "font-semibold")}>{clp(i.monto)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
            <div>
              <dt className={GRIS}>Motivo</dt>
              <dd className="font-medium">{p.nota || (p.tipo === "ANTICIPO" ? "Anticipo de sueldo" : "Préstamo")}</dd>
            </div>
            <div>
              <dt className={GRIS}>En la Caja</dt>
              <dd className="font-medium">{p.costoEnCaja ? "Entrega anotada" : "Sin egreso"}</dd>
            </div>
            {persona ? (
              <>
                <div>
                  <dt className={GRIS}>Cargo</dt>
                  <dd className="font-medium">{persona.cargo}</dd>
                </div>
                {persona.sueldo > 0 ? (
                  <div>
                    <dt className={GRIS}>Sueldo bruto</dt>
                    <dd className="font-medium tabular-nums">{clp(persona.sueldo)}</dd>
                  </div>
                ) : null}
              </>
            ) : null}
          </dl>
        </section>
      </div>

      {puedeCerrar || puedeBorrar ? (
        <div className={`grid gap-2 border-t border-[#F0EEF6] p-4 ${puedeCerrar && puedeBorrar ? "grid-cols-2" : "grid-cols-1"}`}>
          {puedeCerrar ? (
            <Button type="button" variant="outline" disabled={trabajando} onClick={onCerrarPrestamo} className="h-11 rounded-xl border-[#E4E1F0] font-semibold">
              <Ban className="size-4" />
              Dejar de descontar
            </Button>
          ) : null}
          {puedeBorrar ? (
            <Button type="button" variant="outline" disabled={trabajando} onClick={onBorrar} className="h-11 rounded-xl border-[#E4E1F0] font-semibold text-[#A32020] hover:text-[#A32020]">
              <Trash2 className="size-4" />
              Borrar
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Los anticipos y préstamos al personal: lo que falta por descontar, lo que se descuenta este mes y el detalle de cada uno. */
export function PrestamosVista({ prestamos, personas, hoy }: { prestamos: PrestamoFila[]; personas: Persona[]; hoy: string }) {
  const { confirmar, dialogo } = useConfirmar();
  const [creando, setCreando] = useState(false);
  const [trabajando, iniciar] = useTransition();
  const [filtro, setFiltro] = useState<"vigentes" | "saldados" | "todos">("vigentes");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [movil, setMovil] = useState(false);
  const cerrar = useCallback(() => setCreando(false), []);

  const periodoActual = hoy.slice(0, 7);
  const activas = personas.filter((p) => p.activo);
  const vigentes = prestamos.filter(vigente);
  const noVigentes = prestamos.filter((p) => !vigente(p));
  const porDescontar = vigentes.reduce((s, p) => s + p.saldo, 0);
  const esteMes = vigentes.filter((p) => cuotaDelMes(p, periodoActual) > 0);
  const montoEsteMes = esteMes.reduce((s, p) => s + cuotaDelMes(p, periodoActual), 0);
  const nombresEsteMes = [...new Set(esteMes.map((p) => p.trabajador.split(" ")[0]))];
  const personasVigentes = new Set(vigentes.map((p) => p.trabajadorId)).size;

  const termino = q.trim().toLowerCase();
  const lista = prestamos.filter((p) => (filtro === "todos" || (filtro === "vigentes" ? vigente(p) : !vigente(p))) && (!termino || p.trabajador.toLowerCase().includes(termino)));
  const actual = prestamos.find((p) => p.id === sel) ?? lista[0] ?? null;
  const personaDe = (id: string) => personas.find((x) => x.id === id) ?? null;

  async function cerrarUno(p: PrestamoFila) {
    if (!(await confirmar({ titulo: `¿Dejar de descontar el ${TEXTO_TIPO_PRESTAMO[p.tipo].toLowerCase()} de ${p.trabajador}?`, descripcion: `Quedan ${clp(p.saldo)} sin descontar. Lo ya descontado se mantiene.`, boton: "Dejar de descontar", destructivo: false }))) return;
    iniciar(async () => {
      const r = await cerrarPrestamo(p.id);
      if (r.ok) toast.success("Cerrado");
      else toast.error(r.error);
    });
  }

  async function borrar(p: PrestamoFila) {
    if (!(await confirmar({ titulo: `¿Borrar el ${TEXTO_TIPO_PRESTAMO[p.tipo].toLowerCase()} de ${p.trabajador}?`, descripcion: p.costoEnCaja ? "También se quita la entrega de la Caja." : "No se puede deshacer.", boton: "Borrar" }))) return;
    iniciar(async () => {
      const r = await eliminarPrestamo(p.id);
      if (r.ok) {
        toast.success("Borrado");
        avisarCambio("caja");
        setMovil(false);
      } else toast.error(r.error);
    });
  }

  const detalle = (alSalir?: () => void) =>
    actual ? <Detalle p={actual} persona={personaDe(actual.trabajadorId)} hoy={hoy} trabajando={trabajando} onCerrarPrestamo={() => void cerrarUno(actual)} onBorrar={() => void borrar(actual)} onSalir={alSalir} /> : null;

  return (
    <div className="mx-auto w-full max-w-[1376px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[28px]">Anticipos y préstamos</h1>
          <p className={`mt-0.5 max-w-[640px] text-[15px] ${GRIS}`}>Lo que el comité adelanta o presta al personal. Las cuotas se descuentan solas en Remuneraciones.</p>
        </div>
        {activas.length > 0 ? (
          <Button data-tour="pre-nuevo" onClick={() => setCreando(true)} className="h-10 shrink-0 rounded-lg px-4 font-semibold">
            <Plus />
            Nuevo anticipo o préstamo
          </Button>
        ) : null}
      </div>

      {activas.length === 0 ? (
        <Card className={`mt-6 flex flex-col items-center rounded-2xl border-0 px-6 py-14 text-center ${SOMBRA}`}>
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECE8FD] text-[#3A0CE3]">
            <UserPlus className="size-7" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-semibold">Primero agrega a tu personal</p>
          <p className={`mt-1 max-w-[420px] text-sm ${GRIS}`}>Los anticipos y préstamos se asignan a una persona y se descuentan de su liquidación. Agrega al menos a una persona con su sueldo.</p>
          <Button render={<Link href="/panel/personal" />} nativeButton={false} className="mt-5 h-11 rounded-xl px-5 font-semibold">
            <Users className="size-4" />
            Ir a Personal
          </Button>
        </Card>
      ) : (
        <>
          <Card data-tour="pre-kpis" className={`mt-5 grid grid-cols-2 gap-y-4 rounded-2xl border-0 p-5 sm:p-6 lg:grid-cols-[1.3fr_1.2fr_1fr] lg:divide-x lg:divide-[#F0EEF6] ${SOMBRA}`}>
            <div className="col-span-2 lg:col-span-1 lg:pr-6">
              <p className={`text-[13px] ${GRIS}`}>Por descontar</p>
              <p className="mt-1 text-[32px] leading-none font-semibold tabular-nums">{clp(porDescontar)}</p>
              <p className={`mt-2 text-xs ${GRIS}`}>
                {vigentes.length} vigente{vigentes.length === 1 ? "" : "s"} · {personasVigentes} persona{personasVigentes === 1 ? "" : "s"}
              </p>
            </div>
            <div className="min-w-0 lg:px-6">
              <p className={`flex items-center gap-1.5 text-[13px] ${GRIS}`}>
                <CalendarClock className="size-3.5" aria-hidden />
                Se descuenta en {MES_LARGO[Number(periodoActual.slice(5, 7)) - 1]}
              </p>
              <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">{clp(montoEsteMes)}</p>
              <p className={`mt-1 truncate text-xs ${GRIS}`}>{nombresEsteMes.length ? nombresEsteMes.join(", ") : "Nada este mes"}</p>
            </div>
            <div className="min-w-0 lg:px-6">
              <p className={`text-[13px] ${GRIS}`}>Saldados</p>
              <p className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">{noVigentes.length}</p>
              <p className={`mt-1 text-xs ${GRIS}`}>{clp(noVigentes.reduce((s, p) => s + p.descontado, 0))} devueltos</p>
            </div>
          </Card>

          {prestamos.length === 0 ? (
            <Card className={`mt-4 flex flex-col items-center rounded-2xl border-0 px-6 py-14 text-center ${SOMBRA}`}>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECE8FD] text-[#3A0CE3]">
                <HandCoins className="size-7" aria-hidden />
              </span>
              <p className="mt-4 text-lg font-semibold">Sin anticipos ni préstamos</p>
              <p className={`mt-1 max-w-[440px] text-sm ${GRIS}`}>Cuando el comité adelante sueldo o preste dinero a alguien del personal, regístralo aquí y se descontará solo en sus liquidaciones.</p>
              <Button onClick={() => setCreando(true)} className="mt-5 h-11 rounded-xl px-5 font-semibold">
                <Plus />
                Registrar el primero
              </Button>
            </Card>
          ) : (
            <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
              <Card className={`min-w-0 overflow-hidden rounded-2xl border-0 ${SOMBRA}`}>
                <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4 sm:flex-row sm:items-center sm:px-5">
                  <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-[#F4F3F9] p-1 sm:w-[330px]">
                    {(
                      [
                        ["vigentes", "Vigentes", vigentes.length],
                        ["saldados", "Saldados", noVigentes.length],
                        ["todos", "Todos", prestamos.length],
                      ] as const
                    ).map(([k, t, n]) => (
                      <button key={k} type="button" role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)} className={`h-8 rounded-md text-[13px] font-semibold ${filtro === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS}`}>
                        {t} <span className={`text-xs font-medium ${filtro === k ? "text-[#6B46F5]" : "text-[#A19FB2]"}`}>{n}</span>
                      </button>
                    ))}
                  </div>
                  <div className="relative min-w-0 flex-1 sm:ml-auto sm:max-w-[260px]">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input aria-label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Persona" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
                  </div>
                </div>
                <div className={`hidden grid-cols-[minmax(0,1fr)_170px_120px_20px] gap-4 border-b border-[#F3F1F8] bg-[#FAFAFD] px-5 py-2.5 text-xs font-medium md:grid ${GRIS}`}>
                  <span>Persona</span>
                  <span>Avance</span>
                  <span className="text-right">Saldo</span>
                  <span />
                </div>
                <ul className="divide-y divide-[#F3F1F8]">
                  {lista.map((p) => {
                    const activo = actual?.id === p.id;
                    const v = vigente(p);
                    const prox = proxima(p);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSel(p.id);
                            setMovil(true);
                          }}
                          className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left md:grid-cols-[minmax(0,1fr)_170px_120px_20px] md:px-5 ${activo ? "bg-[#F5F3FE] shadow-[inset_3px_0_0_#3A0CE3]" : "hover:bg-[#FBFAFF]"}`}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F1EEFD] text-xs font-bold text-[#2A07A8]">
                              {iniciales(p.trabajador)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[15px] font-semibold">{p.trabajador}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-[13px]">
                                <span className={`rounded-md px-1.5 py-px text-[11px] font-semibold ${CHIP_TIPO[p.tipo]}`}>{TEXTO_TIPO_PRESTAMO[p.tipo]}</span>
                                <span className={`truncate ${GRIS}`}>
                                  {clp(p.monto)} · {fecha(p.fecha)}
                                </span>
                              </span>
                            </span>
                          </span>
                          <span className="text-right md:order-3">
                            <span className="block text-[15px] font-semibold tabular-nums">
                              {v ? (
                                clp(p.saldo)
                              ) : saldado(p) ? (
                                <span className="inline-flex items-center gap-1 text-[13px] text-[#075A3C]">
                                  <CheckCircle2 className="size-3.5" aria-hidden />
                                  Saldado
                                </span>
                              ) : (
                                <span className={`text-[13px] ${GRIS}`}>Cerrado</span>
                              )}
                            </span>
                            {v ? <span className={`block text-xs ${GRIS}`}>por descontar</span> : null}
                          </span>
                          <span className="col-span-2 pl-[52px] md:order-2 md:col-span-1 md:pl-0">
                            <span className="flex gap-0.5">
                              {Array.from({ length: p.cuotas }, (_, i) => (
                                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < p.cuotasDescontadas ? "bg-[#2FB386]" : "bg-[#ECEAF4]"}`} />
                              ))}
                            </span>
                            <span className={`mt-1 block text-xs ${GRIS}`}>{v ? `${p.cuotasDescontadas}/${p.cuotas}${prox ? ` · próxima ${mesTxt(prox)}` : ""}` : saldado(p) ? `${p.cuotas}/${p.cuotas} cuotas` : `${p.cuotasDescontadas}/${p.cuotas} · cerrado`}</span>
                          </span>
                          <ChevronRight className="hidden size-4 text-[#B4B2C4] md:order-4 md:block" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                  {lista.length === 0 ? <li className={`px-6 py-12 text-center text-sm ${GRIS}`}>Nada que mostrar con ese filtro.</li> : null}
                </ul>
              </Card>
              {actual ? <Card className={`hidden h-[min(700px,calc(100vh-2rem))] overflow-hidden rounded-2xl border-0 lg:sticky lg:top-4 lg:block ${SOMBRA}`}>{detalle()}</Card> : null}
            </div>
          )}
        </>
      )}

      {actual && movil ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Cerrar" onClick={() => setMovil(false)} className="absolute inset-0 bg-[#15132B]/40" />
          <div className="absolute inset-x-0 bottom-0 h-[88vh] overflow-hidden rounded-t-2xl bg-white">{detalle(() => setMovil(false))}</div>
        </div>
      ) : null}

      {dialogo}
      {creando && <PrestamoDialog personas={activas} hoy={hoy} onCerrar={cerrar} />}
    </div>
  );
}

const CUOTAS = [2, 3, 4, 6, 8, 10, 12];

function PrestamoDialog({ personas, hoy, onCerrar }: { personas: Persona[]; hoy: string; onCerrar: () => void }) {
  const [estado, enviar, pendiente] = useActionState<ResultadoPrestamos | null, FormData>(crearPrestamo, null);
  const [tipo, setTipo] = useState<TipoPrestamo>("PRESTAMO");
  const [personaId, setPersonaId] = useState(personas[0]?.id ?? "");
  const [monto, setMonto] = useState("");
  const [cuotas, setCuotas] = useState("6");
  const periodoActual = hoy.slice(0, 7);
  const [inicio, setInicio] = useState(periodoActual);

  useEffect(() => {
    if (estado?.ok) {
      toast.success("Registrado");
      avisarCambio("caja");
      onCerrar();
    }
  }, [estado, onCerrar]);

  const persona = personas.find((p) => p.id === personaId) ?? null;
  const n = tipo === "ANTICIPO" ? 1 : Math.max(1, Number(cuotas) || 1);
  const m = Number(monto) || 0;
  const cuota = n > 0 ? Math.ceil(m / n) : 0;
  const pct = persona ? pctDelSueldo(cuota, persona.sueldo) : 0;
  const pasaDelTope = pct > 15 && tipo === "PRESTAMO";
  const meses = [periodoActual, mesVecino(periodoActual, 1), mesVecino(periodoActual, 2)];
  const ultimo = (() => {
    let mes = inicio;
    for (let i = 1; i < n; i++) mes = mesVecino(mes, 1);
    return mes;
  })();

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[94dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none bg-white p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[92vh] sm:w-[560px] sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-0"
      >
        <form action={enviar} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="trabajadorId" value={personaId} />
          <input type="hidden" name="monto" value={monto} />
          <input type="hidden" name="cuotas" value={String(n)} />
          <input type="hidden" name="primerPeriodo" value={inicio} />

          <div className="flex items-start gap-3 border-b border-[#F0EEF6] px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold">Nuevo anticipo o préstamo</DialogTitle>
              <p className={`mt-0.5 text-[13px] ${GRIS}`}>Se descontará solo en las liquidaciones de Remuneraciones.</p>
            </div>
            <DialogClose aria-label="Cerrar" className="flex size-9 items-center justify-center rounded-lg text-[#5B5970] hover:bg-[#F4F3F9]">
              <X className="size-[18px]" />
            </DialogClose>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["ANTICIPO", Wallet, "Se descuenta completo en una liquidación"],
                  ["PRESTAMO", HandCoins, "Se descuenta en cuotas mensuales"],
                ] as const
              ).map(([t, I, d]) => (
                <button key={t} type="button" onClick={() => setTipo(t)} aria-pressed={tipo === t} className={`rounded-xl border p-3 text-left transition-colors ${tipo === t ? "border-[#3A0CE3] bg-[#F4F1FF] ring-1 ring-[#3A0CE3]" : "border-[#E4E1F0] hover:bg-[#F8F7FC]"}`}>
                  <span className={`flex items-center gap-2 text-sm font-semibold ${tipo === t ? "text-[#2A07A8]" : ""}`}>
                    <I className="size-4" aria-hidden />
                    {TEXTO_TIPO_PRESTAMO[t]}
                  </span>
                  <span className={`mt-1 block text-xs leading-snug ${GRIS}`}>{d}</span>
                </button>
              ))}
            </div>

            <div className="block">
              <span className="text-[13px] font-semibold">Persona</span>
              <Select items={personas.map((p) => ({ value: p.id, label: `${p.nombre} · ${p.cargo}` }))} value={personaId} onValueChange={(v) => setPersonaId(v ?? "")}>
                <SelectTrigger className="mt-1.5 h-11 w-full rounded-xl border-[#E4E1F0] px-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {personas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} · {p.cargo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {persona && persona.sueldo > 0 ? <span className={`mt-1 block text-xs ${GRIS}`}>Sueldo bruto {clp(persona.sueldo)}</span> : null}
            </div>

            <div className={`grid gap-3 ${tipo === "PRESTAMO" ? "grid-cols-2" : "grid-cols-1"}`}>
              <label className="block">
                <span className="text-[13px] font-semibold">Monto</span>
                <Input inputMode="numeric" autoComplete="off" value={m ? clp(m) : ""} onChange={(e) => setMonto(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="$0" className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] text-right font-semibold tabular-nums shadow-none" />
              </label>
              {tipo === "PRESTAMO" ? (
                <div className="block">
                  <span className="text-[13px] font-semibold">Cuotas</span>
                  <Select items={CUOTAS.map((x) => ({ value: String(x), label: `${x} cuotas` }))} value={cuotas} onValueChange={(v) => setCuotas(v ?? "6")}>
                    <SelectTrigger className="mt-1.5 h-11 w-full rounded-xl border-[#E4E1F0] px-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUOTAS.map((x) => (
                        <SelectItem key={x} value={String(x)}>
                          {x} cuotas
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="block">
                <span className="text-[13px] font-semibold">{tipo === "ANTICIPO" ? "Se descuenta en" : "Primera cuota en"}</span>
                <Select items={meses.map((x) => ({ value: x, label: `Liquidación ${mesTxt(x)}` }))} value={inicio} onValueChange={(v) => setInicio(v ?? periodoActual)}>
                  <SelectTrigger className="mt-1.5 h-11 w-full rounded-xl border-[#E4E1F0] px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((x) => (
                      <SelectItem key={x} value={x}>
                        Liquidación {mesTxt(x)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="block">
                <span className="text-[13px] font-semibold">Fecha de entrega</span>
                <Input name="fecha" type="date" defaultValue={hoy} max={hoy} required className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] shadow-none" />
              </label>
            </div>

            <label className="block">
              <span className="text-[13px] font-semibold">
                Motivo <span className={`font-normal ${GRIS}`}>(opcional)</span>
              </span>
              <Input name="nota" maxLength={200} placeholder="Ej.: gastos médicos" className="mt-1.5 h-11 rounded-xl border-[#E4E1F0] shadow-none" />
            </label>

            {m > 0 ? (
              <div className={`rounded-xl px-4 py-3 ${pasaDelTope ? "bg-[#FFF6E8]" : "bg-[#F8F7FC]"}`}>
                <p className="flex items-baseline justify-between text-sm">
                  <span className={GRIS}>{n === 1 ? "Descuento único" : `${n} cuotas de`}</span>
                  <b className="text-lg font-semibold tabular-nums">{clp(cuota)}</b>
                </p>
                <p className={`mt-0.5 text-xs ${pasaDelTope ? "font-medium text-[#7A4A00]" : GRIS}`}>
                  {pct > 0 ? `${formatoPct(pct)}% del sueldo bruto · ` : ""}
                  {n === 1 ? `en ${mesTxt(inicio)}` : `de ${mesTxt(inicio)} a ${mesTxt(ultimo)}`}
                </p>
                {pasaDelTope ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-[#7A4A00]">
                    <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                    La cuota supera el 15% de la remuneración. Los descuentos acordados con el trabajador tienen ese tope (art. 58 del Código del Trabajo). Sube las cuotas.
                  </p>
                ) : null}
              </div>
            ) : null}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E4E1F0] p-3">
              <input type="checkbox" name="registrarEnCaja" value="si" defaultChecked className="mt-0.5 size-[18px] accent-[#3A0CE3]" />
              <span className="text-sm">
                <span className="font-semibold">Anotar la entrega como egreso en la Caja</span>
                <span className={`mt-0.5 block text-xs ${GRIS}`}>Desmárcalo si la plata ya salió antes de usar Facilapr.</span>
              </span>
            </label>

            {estado && !estado.ok ? (
              <p role="alert" className="rounded-xl bg-[#FDECEC] px-3 py-2.5 text-sm font-medium text-[#A32020]">
                {estado.error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3.5">
            <p className={`min-w-0 flex-1 truncate text-xs ${GRIS}`}>{persona && m > 0 ? `${TEXTO_TIPO_PRESTAMO[tipo]} para ${persona.nombre.split(" ")[0]} · ${clp(m)}` : "Elige la persona y el monto"}</p>
            <DialogClose render={<Button type="button" variant="outline" className="hidden h-11 rounded-xl border-[#E4E1F0] bg-white font-semibold sm:inline-flex" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendiente || !m || !personaId} className="h-11 rounded-xl px-5 font-semibold">
              {pendiente && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
