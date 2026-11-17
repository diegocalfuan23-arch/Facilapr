"use client";

import Link from "next/link";
import { Fragment, useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Banknote, ChevronLeft, ChevronRight, Landmark, Paperclip, Search, Trash2 } from "lucide-react";
import { eliminarMovimiento } from "@/app/panel/finanzas/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmar } from "@/components/ui/confirmar";
import { TraspasoDialog } from "@/components/panel/traspaso-dialog";
import { AccionComprobante } from "@/components/panel/comprobante";
import { TIPO_DEPOSITO, TIPO_GIRO, type Bolsillos, type TraspasoConSaldo } from "@/lib/finanzas-comun";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const MESES_L = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const FILAS = "md:grid-cols-[minmax(0,1fr)_190px_130px_130px_36px]";

const TIPO = {
  [TIPO_GIRO]: { nombre: "Giro", de: "Banco", a: "Efectivo", icono: ArrowUpFromLine, tono: "bg-[#FFF3E0] text-[#B86400]" },
  [TIPO_DEPOSITO]: { nombre: "Depósito", de: "Efectivo", a: "Banco", icono: ArrowDownToLine, tono: "bg-[#E6F6EF] text-[#0A7A52]" },
} as const;

const nombreMes = (m: string) => (m === "todo" ? "Todo el historial" : `${MESES_L[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`);
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

/**
 * Los giros (sacar plata del banco a efectivo) y los depósitos (llevar efectivo al banco): cuánta plata hay
 * hoy en cada lugar y el historial. Ninguno cuenta como ingreso ni egreso en la Caja: la plata solo cambia de lugar.
 */
