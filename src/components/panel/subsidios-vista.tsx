"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { aplicarSubsidios, guardarSubsidio, quitarSubsidio, type ResultadoSubsidio } from "@/app/panel/subsidios/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SocioBuscador, type OpcionSocio } from "@/components/panel/socio-buscador";
import { formatearPeriodo, textoSubsidio, type ReglaSubsidio } from "@/lib/boletas";
import { formatearRut } from "@/lib/formato";

export type Beneficiario = ReglaSubsidio & {
  id: string;
  socioId: string;
  nombre: string;
  rut: string | null;
  numeroCliente: string | null;
  desde: string;
  hasta: string | null;
  decreto: string | null;
  boleta: { consumoM3: number | null; montoTotal: number; montoSubsidio: number } | null;
  /** Boletas vencidas sin pagar: con deuda se puede perder el beneficio. */
  vencidas: number;
};

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/** Una celda para Excel: entre comillas y sin que un texto se lea como fórmula. */
const celda = (v: string | number | null) => {
  const t = String(v ?? "");
  return `"${(typeof v === "string" && /^[=+\-@]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
};

export function SubsidiosVista({
  comite,
  periodo,
  socios,
  beneficiarios,
}: {
  comite: string;
  periodo: string;
  socios: OpcionSocio[];
  beneficiarios: Beneficiario[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<Beneficiario | "nuevo" | null>(null);
  const [quitando, setQuitando] = useState<Beneficiario | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const conSubsidio = beneficiarios.filter((b) => (b.boleta?.montoSubsidio ?? 0) > 0);
  const total = conSubsidio.reduce((s, b) => s + b.boleta!.montoSubsidio, 0);

  function descargar() {
    const cabecera = ["N°", "Nombre", "RUT", "Decreto", "Mes", "Descuento", "Consumo m3", "Valor boleta", "Subsidio", "Paga el socio"];
    const filas = conSubsidio.map((b) => [
      b.numeroCliente,
      b.nombre,
      b.rut ? formatearRut(b.rut) : "",
      b.decreto,
      periodo,
      textoSubsidio(b),
      b.boleta!.consumoM3,
      b.boleta!.montoTotal + b.boleta!.montoSubsidio,
      b.boleta!.montoSubsidio,
      b.boleta!.montoTotal,
    ]);
    const csv = [cabecera, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `Subsidios ${periodo} ${comite}.csv`.replace(/[\\/:*?"<>|]/g, "-");
    enlace.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Subsidios</h1>
        <Button onClick={() => setEditando("nuevo")} disabled={socios.length === 0}>
          <Plus />
          Agregar beneficiario
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Por cobrar a la municipalidad · {formatearPeriodo(periodo)}</p>
          <p className="text-[32px] leading-none font-bold tabular-nums">{clp.format(total)}</p>
          <p className="text-sm text-muted-foreground">
            {conSubsidio.length} de {beneficiarios.length} con subsidio en su boleta
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="month"
            aria-label="Mes"
            value={periodo}
            onChange={(e) => e.target.value && router.push(`/panel/subsidios?mes=${e.target.value}`)}
            className="w-auto"
          />
          <Button variant="outline" onClick={() => setAplicando(true)} disabled={beneficiarios.length === 0}>
            <RefreshCw />
            Aplicar al mes
          </Button>
          <Button variant="outline" onClick={descargar} disabled={conSubsidio.length === 0}>
            <Download />
            Descargar planilla
          </Button>
        </div>
      </div>

      {beneficiarios.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-32 text-center text-sm text-muted-foreground">Sin beneficiarios todavía.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="p-4 font-medium">Socio</th>
                <th className="p-4 font-medium">Subsidio</th>
                <th className="p-4 font-medium">Vigencia</th>
                <th className="p-4 text-right font-medium">Consumo</th>
                <th className="p-4 text-right font-medium">Subsidiado</th>
                <th className="p-4 text-right font-medium">Paga</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {beneficiarios.map((b) => (
                <tr key={b.id} className="border-b border-border/60 last:border-b-0">
                  <td className="p-4">
                    <p className="font-medium">{b.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {[b.numeroCliente ? `N° ${b.numeroCliente}` : null, b.rut ? formatearRut(b.rut) : null, b.decreto].filter(Boolean).join(" · ")}
                    </p>
                    {b.vencidas > 0 && (
                      <p className="mt-1 text-xs font-medium text-destructive">
                        {b.vencidas} {b.vencidas === 1 ? "boleta vencida" : "boletas vencidas"}
                      </p>
                    )}
                  </td>
                  <td className="p-4 tabular-nums">{textoSubsidio(b)}</td>
                  <td className="p-4">
                    {formatearPeriodo(b.desde)}
                    {b.hasta ? ` a ${formatearPeriodo(b.hasta)}` : ""}
                  </td>
                  <td className="p-4 text-right tabular-nums">{b.boleta?.consumoM3 != null ? `${b.boleta.consumoM3} m³` : "—"}</td>
                  <td className="p-4 text-right font-semibold tabular-nums">{b.boleta ? clp.format(b.boleta.montoSubsidio) : "—"}</td>
                  <td className="p-4 text-right tabular-nums">{b.boleta ? clp.format(b.boleta.montoTotal) : "—"}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Editar el subsidio de ${b.nombre}`} onClick={() => setEditando(b)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Quitar el subsidio de ${b.nombre}`} onClick={() => setQuitando(b)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <SubsidioDialog
          key={editando === "nuevo" ? "nuevo" : editando.id}
          beneficiario={editando === "nuevo" ? null : editando}
          socios={socios}
          periodo={periodo}
          onCerrar={() => setEditando(null)}
        />
      )}

      <Dialog open={!!quitando} onOpenChange={(v) => !v && setQuitando(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Quitar este subsidio?</DialogTitle>
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
                  if (r.ok) toast.success("Subsidio quitado");
                  else toast.error(r.error);
                  setQuitando(null);
                })
              }
            >
              Quitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aplicando} onOpenChange={setAplicando}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Aplicar a {formatearPeriodo(periodo)}</DialogTitle>
            <DialogDescription>
              Cambia el monto de las boletas de ese mes que tienen lecturas y no tienen pagos. Si ya las enviaste, vuelve a enviarlas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAplicando(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await aplicarSubsidios(periodo);
                  if (r.ok) toast.success(r.cambiadas === 1 ? "1 boleta actualizada" : `${r.cambiadas} boletas actualizadas`);
                  else toast.error(r.error);
                  setAplicando(false);
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

function SubsidioDialog({
  beneficiario,
  socios,
  periodo,
  onCerrar,
}: {
  beneficiario: Beneficiario | null;
  socios: OpcionSocio[];
  periodo: string;
  onCerrar: () => void;
}) {
  const [tipo, setTipo] = useState<ReglaSubsidio["tipo"]>(beneficiario?.tipo ?? "PORCENTAJE");
  const [estado, accion, pendiente] = useActionState<ResultadoSubsidio | null, FormData>(async (prev, formData) => {
    const r = await guardarSubsidio(prev, formData);
    if (r.ok) {
      toast.success("Subsidio guardado");
      onCerrar();
    }
    return r;
  }, null);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{beneficiario ? "Editar subsidio" : "Agregar beneficiario"}</DialogTitle>
          <DialogDescription>{beneficiario ? beneficiario.nombre : "El descuento que tiene en su boleta."}</DialogDescription>
        </DialogHeader>

        <form action={accion} className="flex flex-col gap-4">
          {beneficiario ? <input type="hidden" name="socioId" value={beneficiario.socioId} /> : <SocioBuscador socios={socios} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="tipo">Tipo de descuento</Label>
              <select
                id="tipo"
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as ReglaSubsidio["tipo"])}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="PORCENTAJE">Porcentaje</option>
                <option value="MONTO">Monto en pesos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="valor">{tipo === "MONTO" ? "Monto ($)" : "Porcentaje (%)"}</Label>
              <Input
                key={tipo}
                id="valor"
                name="valor"
                inputMode="numeric"
                defaultValue={beneficiario?.tipo === tipo ? beneficiario.valor : ""}
                placeholder={tipo === "MONTO" ? "5000" : "50"}
                required
              />
            </div>
            {tipo === "PORCENTAJE" && (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label htmlFor="topeM3">Tope en m³ · opcional</Label>
                <Input id="topeM3" name="topeM3" inputMode="numeric" defaultValue={beneficiario?.topeM3 ?? ""} placeholder="Sobre el total" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" name="desde" type="month" defaultValue={beneficiario?.desde ?? periodo} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="hasta">Hasta · opcional</Label>
              <Input id="hasta" name="hasta" type="month" defaultValue={beneficiario?.hasta ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="decreto">Decreto · opcional</Label>
            <Input id="decreto" name="decreto" maxLength={60} defaultValue={beneficiario?.decreto ?? ""} />
          </div>

          {estado && !estado.ok && <p className="text-sm text-destructive">{estado.error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
