"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileDown, Handshake, Loader2, MessageCircle, Plus } from "lucide-react";
import {
  cancelarRepactacion,
  crearRepactacion,
  registrarCuotaRepactacion,
} from "@/app/panel/pagos/repactaciones-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SocioBuscador, type OpcionSocio } from "@/components/panel/socio-buscador";
import { MEDIOS_PAGO } from "@/lib/pagos";
import { normalizarTelefono } from "@/lib/formato";
import { calendarioCuotas, seguimientoRepactacion } from "@/lib/repactaciones";
import {
  enlaceWhatsApp,
  mensajeComprobanteCuota,
  telefonoValidoParaWhatsApp,
  type DatosComiteWhatsApp,
} from "@/lib/whatsapp";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const fecha = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" });

export type RepactacionFila = {
  id: string;
  socioNombre: string;
  socioTelefono: string | null;
  deudaTotal: number;
  cuotas: number;
  /** ISO. */
  primerVencimiento: string;
  estado: string;
  nota: string | null;
  /** Lo que el socio ya pagó de este acuerdo. */
  pagado: number;
};

export type SocioConDeuda = OpcionSocio & { telefono: string | null; deuda: number };

/** Los acuerdos de pago con socios morosos: crearlos, seguir cada cuota y cancelarlos. */
export function RepactacionesPanel({
  repactaciones,
  sociosConDeuda,
  comite,
}: {
  repactaciones: RepactacionFila[];
  sociosConDeuda: SocioConDeuda[];
  comite: DatosComiteWhatsApp;
}) {
  const [creando, setCreando] = useState(false);
  const [pagando, setPagando] = useState<RepactacionFila | null>(null);
  const [verTerminadas, setVerTerminadas] = useState(false);
  const [cancelando, iniciar] = useTransition();

  const activas = repactaciones.filter((r) => r.estado === "ACTIVA");
  const terminadas = repactaciones.filter((r) => r.estado !== "ACTIVA");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.05rem] font-semibold">Repactaciones</h2>
          <p className="mt-0.5 text-[0.88rem] text-muted-foreground">
            Acuerdos para que un socio moroso pague su deuda en cuotas.
          </p>
        </div>
        <Button variant="outline" onClick={() => setCreando(true)}>
          <Plus />
          Nueva repactación
        </Button>
      </div>

      {activas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-[0.88rem] text-muted-foreground">
          No hay acuerdos activos. Cuando un socio moroso quiera pagar en cuotas, crea uno aquí.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {activas.map((r) => (
            <TarjetaAcuerdo
              key={r.id}
              r={r}
              onCuota={() => setPagando(r)}
              onCancelar={() => {
                if (!window.confirm(`¿Cancelar el acuerdo de ${r.socioNombre}? Los pagos que ya hizo se mantienen.`)) return;
                iniciar(async () => {
                  const res = await cancelarRepactacion(r.id);
                  if (res.ok) toast.success("Acuerdo cancelado");
                  else toast.error(res.error);
                });
              }}
              cancelando={cancelando}
            />
          ))}
        </div>
      )}

      {terminadas.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setVerTerminadas((v) => !v)}
            className="self-start text-[0.82rem] font-medium text-primary hover:underline"
          >
            {verTerminadas ? "Ocultar" : "Ver"} {terminadas.length} acuerdo{terminadas.length === 1 ? "" : "s"} terminado
            {terminadas.length === 1 ? "" : "s"}
          </button>
          {verTerminadas && (
            <ul className="flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-card">
              {terminadas.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[0.86rem]">
                  <span className="min-w-0 truncate font-medium">{r.socioNombre}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {clp.format(r.pagado)} de {clp.format(r.deudaTotal)} ·{" "}
                    {r.estado === "CUMPLIDA" ? "cumplido" : "cancelado"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {creando && <NuevaRepactacionDialog socios={sociosConDeuda} onCerrar={() => setCreando(false)} />}
      {pagando && <CuotaDialog r={pagando} comite={comite} onCerrar={() => setPagando(null)} />}
    </section>
  );
}

function TarjetaAcuerdo({
  r,
  onCuota,
  onCancelar,
  cancelando,
}: {
  r: RepactacionFila;
  onCuota: () => void;
  onCancelar: () => void;
  cancelando: boolean;
}) {
  const s = seguimientoRepactacion(
    { deudaTotal: r.deudaTotal, cuotas: r.cuotas, primerVencimiento: new Date(r.primerVencimiento) },
    r.pagado
  );
  const porcentaje = Math.min(100, Math.round((r.pagado / r.deudaTotal) * 100));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{r.socioNombre}</div>
          <div className="text-[0.8rem] text-muted-foreground">
            {s.cuotasPagadas} de {r.cuotas} cuotas pagadas
          </div>
        </div>
        {s.atraso > 0 ? (
          <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[0.75rem] font-medium text-destructive">
            Atrasado {clp.format(s.atraso)}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-forest/10 px-2.5 py-0.5 text-[0.75rem] font-medium text-forest">
            Al día
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Progress value={porcentaje} />
        <div className="flex justify-between text-[0.8rem] text-muted-foreground tabular-nums">
          <span>{clp.format(r.pagado)} pagado</span>
          <span>faltan {clp.format(s.restante)}</span>
        </div>
      </div>

      {s.proxima && (
        <div className="text-[0.82rem] text-muted-foreground">
          Próxima: cuota {s.proxima.n} · {fecha.format(s.proxima.vencimiento)} ·{" "}
          <span className="font-medium text-foreground tabular-nums">{clp.format(s.proxima.pendiente)}</span>
        </div>
      )}
      {r.nota && <p className="text-[0.8rem] text-muted-foreground">{r.nota}</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onCuota}>
          Registrar pago de cuota
        </Button>
        <Button size="sm" variant="outline" onClick={onCancelar} disabled={cancelando}>
          Cancelar acuerdo
        </Button>
      </div>
    </div>
  );
}

/** Una fecha de hoy en un mes más, como propuesta para la primera cuota. */
function proximoMes() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function NuevaRepactacionDialog({ socios, onCerrar }: { socios: SocioConDeuda[]; onCerrar: () => void }) {
  const [socio, setSocio] = useState<SocioConDeuda | null>(null);
  const [cuotas, setCuotas] = useState("3");
  const [primera, setPrimera] = useState(proximoMes);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const hoy = new Date().toISOString().slice(0, 10);
  const n = Number(cuotas);
  const calendario = useMemo(() => {
    const f = new Date(`${primera}T12:00:00`);
    if (!socio || !Number.isInteger(n) || n < 2 || n > 60 || Number.isNaN(f.getTime()) || socio.deuda < n) return [];
    return calendarioCuotas(socio.deuda, n, f);
  }, [socio, n, primera]);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Nueva repactación</DialogTitle>
          <DialogDescription>
            Se toma la deuda vencida del socio de hoy y se reparte en cuotas mensuales.
          </DialogDescription>
        </DialogHeader>

        {socios.length === 0 ? (
          <p className="rounded-lg bg-muted/60 px-3.5 py-3 text-[0.9rem] text-muted-foreground">
            No hay socios con deuda vencida que no tengan ya un acuerdo.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <SocioBuscador
              socios={socios}
              onElegir={(s) => setSocio(s ? (socios.find((x) => x.id === s.id) ?? null) : null)}
            />
            {socio && (
              <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-[0.88rem]">
                Deuda vencida: <strong className="tabular-nums">{clp.format(socio.deuda)}</strong>
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rep-cuotas">En cuántas cuotas</Label>
              <div className="flex flex-wrap items-center gap-2">
                {[3, 6, 12].map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={n === c ? "default" : "outline"}
                    onClick={() => setCuotas(String(c))}
                  >
                    {c}
                  </Button>
                ))}
                <Input
                  id="rep-cuotas"
                  value={cuotas}
                  onChange={(e) => setCuotas(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  className="w-20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rep-primera">Vence la primera cuota</Label>
              <Input id="rep-primera" type="date" min={hoy} value={primera} onChange={(e) => setPrimera(e.target.value)} />
              <span className="text-[0.8rem] text-muted-foreground">Las siguientes vencen el mismo día de cada mes.</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rep-nota">Nota (opcional)</Label>
              <Input
                id="rep-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej.: acordado en la oficina"
                maxLength={300}
              />
            </div>

            {calendario.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="text-[0.78rem] font-medium text-muted-foreground">Así quedarían las cuotas</div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/60">
                  {calendario.map((c) => (
                    <div key={c.n} className="flex justify-between px-3 py-1.5 text-[0.84rem]">
                      <span>
                        Cuota {c.n} · {fecha.format(c.vencimiento)}
                      </span>
                      <span className="font-medium tabular-nums">{clp.format(c.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-[0.88rem] text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          {socios.length > 0 && (
            <Button
              disabled={pendiente || !socio || calendario.length === 0}
              onClick={() =>
                iniciar(async () => {
                  if (!socio) return;
                  setError(null);
                  const r = await crearRepactacion(socio.id, {
                    cuotas: n,
                    primerVencimiento: primera,
                    nota: nota.trim() || undefined,
                  });
                  if (r.ok) {
                    toast.success("Acuerdo creado");
                    onCerrar();
                  } else {
                    setError(r.error);
                    toast.error(r.error);
                  }
                })
              }
            >
              {pendiente && <Loader2 className="animate-spin" />}
              <Handshake />
              Crear acuerdo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CuotaDialog({ r, comite, onCerrar }: { r: RepactacionFila; comite: DatosComiteWhatsApp; onCerrar: () => void }) {
  const s = seguimientoRepactacion(
    { deudaTotal: r.deudaTotal, cuotas: r.cuotas, primerVencimiento: new Date(r.primerVencimiento) },
    r.pagado
  );
  const hoy = new Date().toISOString().slice(0, 10);
  const [monto, setMonto] = useState(String(s.proxima?.pendiente ?? s.restante));
  const [fechaPago, setFechaPago] = useState(hoy);
  const [medio, setMedio] = useState<string>("EFECTIVO");
  const [referencia, setReferencia] = useState("");
  const [otraPersona, setOtraPersona] = useState(false);
  const [pagador, setPagador] = useState("");
  const [telPagador, setTelPagador] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [registrado, setRegistrado] = useState<{
    monto: number;
    comprobanteUrl: string;
    restante: number;
    pagadoPor: string | null;
    pagadoPorTelefono: string | null;
  } | null>(null);

  const telefonoDestino = registrado?.pagadoPorTelefono ?? r.socioTelefono;
  const puedeWhatsApp = telefonoValidoParaWhatsApp(telefonoDestino);

  function enviarComprobante() {
    if (!registrado || !telefonoDestino) return;
    window.open(
      enlaceWhatsApp(
        telefonoDestino,
        mensajeComprobanteCuota(comite.nombre, {
          socioNombre: r.socioNombre,
          monto: registrado.monto,
          restante: registrado.restante,
          comprobanteUrl: registrado.comprobanteUrl,
          pagadoPor: registrado.pagadoPor,
        })
      ),
      "_blank",
      "noopener"
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{registrado ? "Pago registrado" : "Pago de cuota"}</DialogTitle>
          <DialogDescription>
            {r.socioNombre} · faltan {clp.format(s.restante)} del acuerdo
          </DialogDescription>
        </DialogHeader>

        {registrado ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg bg-forest/10 px-3.5 py-3 text-[0.9rem] text-forest">
              Se registró un pago de {clp.format(registrado.monto)}.{" "}
              {registrado.restante > 0
                ? `Faltan ${clp.format(registrado.restante)} del acuerdo.`
                : "El acuerdo quedó cumplido."}
            </p>
            {puedeWhatsApp ? (
              <Button onClick={enviarComprobante} className="h-10">
                <MessageCircle />
                Enviar comprobante por WhatsApp
              </Button>
            ) : (
              <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-[0.84rem] text-muted-foreground">
                Este socio no tiene un teléfono válido para WhatsApp. Puedes abrir el comprobante y compartirlo por otro
                medio.
              </p>
            )}
            <Button
              variant="outline"
              className="h-10"
              nativeButton={false}
              render={<a href={registrado.comprobanteUrl} target="_blank" rel="noopener" />}
            >
              <FileDown />
              Ver comprobante
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cuota-monto">Monto que pagó</Label>
              <Input
                id="cuota-monto"
                value={monto}
                onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                autoFocus
              />
              <span className="text-[0.8rem] text-muted-foreground">
                {s.proxima
                  ? `Cuota ${s.proxima.n}: faltan ${clp.format(s.proxima.pendiente)}. `
                  : ""}
                Se aplica a sus boletas más antiguas.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Medio de pago</Label>
              <div className="flex flex-wrap gap-2">
                {MEDIOS_PAGO.map((m) => (
                  <Button
                    key={m.valor}
                    type="button"
                    size="sm"
                    variant={medio === m.valor ? "default" : "outline"}
                    onClick={() => setMedio(m.valor)}
                  >
                    {m.texto}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-[0.88rem]">
                <input type="checkbox" checked={otraPersona} onChange={(e) => setOtraPersona(e.target.checked)} />
                Pagó otra persona (no es el titular)
              </label>
              {otraPersona && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cuota-pagador">Quién pagó</Label>
                    <Input
                      id="cuota-pagador"
                      value={pagador}
                      onChange={(e) => setPagador(e.target.value)}
                      placeholder="Nombre"
                      maxLength={120}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cuota-tel">Su teléfono</Label>
                    <Input
                      id="cuota-tel"
                      value={telPagador}
                      onChange={(e) => setTelPagador(e.target.value)}
                      placeholder="Opcional"
                      maxLength={30}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cuota-fecha">Fecha</Label>
                <Input
                  id="cuota-fecha"
                  type="date"
                  value={fechaPago}
                  max={hoy}
                  onChange={(e) => setFechaPago(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cuota-ref">N.º de operación</Label>
                <Input
                  id="cuota-ref"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Opcional"
                  maxLength={80}
                />
              </div>
            </div>

            {error && <p className="text-[0.88rem] text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            {registrado ? "Listo" : "Cancelar"}
          </Button>
          {!registrado && (
            <Button
              disabled={pendiente || !Number(monto)}
              onClick={() =>
                iniciar(async () => {
                  setError(null);
                  const res = await registrarCuotaRepactacion(r.id, {
                    monto: Number(monto || 0),
                    fecha: fechaPago,
                    medio,
                    referencia: referencia.trim() || undefined,
                    pagadoPor: otraPersona ? pagador.trim() || undefined : undefined,
                    pagadoPorTelefono: otraPersona ? telPagador.trim() || undefined : undefined,
                  });
                  if (res.ok) {
                    toast.success("Pago registrado");
                    setRegistrado({
                      monto: Number(monto),
                      comprobanteUrl: res.comprobanteUrl,
                      restante: res.restante,
                      pagadoPor: otraPersona ? pagador.trim() || null : null,
                      pagadoPorTelefono:
                        otraPersona && telPagador.trim() ? normalizarTelefono(telPagador.trim()) : null,
                    });
                  } else {
                    setError(res.error);
                    toast.error(res.error);
                  }
                })
              }
            >
              {pendiente && <Loader2 className="animate-spin" />}
              Registrar pago
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