export function GirosVista({ bolsillos, haySaldoInicial, traspasos, hoy }: { bolsillos: Bolsillos | null; haySaldoInicial: boolean; traspasos: TraspasoConSaldo[]; hoy: string }) {
  const { confirmar, dialogo } = useConfirmar();
  const [creando, setCreando] = useState<typeof TIPO_GIRO | typeof TIPO_DEPOSITO | null>(null);
  const [borrando, iniciar] = useTransition();
  const cerrar = useCallback(() => setCreando(null), []);

  const mesHoy = hoy.slice(0, 7);
  const [mes, setMes] = useState(() => (traspasos.some((t) => t.fecha.startsWith(mesHoy)) || traspasos.length === 0 ? mesHoy : "todo"));
  const [filtro, setFiltro] = useState<"todos" | typeof TIPO_GIRO | typeof TIPO_DEPOSITO>("todos");
  const [busqueda, setBusqueda] = useState("");

  // Los meses con movimientos y el actual, del más reciente al más antiguo.
  const meses = useMemo(() => [...new Set([mesHoy, ...traspasos.map((t) => t.fecha.slice(0, 7))])].sort().reverse(), [traspasos, mesHoy]);
  const idxMes = meses.indexOf(mes);

  async function borrar(t: TraspasoConSaldo) {
    const que = t.tipo === TIPO_GIRO ? "giro" : "depósito";
    if (!(await confirmar({ titulo: `¿Borrar este ${que} de ${clp(t.monto)}?`, descripcion: "La plata vuelve al lugar de donde salió.", boton: "Borrar" }))) return;
    iniciar(async () => {
      const r = await eliminarMovimiento(t.id);
      if (r.ok) toast.success("Borrado");
      else toast.error(r.error);
    });
  }

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return traspasos.filter((t) => (mes === "todo" || t.fecha.startsWith(mes)) && (filtro === "todos" || t.tipo === filtro) && (!q || `${t.nota ?? ""} ${t.registradoPor ?? ""} ${t.referencia ?? ""}`.toLowerCase().includes(q)));
  }, [traspasos, mes, filtro, busqueda]);

  const resumenMes = (m: string) => {
    const delMes = traspasos.filter((t) => t.fecha.startsWith(m));
    return { dep: delMes.filter((t) => t.tipo === TIPO_DEPOSITO).reduce((s, t) => s + t.monto, 0), gir: delMes.filter((t) => t.tipo === TIPO_GIRO).reduce((s, t) => s + t.monto, 0) };
  };

  const total = bolsillos ? bolsillos.efectivo + bolsillos.banco : 0;
  const hayNegativo = bolsillos ? bolsillos.efectivo < 0 || bolsillos.banco < 0 : false;
  const pctEfectivo = bolsillos && total > 0 && !hayNegativo ? Math.round((bolsillos.efectivo / total) * 100) : null;
  const sinComprobante = traspasos.filter((t) => !t.comprobante).length;
  const ultimoDeposito = traspasos.find((t) => t.tipo === TIPO_DEPOSITO);
  const diasDeposito = ultimoDeposito ? diasEntre(ultimoDeposito.fecha, hoy) : null;

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[28px]">Giros y depósitos</h1>
          <p className={`mt-0.5 text-[15px] ${GRIS}`}>Lo que se mueve entre la caja del comité y su cuenta bancaria.</p>
        </div>
        <div data-tour="gir-acciones" className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" disabled={!bolsillos} onClick={() => setCreando(TIPO_GIRO)} className="h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold">
            <ArrowUpFromLine className="size-4" />
            Giro
          </Button>
          <Button disabled={!bolsillos} onClick={() => setCreando(TIPO_DEPOSITO)} className="h-10 rounded-lg px-4 font-semibold">
            <ArrowDownToLine className="size-4" />
            Depósito
          </Button>
        </div>
      </div>

      {!bolsillos ? (
        <Card className={`mt-5 items-center rounded-2xl border-0 px-6 py-12 text-center ${SOMBRA}`}>
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECE8FD] text-[#3A0CE3]">
            <Landmark className="size-7" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-semibold">Primero define el saldo inicial</p>
          <p className={`mt-1 max-w-[460px] text-sm ${GRIS}`}>Para saber cuánta plata hay en efectivo y cuánta en el banco, indica con cuánto partes y cuánto de eso estaba en la cuenta.</p>
          <Button nativeButton={false} render={<Link href="/panel/caja" />} className="mt-5 h-11 rounded-xl px-5 font-semibold">
            Ir a Caja
          </Button>
          {haySaldoInicial ? <p className={`mt-3 text-xs ${GRIS}`}>Tu saldo inicial es posterior a hoy.</p> : null}
        </Card>
      ) : (
        <Card data-tour="gir-saldos" className={`mt-5 overflow-hidden rounded-2xl border-0 ${SOMBRA}`}>
          <div className="grid grid-cols-2 items-stretch md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <div className="flex items-center gap-4 p-4 sm:p-6">
              <span aria-hidden className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF3E0] text-[#B86400] sm:flex">
                <Banknote className="size-6" />
              </span>
              <div className="min-w-0">
                <p className={`text-[13px] ${GRIS}`}>
                  <span className="sm:hidden">Efectivo</span>
                  <span className="hidden sm:inline">En efectivo (caja)</span>
                </p>
                <p className={`text-[20px] leading-tight font-semibold tabular-nums sm:text-[26px] ${bolsillos.efectivo < 0 ? "text-[#A32020]" : ""}`}>{clp(bolsillos.efectivo)}</p>
              </div>
            </div>
            <div className="hidden items-center md:flex">
              <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-[#F4F3F9] text-[#6B46F5]">
                <ArrowLeftRight className="size-4" />
              </span>
            </div>
            <div className="flex items-center gap-4 border-l border-[#F0EEF6] p-4 sm:p-6 md:border-l-0">
              <span aria-hidden className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-[#ECE8FD] text-[#3A0CE3] sm:flex">
                <Landmark className="size-6" />
              </span>
              <div className="min-w-0">
                <p className={`text-[13px] ${GRIS}`}>En el banco</p>
                <p className={`text-[20px] leading-tight font-semibold tabular-nums sm:text-[26px] ${bolsillos.banco < 0 ? "text-[#A32020]" : ""}`}>{clp(bolsillos.banco)}</p>
                {diasDeposito !== null ? (
                  <p className={`mt-0.5 hidden text-xs sm:block ${diasDeposito > 30 ? "font-medium text-[#8A4B00]" : GRIS}`}>
                    Último depósito {diasDeposito === 0 ? "hoy" : `hace ${diasDeposito} ${diasDeposito === 1 ? "día" : "días"}`}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="hidden w-px bg-[#F0EEF6] md:block" />
            <div className="col-span-2 flex items-baseline justify-between border-t border-[#F0EEF6] bg-[#FAFAFD] p-4 sm:p-6 md:col-span-1 md:flex-col md:justify-center md:border-t-0">
              <p className={`text-[13px] ${GRIS}`}>Total del comité</p>
              <p className="text-[26px] leading-tight font-semibold tabular-nums">{clp(total)}</p>
            </div>
          </div>

          {pctEfectivo !== null || hayNegativo ? (
            <div className="border-t border-[#F0EEF6] px-5 py-4 sm:px-6">
              {pctEfectivo !== null ? (
                <>
                  <div className="flex h-2.5 overflow-hidden rounded-full" role="img" aria-label={`${pctEfectivo}% en efectivo, ${100 - pctEfectivo}% en el banco`}>
                    <span className="bg-[#F0A23C]" style={{ width: `${pctEfectivo}%` }} />
                    <span className="bg-[#6B46F5]" style={{ width: `${100 - pctEfectivo}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#F0A23C]" />
                      <span className={GRIS}>Efectivo</span>
                      <b className="font-semibold">{pctEfectivo}%</b>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#6B46F5]" />
                      <span className={GRIS}>Banco</span>
                      <b className="font-semibold">{100 - pctEfectivo}%</b>
                    </span>
                    {pctEfectivo > 50 ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-[#FFF6E8] px-2.5 py-1 font-medium text-[#7A4A00] sm:ml-auto">
                        <AlertTriangle className="size-3.5" aria-hidden />
                        <span className="sm:hidden">Mucho efectivo en caja.</span>
                        <span className="hidden sm:inline">Hay mucho efectivo en caja. Conviene depositar.</span>
                        <button type="button" onClick={() => setCreando(TIPO_DEPOSITO)} className="font-semibold underline">
                          Depositar
                        </button>
                      </span>
                    ) : null}
                  </div>
                </>
              ) : null}
              {hayNegativo ? (
                <p className="flex items-start gap-1.5 text-xs font-medium text-[#7A4A00]">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                  Uno de los dos saldos sale negativo: se pagó más en ese lugar de lo que había. Anota el giro o depósito que falta.
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>
      )}

      {bolsillos && traspasos.length === 0 ? (
        <Card className={`mt-4 items-center rounded-2xl border-0 px-6 py-14 text-center ${SOMBRA}`}>
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECE8FD] text-[#3A0CE3]">
            <ArrowLeftRight className="size-7" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-semibold">Aún no hay giros ni depósitos</p>
          <p className={`mt-1 max-w-[460px] text-sm ${GRIS}`}>Registra aquí cada vez que lleves la recaudación al banco o saques plata para pagos en efectivo. Así la caja y la cuenta siempre cuadran.</p>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={() => setCreando(TIPO_GIRO)} className="h-11 rounded-xl border-[#E4E1F0] font-semibold">
              <ArrowUpFromLine className="size-4" />
              Registrar giro
            </Button>
            <Button onClick={() => setCreando(TIPO_DEPOSITO)} className="h-11 rounded-xl px-5 font-semibold">
              <ArrowDownToLine className="size-4" />
              Registrar depósito
            </Button>
          </div>
        </Card>
      ) : null}

      {bolsillos && traspasos.length > 0 ? (
        <Card className={`mt-4 min-w-0 overflow-hidden rounded-2xl border-0 ${SOMBRA}`}>
          <div className="flex flex-col gap-3 border-b border-[#F0EEF6] p-4 sm:px-5 lg:flex-row lg:items-center">
            <div className="min-w-0 sm:mr-auto">
              <h2 className="text-[15px] font-semibold">Movimientos</h2>
              <p className={`text-xs ${GRIS}`}>
                {lista.length} en {nombreMes(mes).toLowerCase()} · saldo del banco al cierre de cada día
              </p>
            </div>
            <div className="flex h-10 items-center rounded-lg ring-1 ring-[#E4E1F0]">
              <Button variant="ghost" size="icon" aria-label="Mes anterior" disabled={mes === "todo" || idxMes === meses.length - 1} onClick={() => setMes(meses[idxMes + 1])} className="size-10 rounded-lg">
                <ChevronLeft className="size-4" />
              </Button>
              <Select items={[...meses.map((m) => ({ value: m, label: nombreMes(m) })), { value: "todo", label: "Todo el historial" }]} value={mes} onValueChange={(v) => setMes(v ?? "todo")}>
                <SelectTrigger aria-label="Mes" className="h-9 min-w-0 flex-1 border-0 px-2 text-sm font-semibold shadow-none focus:ring-0 lg:w-[172px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m} value={m}>
                      {nombreMes(m)}
                    </SelectItem>
                  ))}
                  <SelectItem value="todo">Todo el historial</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" aria-label="Mes siguiente" disabled={mes === "todo" || idxMes === 0} onClick={() => setMes(meses[idxMes - 1])} className="size-10 rounded-lg">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-[#F4F3F9] p-1 lg:w-[250px]">
              {(
                [
                  ["todos", "Todos"],
                  [TIPO_DEPOSITO, "Depósitos"],
                  [TIPO_GIRO, "Giros"],
                ] as const
              ).map(([k, t]) => (
                <button key={k} role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)} className={`h-8 rounded-md text-[13px] font-semibold ${filtro === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="relative lg:w-[180px]">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Buscar" autoComplete="off" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
            </div>
          </div>

          <div className={`hidden grid-cols-[minmax(0,1fr)_190px_130px_130px_36px] gap-4 border-b border-[#F3F1F8] bg-[#FAFAFD] px-5 py-2.5 text-xs font-medium md:grid ${GRIS}`}>
            <span>Movimiento</span>
            <span>Lo anotó</span>
            <span>Comprobante</span>
            <span className="text-right">Monto</span>
            <span />
          </div>
          <ul className="divide-y divide-[#F3F1F8]">
            {lista.map((t, idx) => {
              const x = TIPO[t.tipo];
              const I = x.icono;
              const delMes = t.fecha.slice(0, 7);
              const mesNuevo = idx === 0 || lista[idx - 1].fecha.slice(0, 7) !== delMes;
              const rm = resumenMes(delMes);
              const [y, mo, d] = t.fecha.split("-").map(Number);
              return (
                <Fragment key={t.id}>
                  {mesNuevo ? (
                    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 bg-[#FAFAFD] px-4 py-2 md:px-5">
                      <span className="text-[13px] font-semibold">{nombreMes(delMes)}</span>
                      <span className={`text-xs ${GRIS}`}>
                        {rm.dep ? <span className="text-[#075A3C]">+{clp(rm.dep)} depositado</span> : null}
                        {rm.dep && rm.gir ? " · " : ""}
                        {rm.gir ? <span className="text-[#8A4B00]">{clp(rm.gir)} girado</span> : null}
                      </span>
                    </li>
                  ) : null}
                  <li className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 md:px-5 ${FILAS}`}>
                    <span className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${x.tono}`}>
                        <I className="size-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                          {x.nombre}
                          <span className={`text-xs font-normal ${GRIS}`}>
                            {x.de} → {x.a}
                          </span>
                        </span>
                        <span className={`block truncate text-[13px] ${GRIS}`}>
                          {d} {MESES[mo - 1]}
                          {y !== Number(hoy.slice(0, 4)) ? ` ${y}` : ""}
                          {t.nota ? ` · ${t.nota}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className={`hidden min-w-0 truncate text-[13px] md:block ${GRIS}`}>{t.registradoPor ? `${t.registradoPor}${t.rol ? ` · ${t.rol}` : ""}` : "—"}</span>
                    <span className="hidden min-w-0 md:block">
                      {t.referencia ? <span className={`block truncate text-[13px] ${GRIS}`}>N° {t.referencia}</span> : null}
                      <AccionComprobante movimientoId={t.id} tiene={t.comprobante} />
                    </span>
                    <span className={`text-right text-[15px] font-semibold tabular-nums ${t.tipo === TIPO_DEPOSITO ? "text-[#075A3C]" : "text-[#8A4B00]"}`}>
                      {t.tipo === TIPO_DEPOSITO ? "+" : "−"}
                      {clp(t.monto)}
                      {t.bancoAlCierre !== null ? <span className={`block text-[11px] font-normal ${GRIS}`}>banco {clp(t.bancoAlCierre)}</span> : null}
                    </span>
                    <button
                      type="button"
                      aria-label={`Borrar ${t.tipo === TIPO_GIRO ? "giro" : "depósito"} del ${t.fecha.split("-").reverse().join("-")}`}
                      title="Borrar"
                      disabled={borrando}
                      onClick={() => void borrar(t)}
                      className="flex size-9 items-center justify-center rounded-lg text-[#A19FB2] hover:bg-[#FDF3F3] hover:text-[#A32020]"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                </Fragment>
              );
            })}
            {lista.length === 0 ? (
              <li className={`px-6 py-12 text-center text-sm ${GRIS}`}>
                Sin {filtro === TIPO_GIRO ? "giros" : filtro === TIPO_DEPOSITO ? "depósitos" : "movimientos"} en {nombreMes(mes).toLowerCase()}.
                {mes !== "todo" ? (
                  <>
                    {" "}
                    <button type="button" onClick={() => setMes("todo")} className="font-semibold text-[#2A07A8] hover:underline">
                      Ver todo el historial
                    </button>
                  </>
                ) : null}
              </li>
            ) : null}
          </ul>
          {sinComprobante > 0 ? (
            <p className="flex items-center gap-1.5 border-t border-[#F0EEF6] bg-[#FFFBF3] px-5 py-2.5 text-xs text-[#7A4A00]">
              <Paperclip className="size-3.5 shrink-0" aria-hidden />
              {sinComprobante} {sinComprobante === 1 ? "movimiento sin comprobante" : "movimientos sin comprobante"}. Adjúntalo{sinComprobante === 1 ? "" : "s"} para tener su respaldo.
            </p>
          ) : null}
        </Card>
      ) : null}

      {bolsillos ? <p className={`mt-4 text-xs ${GRIS}`}>Los giros y depósitos no cambian el total del comité: solo cambian dónde está la plata. No aparecen como ingresos ni egresos en la rendición.</p> : null}

      {dialogo}
      {creando && <TraspasoDialog tipoInicial={creando} bolsillos={bolsillos} onCerrar={cerrar} />}
    </div>
  );
}
