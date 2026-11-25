"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, Download, FileText, HandCoins, Loader2, MoreHorizontal, Pencil, Percent, Plus, RefreshCw, Search, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { aplicarSubsidios, guardarSubsidio, quitarSubsidio, renovarSubsidio } from "@/app/panel/subsidios/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatearPeriodo, montoDeSubsidio, textoSubsidio, type ReglaSubsidio } from "@/lib/boletas";
import { formatearRut } from "@/lib/formato";
import { estadoSubsidio, mesesEntre, sumarMeses, type Beneficiario, type SocioSubsidiable } from "@/lib/subsidios-comun";
import { cn } from "@/lib/utils";

const SOMBRA = "shadow-[0_8px_24px_rgba(58,12,227,0.08)]";
const GRIS = "text-[#5B5970]";
const CAMPO = "h-11 rounded-xl border-[#E4E1F0] bg-white shadow-none";
const MC = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const mesCorto = (mes: string) => `${MC[Number(mes.slice(5, 7)) - 1]} ${mes.slice(2, 4)}`;
const iniciales = (nombre: string) => nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
const datos = (s: { numeroCliente: string | null; rut: string | null }) => [s.numeroCliente ? `N° ${s.numeroCliente}` : null, s.rut ? formatearRut(s.rut) : null].filter(Boolean).join(" · ");
const sinTildes = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const coincide = (s: { nombre: string; rut: string | null; numeroCliente: string | null }, q: string) =>
  sinTildes(`${s.nombre} ${s.rut ?? ""} ${s.rut ? formatearRut(s.rut) : ""} ${s.numeroCliente ?? ""}`).includes(sinTildes(q.trim()));

/** Una celda para Excel: entre comillas y sin que un texto se lea como fórmula. */
const celda = (v: string | number | null) => {
  const t = String(v ?? "");
  return `"${(typeof v === "string" && /^[=+\-@]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
};

type Filtro = "vigentes" | "porVencer" | "vencidos";

export function SubsidiosVista({
  comite,
  periodo,
  porAplicar,
  tarifa,
  socios,
  beneficiarios,
}: {
  comite: string;
  periodo: string;
  /** Boletas del mes cuyo subsidio aún no está puesto como corresponde. */
  porAplicar: number;
  tarifa: { cargoFijo: number | null; valorM3: number | null };
  socios: SocioSubsidiable[];
  beneficiarios: Beneficiario[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("vigentes");
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<Beneficiario | "nuevo" | null>(null);
  const [quitando, setQuitando] = useState<Beneficiario | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const filas = beneficiarios.map((b) => {
    const estado = estadoSubsidio(b, periodo);
    return { b, estado, activo: estado === "vigente" || estado === "porVencer" };
  });
  const activos = filas.filter((f) => f.activo);
  const conSubsidio = beneficiarios.filter((b) => (b.boleta?.subsidio ?? 0) > 0);
  const total = conSubsidio.reduce((s, b) => s + b.boleta!.subsidio, 0);
  const m3 = conSubsidio.reduce((s, b) => {
    const consumo = b.boleta!.consumoM3 ?? 0;
    return s + (b.tipo === "PORCENTAJE" && b.topeM3 !== null ? Math.min(consumo, b.topeM3) : consumo);
  }, 0);
  const porVencer = filas.filter((f) => f.estado === "porVencer").length;
  const vencidos = filas.filter((f) => f.estado === "vencido").length;
  const aplicado = porAplicar === 0 && conSubsidio.length > 0;
  const visibles = filas.filter(
    (f) => (filtro === "vigentes" ? f.estado !== "vencido" : filtro === "porVencer" ? f.estado === "porVencer" : f.estado === "vencido") && (!q.trim() || coincide(f.b, q))
  );

  const irAlMes = (mes: string) => router.push(`/panel/subsidios?mes=${mes}`);

  function descargar() {
    const cabecera = ["N°", "Nombre", "RUT", "Decreto", "Mes", "Descuento", "Consumo m3", "Valor boleta", "Subsidio", "Paga el socio"];
    const cuerpo = conSubsidio.map((b) => [
      b.numeroCliente,
      b.nombre,
      b.rut ? formatearRut(b.rut) : "",
      b.decreto,
      periodo,
      textoSubsidio(b),
      b.boleta!.consumoM3,
      b.boleta!.paga + b.boleta!.subsidio,
      b.boleta!.subsidio,
      b.boleta!.paga,
    ]);
    const csv = [cabecera, ...cuerpo].map((f) => f.map(celda).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `Subsidios ${periodo} ${comite}.csv`.replace(/[\\/:*?"<>|]/g, "-");
    enlace.click();
    URL.revokeObjectURL(url);
  }

  const renovar = (b: Beneficiario) =>
    iniciar(async () => {
      const r = await renovarSubsidio(b.id);
      if (r.ok) toast.success("Renovado por 12 meses");
      else toast.error(r.error);
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Subsidios</h1>
          <p className={cn("mt-1 text-[15px]", GRIS)}>La municipalidad paga parte de la boleta de estos socios. Tú le cobras cada mes.</p>
        </div>
        <Button onClick={() => setEditando("nuevo")} disabled={socios.length === 0} className="h-10 rounded-lg px-4 font-semibold">
          <Plus />
          Agregar beneficiario
        </Button>
      </div>

      {/* Mes y cobro */}
      <Card className={cn("gap-0 overflow-hidden rounded-2xl border-0 p-0", SOMBRA)}>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#F0EEF6] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => irAlMes(sumarMeses(periodo, -1))} className="size-9 rounded-lg">
              <ChevronLeft />
            </Button>
            <p className="w-[150px] text-center text-[15px] font-semibold first-letter:uppercase">{formatearPeriodo(periodo)}</p>
            <Button variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => irAlMes(sumarMeses(periodo, 1))} className="size-9 rounded-lg">
              <ChevronRight />
            </Button>
          </div>
          <span
            className={cn(
              "flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
              porAplicar > 0 ? "bg-[#FFF3E0] text-[#8A4B00]" : aplicado ? "bg-[#E6F6EF] text-[#075A3C]" : "bg-[#F4F3F9] text-[#5B5970]"
            )}
          >
            {porAplicar > 0 ? <AlertTriangle className="size-3.5" aria-hidden /> : aplicado ? <Check className="size-3.5" aria-hidden /> : null}
            {porAplicar > 0 ? `Sin aplicar · ${porAplicar}` : aplicado ? "Aplicado a las boletas" : "Sin boletas subsidiadas"}
          </span>
          <div className="grid w-full grid-cols-2 gap-2 md:ml-auto md:flex md:w-auto">
            {porAplicar > 0 && (
              <Button onClick={() => setConfirmando(true)} className="h-10 rounded-lg px-4 font-semibold">
                <RefreshCw />
                <span className="sm:hidden">Aplicar</span>
                <span className="hidden sm:inline">Aplicar a las boletas</span>
              </Button>
            )}
            <Button variant="outline" disabled={!aplicado} onClick={descargar} className={cn("h-10 rounded-lg border-[#E4E1F0] bg-white font-semibold", porAplicar === 0 && "col-span-2")}>
              <Download />
              <span className="sm:hidden">Planilla</span>
              <span className="hidden sm:inline">Planilla municipal</span>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4">
          <div className="col-span-2 px-4 py-4 sm:px-6 lg:col-span-1">
            <p className={cn("text-[13px]", GRIS)}>{porAplicar > 0 ? "Estimado a cobrar" : "Por cobrar a la municipalidad"}</p>
            <p className="text-[32px] leading-tight font-bold tabular-nums">{clp(total)}</p>
            <p className={cn("text-xs", GRIS)}>{porAplicar > 0 ? "Se confirma al aplicar" : "Ya descontado de las boletas"}</p>
          </div>
          <div className="border-t border-[#F0EEF6] px-4 py-4 sm:px-6 lg:border-t-0 lg:border-l">
            <p className={cn("text-[13px]", GRIS)}>Beneficiarios</p>
            <p className="text-2xl font-semibold tabular-nums">{activos.length}</p>
            <p className={cn("text-xs", GRIS)}>con subsidio este mes</p>
          </div>
          <div className="border-t border-l border-[#F0EEF6] px-4 py-4 sm:px-6 lg:border-t-0">
            <p className={cn("text-[13px]", GRIS)}>Consumo subsidiado</p>
            <p className="text-2xl font-semibold tabular-nums">{m3} m³</p>
            <p className={cn("text-xs", GRIS)}>en las boletas del mes</p>
          </div>
          <button type="button" onClick={() => setFiltro("porVencer")} className="col-span-2 border-t border-[#F0EEF6] px-4 py-4 text-left hover:bg-[#FFFBF3] sm:px-6 lg:col-span-1 lg:border-t-0 lg:border-l">
            <p className={cn("text-[13px]", GRIS)}>Por vencer</p>
            <p className={cn("text-2xl font-semibold tabular-nums", porVencer > 0 && "text-[#8A4B00]")}>{porVencer}</p>
            <p className={cn("flex items-center gap-1 text-xs", porVencer > 0 ? "font-medium text-[#8A4B00]" : GRIS)}>
              {porVencer > 0 ? (
                <>
                  Renovar decretos
                  <ChevronRight className="size-3" aria-hidden />
                </>
              ) : (
                "Nada por renovar"
              )}
            </p>
          </button>
        </div>
      </Card>

      {/* Lista */}
      <Card className={cn("gap-0 overflow-hidden rounded-2xl border-0 p-0", SOMBRA)}>
        <div className="flex flex-col gap-2 border-b border-[#F0EEF6] p-4 sm:flex-row sm:items-center">
          <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-[#F4F3F9] p-1 sm:w-[360px]">
            {(
              [
                ["vigentes", "Vigentes", beneficiarios.length - vencidos],
                ["porVencer", "Por vencer", porVencer],
                ["vencidos", "Vencidos", vencidos],
              ] as const
            ).map(([k, t, n]) => (
              <button key={k} type="button" role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)} className={cn("h-8 rounded-md text-[13px] font-semibold", filtro === k ? "bg-white text-[#2A07A8] shadow-sm" : GRIS)}>
                {t} <span className={cn("text-xs", filtro === k ? "text-[#6B46F5]" : "text-[#A19FB2]")}>{n}</span>
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto sm:w-[240px]">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Buscar beneficiario" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, RUT o N°" className="h-10 rounded-lg border-[#E4E1F0] pl-9 shadow-none" />
          </div>
        </div>

        <div className={cn("hidden grid-cols-[minmax(0,1.3fr)_130px_200px_80px_110px_110px_40px] gap-4 border-b border-[#F3F1F8] bg-[#FAFAFD] px-6 py-2 text-xs font-medium xl:grid", GRIS)}>
          <span>Socio</span>
          <span>Subsidio</span>
          <span>Vigencia</span>
          <span className="text-right">Consumo</span>
          <span className="text-right">Municipalidad</span>
          <span className="text-right">Paga el socio</span>
          <span />
        </div>

        <ul className="divide-y divide-[#F3F1F8]">
          {visibles.map(({ b, estado, activo }) => {
            const boleta = activo ? b.boleta : null;
            return (
              <li key={b.id} className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-4 pr-12 pl-4 hover:bg-[#FBFAFF] sm:pl-6 xl:grid-cols-[minmax(0,1.3fr)_130px_200px_80px_110px_110px_40px] xl:pr-6">
                <span className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#ECE8FD] text-xs font-bold text-[#2A07A8]">{iniciales(b.nombre)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{b.nombre}</span>
                    <span className={cn("block truncate text-[13px]", GRIS)}>{[datos(b), b.decreto].filter(Boolean).join(" · ")}</span>
                    {b.vencidas > 0 && (
                      <span className="block text-xs font-medium text-[#A32020]">
                        {b.vencidas} {b.vencidas === 1 ? "boleta vencida" : "boletas vencidas"}
                      </span>
                    )}
                  </span>
                </span>
                <span>
                  <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap", b.tipo === "PORCENTAJE" ? "bg-[#E6F6EF] text-[#075A3C]" : "bg-[#E7F4FB] text-[#0B5E8E]")}>
                    {b.tipo === "MONTO" ? `${clp(b.valor)} fijo` : b.topeM3 === null ? `${b.valor}% del total` : `${b.valor}% · ${b.topeM3} m³`}
                  </span>
                </span>
                <span className="col-span-2 pl-12 xl:col-span-1 xl:pl-0">
                  <Vigencia desde={b.desde} hasta={b.hasta} mes={periodo} estado={estado} />
                </span>
                <span className={cn("hidden text-right text-[13px] tabular-nums xl:block", GRIS)}>{boleta?.consumoM3 != null ? `${boleta.consumoM3} m³` : "—"}</span>
                <span className="hidden text-right text-sm font-semibold text-[#0A7A52] tabular-nums xl:block">{boleta ? `−${clp(boleta.subsidio)}` : "—"}</span>
                <span className="hidden text-right xl:block">
                  {boleta ? (
                    <>
                      <span className="block text-sm font-semibold tabular-nums">{clp(boleta.paga)}</span>
                      {boleta.subsidio > 0 && <span className={cn("block text-[11px] tabular-nums line-through", GRIS)}>{clp(boleta.paga + boleta.subsidio)}</span>}
                    </>
                  ) : (
                    <span className={GRIS}>—</span>
                  )}
                </span>
                {boleta ? (
                  <span className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F7F6FB] px-3 py-2 text-[13px] xl:hidden">
                    <span className={GRIS}>
                      {boleta.consumoM3 != null ? `${boleta.consumoM3} m³ · ` : ""}boleta {clp(boleta.paga + boleta.subsidio)}
                    </span>
                    <span>
                      <b className="text-[#0A7A52]">−{clp(boleta.subsidio)}</b> · paga <b>{clp(boleta.paga)}</b>
                    </span>
                  </span>
                ) : null}
                <span className="absolute top-3 right-2 xl:static">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" aria-label={`Opciones de ${b.nombre}`} className="size-9 rounded-lg text-[#6E6B85]">
                          <MoreHorizontal />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditando(b)}>
                        <Pencil />
                        Editar
                      </DropdownMenuItem>
                      {estado !== "vigente" && b.hasta ? (
                        <DropdownMenuItem onClick={() => renovar(b)}>
                          <RefreshCw />
                          Renovar 1 año
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => setQuitando(b)} className="text-[#A32020]">
                        <Trash2 />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              </li>
            );
          })}
          {visibles.length === 0 && (
            <li className="px-6 py-32 text-center">
              <span aria-hidden className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#E6F6EF] text-[#0A7A52]">
                <HandCoins className="size-6" />
              </span>
              <p className="mt-2 font-semibold">{q ? "Nadie coincide" : filtro === "porVencer" ? "Nada por vencer" : filtro === "vencidos" ? "No hay subsidios vencidos" : "Aún no hay beneficiarios"}</p>
              {!q && filtro === "vigentes" && (
                <Button onClick={() => setEditando("nuevo")} disabled={socios.length === 0} className="mt-4 h-10 rounded-lg font-semibold">
                  <Plus />
                  Agregar beneficiario
                </Button>
              )}
            </li>
          )}
        </ul>
        {conSubsidio.length > 0 && filtro === "vigentes" && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-3 text-[13px]">
            <span className={GRIS}>
              {conSubsidio.length} {conSubsidio.length === 1 ? "boleta" : "boletas"} · {formatearPeriodo(periodo)}
            </span>
            <span>
              Total municipalidad <b className="text-[#0A7A52] tabular-nums">{clp(total)}</b>
            </span>
          </div>
        )}
      </Card>

      {tarifa.cargoFijo !== null && tarifa.valorM3 !== null && (
        <p className={cn("px-1 text-xs", GRIS)}>
          Tarifa residencial: cargo fijo {clp(tarifa.cargoFijo)} y {clp(tarifa.valorM3)} por m³. Con tope, el porcentaje se aplica al cargo fijo y al consumo hasta el tope.
        </p>
      )}

      {editando && (
        <BeneficiarioDialog
          key={editando === "nuevo" ? "nuevo" : editando.id}
          base={editando === "nuevo" ? null : editando}
          socios={socios}
          usados={new Set(beneficiarios.map((b) => b.socioId))}
          periodo={periodo}
          onCerrar={() => setEditando(null)}
        />
      )}

      <Dialog open={!!quitando} onOpenChange={(v) => !v && setQuitando(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar este subsidio?</DialogTitle>
            <DialogDescription>{quitando?.nombre}. Las boletas ya emitidas no cambian.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuitando(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await quitarSubsidio(quitando!.id);
                  if (r.ok) toast.success("Subsidio eliminado");
                  else toast.error(r.error);
                  setQuitando(null);
                })
              }
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Aplicar a {formatearPeriodo(periodo)}</DialogTitle>
            <DialogDescription>
              Cambia el monto de {porAplicar} {porAplicar === 1 ? "boleta sin pagos" : "boletas sin pagos"}. Si ya las enviaste, vuelve a enviarlas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await aplicarSubsidios(periodo);
                  if (r.ok) toast.success(r.cambiadas === 1 ? "1 boleta actualizada" : `${r.cambiadas} boletas actualizadas`);
                  else toast.error(r.error);
                  setConfirmando(false);
                })
              }
            >
              {pendiente && <Loader2 className="animate-spin" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** «mar 26 → feb 29» con lo que lleva y lo que le queda. */
function Vigencia({ desde, hasta, mes, estado }: { desde: string; hasta: string | null; mes: string; estado: ReturnType<typeof estadoSubsidio> }) {
  const duracion = hasta ? mesesEntre(desde, hasta) + 1 : 0;
  const pasados = Math.max(0, Math.min(mesesEntre(desde, mes) + 1, duracion));
  const quedan = duracion - pasados;
  const texto =
    estado === "futuro"
      ? `Parte en ${formatearPeriodo(desde)}`
      : estado === "vencido"
        ? "Vencido"
        : estado === "porVencer"
          ? mes === hasta
            ? "Vence este mes"
            : "Vence el próximo mes"
          : `${quedan} ${quedan === 1 ? "mes" : "meses"} más`;
  return (
    <span className="block min-w-0">
      <span className="block text-[13px] tabular-nums">
        {mesCorto(desde)} → {hasta ? mesCorto(hasta) : "sin término"}
      </span>
      {hasta ? (
        <span className="mt-1 flex items-center gap-2">
          <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-[#EFEDF7]">
            <span className={cn("block h-full rounded-full", estado === "porVencer" ? "bg-[#E58200]" : estado === "vencido" ? "bg-[#B4B2C4]" : "bg-[#0A9B68]")} style={{ width: `${(pasados / duracion) * 100}%` }} />
          </span>
          <span className={cn("text-[11px] whitespace-nowrap", estado === "porVencer" ? "font-semibold text-[#8A4B00]" : estado === "vencido" ? "text-[#A32020]" : GRIS)}>{texto}</span>
        </span>
      ) : estado === "futuro" ? (
        <span className={cn("block text-[11px]", GRIS)}>{texto}</span>
      ) : null}
    </span>
  );
}

const pastilla = (activa: boolean) => cn("font-semibold ring-1", activa ? "bg-[#3A0CE3] text-white ring-[#3A0CE3]" : "bg-white text-[#46435C] ring-[#E4E1F0] hover:bg-[#F7F5FF]");

function BeneficiarioDialog({
  base,
  socios,
  usados,
  periodo,
  onCerrar,
}: {
  base: Beneficiario | null;
  socios: SocioSubsidiable[];
  usados: Set<string>;
  periodo: string;
  onCerrar: () => void;
}) {
  const [socioId, setSocioId] = useState(base?.socioId ?? "");
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<ReglaSubsidio["tipo"]>(base?.tipo ?? "PORCENTAJE");
  const [valor, setValor] = useState(String(base?.valor ?? 50));
  const [tope, setTope] = useState(base ? (base.topeM3 === null ? "" : String(base.topeM3)) : "15");
  const [desde, setDesde] = useState(base?.desde ?? periodo);
  const [hasta, setHasta] = useState(base?.hasta ?? "");
  const [decreto, setDecreto] = useState(base?.decreto ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  // Un beneficiario dado de baja no está en el padrón activo: se muestra con sus datos.
  const socio: SocioSubsidiable | null =
    socios.find((s) => s.id === socioId) ??
    (base && base.socioId === socioId ? { id: base.socioId, nombre: base.nombre, rut: base.rut, numeroCliente: base.numeroCliente, promedio: null, cargoFijo: null, valorM3: null } : null);
  const resultados = q.trim() ? socios.filter((s) => coincide(s, q)).slice(0, 5) : [];
  const v = Number(valor) || 0;
  const valorOk = tipo === "PORCENTAJE" ? v > 0 && v <= 100 : v > 0;
  const hastaOk = !hasta || hasta >= desde;
  const valido = !!socio && valorOk && !!desde && hastaOk;
  const consumo = socio?.promedio ?? 15;
  const ejemplo =
    socio && valorOk && socio.cargoFijo !== null && socio.valorM3 !== null
      ? (() => {
          const total = socio.cargoFijo! + consumo * socio.valorM3!;
          const subsidio = montoDeSubsidio(socio.cargoFijo!, socio.valorM3!, consumo, { tipo, valor: v, topeM3: tipo === "PORCENTAJE" && tope ? Number(tope) : null });
          return { total, subsidio, paga: total - subsidio };
        })()
      : null;
  const meses = hasta && desde ? mesesEntre(desde, hasta) + 1 : 0;

  function guardar() {
    if (!valido || !socio) return;
    setError(null);
    iniciar(async () => {
      const formulario = new FormData();
      for (const [clave, dato] of Object.entries({ socioId: socio.id, tipo, valor, topeM3: tope, desde, hasta, decreto })) formulario.set(clave, dato);
      const r = await guardarSubsidio(null, formulario);
      if (r.ok) {
        toast.success(base ? "Cambios guardados" : "Beneficiario agregado");
        onCerrar();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[620px] sm:p-0">
        <div className="flex items-start gap-4 border-b border-[#F0EEF6] py-4 pr-12 pl-6">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E6F6EF] text-[#0A7A52]">
            <HandCoins className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold">{base ? "Editar subsidio" : "Agregar beneficiario"}</DialogTitle>
            <DialogDescription className={cn("text-[13px]", GRIS)}>La parte subsidiada se descuenta de su boleta y se cobra a la municipalidad.</DialogDescription>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
          <section>
            <p className="text-[13px] font-semibold">Socio</p>
            {socio ? (
              <div className="mt-1 flex items-center gap-3 rounded-xl bg-[#F7F5FF] px-4 py-3 ring-1 ring-[#E4DEFA]">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ECE8FD] text-[13px] font-bold text-[#2A07A8]">{iniciales(socio.nombre)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{socio.nombre}</span>
                  <span className={cn("block truncate text-xs", GRIS)}>{[datos(socio), socio.promedio !== null ? `consume ${socio.promedio} m³ al mes en promedio` : null].filter(Boolean).join(" · ")}</span>
                </span>
                {!base && (
                  <button type="button" onClick={() => setSocioId("")} className="shrink-0 rounded-md px-2 py-1 text-[13px] font-semibold text-[#2A07A8] hover:bg-[#ECE8FD]">
                    Cambiar
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-1">
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8F8CA3]" aria-hidden />
                  <Input autoFocus aria-label="Buscar socio" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, RUT o N° de socio" className={cn(CAMPO, "pl-9")} />
                </div>
                {resultados.length > 0 ? (
                  <ul className="mt-1 overflow-hidden rounded-xl ring-1 ring-[#ECEAF4]">
                    {resultados.map((s) => {
                      const ya = usados.has(s.id);
                      return (
                        <li key={s.id}>
                          <button type="button" disabled={ya} onClick={() => setSocioId(s.id)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-[#F8F7FC] disabled:cursor-not-allowed disabled:opacity-50">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{s.nombre}</span>
                              <span className={cn("block text-xs", GRIS)}>{datos(s)}</span>
                            </span>
                            {ya ? <span className="shrink-0 rounded-full bg-[#E6F6EF] px-2 py-1 text-[11px] font-semibold text-[#075A3C]">Ya tiene subsidio</span> : <ChevronRight className="size-4 text-[#A19FB2]" aria-hidden />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : q.trim() ? (
                  <p className={cn("mt-2 text-xs", GRIS)}>Ningún socio coincide.</p>
                ) : null}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold">Descuento</p>
            <div role="radiogroup" aria-label="Tipo de descuento" className="grid grid-cols-2 gap-2">
              {(
                [
                  ["PORCENTAJE", "Porcentaje", "Subsidio al Agua Potable", Percent],
                  ["MONTO", "Monto fijo", "Un valor en pesos cada mes", HandCoins],
                ] as const
              ).map(([k, t, d, Icono]) => {
                const on = tipo === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      if (on) return;
                      setTipo(k);
                      setValor(base?.tipo === k ? String(base.valor) : k === "PORCENTAJE" ? "50" : "5000");
                    }}
                    className={cn("flex items-center gap-3 rounded-xl border p-3 text-left", on ? "border-[#3A0CE3] bg-[#F7F5FF] ring-1 ring-[#3A0CE3]" : "border-[#E9E6F2] hover:bg-[#FBFAFE]")}
                  >
                    <span aria-hidden className={cn("hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex", on ? "bg-[#ECE8FD] text-[#3A0CE3]" : "bg-[#F4F3F9] text-[#5B5970]")}>
                      <Icono className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block text-sm font-semibold", on && "text-[#2A07A8]")}>{t}</span>
                      <span className={cn("hidden truncate text-xs sm:block", GRIS)}>{d}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {tipo === "PORCENTAJE" ? (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_130px]">
                <div>
                  <span className={cn("text-xs", GRIS)}>Porcentaje que cubre</span>
                  <div className="mt-1 grid grid-cols-3 gap-1 sm:grid-cols-6">
                    {[25, 50, 75, 85, 100].map((p) => (
                      <button key={p} type="button" aria-pressed={v === p} onClick={() => setValor(String(p))} className={cn("h-10 rounded-lg text-[13px]", pastilla(v === p))}>
                        {p}%
                      </button>
                    ))}
                    <div className={cn("flex h-10 items-center rounded-lg ring-1", valorOk ? "ring-[#E4E1F0]" : "ring-[#E5484D]")}>
                      <input aria-label="Otro porcentaje" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, "").slice(0, 3))} className="w-full min-w-0 bg-transparent pl-2 text-sm font-semibold tabular-nums outline-none" />
                      <span className={cn("pr-2 text-sm", GRIS)}>%</span>
                    </div>
                  </div>
                </div>
                <label className="block">
                  <span className={cn("text-xs", GRIS)}>Tope de consumo</span>
                  <div className="mt-1 flex h-10 items-center rounded-lg ring-1 ring-[#E4E1F0]">
                    <input inputMode="numeric" value={tope} onChange={(e) => setTope(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Sin tope" className="w-full min-w-0 bg-transparent pl-3 text-sm font-semibold tabular-nums outline-none" />
                    <span className={cn("pr-2 text-sm", GRIS)}>m³</span>
                  </div>
                </label>
              </div>
            ) : (
              <label className="block">
                <span className={cn("text-xs", GRIS)}>Monto mensual</span>
                <div className="mt-1 flex h-11 items-center rounded-xl ring-1 ring-[#E4E1F0] sm:w-[220px]">
                  <span className={cn("pl-3 text-sm", GRIS)}>$</span>
                  <input inputMode="numeric" value={v ? v.toLocaleString("es-CL") : ""} onChange={(e) => setValor(e.target.value.replace(/\D/g, "").slice(0, 8))} className="w-full bg-transparent px-1 text-sm font-semibold tabular-nums outline-none" />
                </div>
              </label>
            )}

            {ejemplo ? (
              <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-[#F7FCF9] ring-1 ring-[#CDEFD9]">
                <div className="min-w-0 px-3 py-3">
                  <p className={cn("truncate text-[11px]", GRIS)}>{socio?.promedio != null ? `Boleta ${consumo} m³` : `Ejemplo ${consumo} m³`}</p>
                  <p className="text-[15px] font-semibold tabular-nums">{clp(ejemplo.total)}</p>
                </div>
                <div className="min-w-0 border-l border-[#DDF0E4] px-3 py-3">
                  <p className={cn("truncate text-[11px]", GRIS)}>Municipalidad</p>
                  <p className="text-[15px] font-semibold text-[#0A7A52] tabular-nums">−{clp(ejemplo.subsidio)}</p>
                </div>
                <div className="min-w-0 border-l border-[#DDF0E4] px-3 py-3">
                  <p className={cn("truncate text-[11px]", GRIS)}>Paga el socio</p>
                  <p className="text-[15px] font-semibold tabular-nums">{clp(ejemplo.paga)}</p>
                </div>
              </div>
            ) : !socio ? (
              <p className={cn("rounded-xl bg-[#F7F6FB] px-4 py-3 text-xs", GRIS)}>Elige un socio para ver cuánto bajaría su boleta.</p>
            ) : null}
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold">Vigencia</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={cn("text-xs", GRIS)}>Desde</span>
                <Input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} className={cn("mt-1", CAMPO)} />
              </label>
              <label className="block">
                <span className={cn("text-xs", GRIS)}>Hasta</span>
                <Input type="month" min={desde} value={hasta} onChange={(e) => setHasta(e.target.value)} className={cn("mt-1", CAMPO, !hastaOk && "border-[#E5484D]")} />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  [6, "6 meses"],
                  [12, "1 año"],
                  [36, "3 años"],
                ] as const
              ).map(([n, t]) => (
                <button key={n} type="button" aria-pressed={meses === n} disabled={!desde} onClick={() => setHasta(sumarMeses(desde, n - 1))} className={cn("h-8 rounded-full px-3 text-xs", pastilla(meses === n))}>
                  {t}
                </button>
              ))}
              <button type="button" aria-pressed={!hasta} onClick={() => setHasta("")} className={cn("h-8 rounded-full px-3 text-xs", pastilla(!hasta))}>
                Sin término
              </button>
              {!hastaOk && <span className="text-xs font-medium text-[#A32020]">El término es anterior al inicio</span>}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold">
              Respaldo <span className={cn("font-normal", GRIS)}>· opcional</span>
            </p>
            <div className="relative">
              <FileText className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8F8CA3]" aria-hidden />
              <Input aria-label="Número de decreto" value={decreto} maxLength={60} onChange={(e) => setDecreto(e.target.value)} placeholder="N° de decreto, ej.: Decreto 1.204/2026" className={cn(CAMPO, "pl-9")} />
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#F0EEF6] bg-[#FAFAFD] px-6 py-4">
          <p className={cn("hidden min-w-0 flex-1 truncate text-xs sm:block", GRIS)}>{socio && ejemplo ? `${socio.nombre.split(" ")[0]} pagaría ${clp(ejemplo.paga)} en vez de ${clp(ejemplo.total)}` : ""}</p>
          <Button variant="ghost" onClick={onCerrar} className="h-11 rounded-xl font-semibold text-[#46435C]">
            Cancelar
          </Button>
          <Button disabled={!valido || pendiente} onClick={guardar} className="h-11 rounded-xl px-6 font-semibold">
            {pendiente && <Loader2 className="animate-spin" />}
            {base ? "Guardar cambios" : "Agregar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
