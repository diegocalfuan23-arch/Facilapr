"use client";

import { useMemo, useState } from "react";
import { FileDown, Plus, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatearPeriodo } from "@/lib/boletas";
import { formatearRut } from "@/lib/formato";
import { MEDIOS_PAGO, textoMedioPago } from "@/lib/pagos";
import { NuevoPagoDialog, type BoletaPendiente } from "@/components/panel/nuevo-pago-dialog";
import type { OpcionSocio } from "@/components/panel/socio-buscador";
import type { DatosComiteWhatsApp } from "@/lib/whatsapp";

export type PagoFila = {
  id: string;
  monto: number;
  /** ISO. */
  fecha: string;
  medio: string;
  referencia: string | null;
  periodo: string;
  socioNombre: string;
  socioRut: string | null;
  comprobanteUrl: string;
};

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const fechaLarga = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const POR_PAGINA = 25;

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Todos los pagos que ha registrado el comité, con búsqueda y filtro por medio. */
export function PagosTabla({
  pagos,
  socios,
  boletasPendientes,
  comite,
}: {
  pagos: PagoFila[];
  socios: OpcionSocio[];
  boletasPendientes: BoletaPendiente[];
  comite: DatosComiteWhatsApp;
}) {
  const [registrando, setRegistrando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [medio, setMedio] = useState<string>("todos");
  const [visibles, setVisibles] = useState(POR_PAGINA);

  const ahora = new Date();
  const delMes = pagos.filter((p) => {
    const f = new Date(p.fecha);
    return f.getFullYear() === ahora.getFullYear() && f.getMonth() === ahora.getMonth();
  });
  const totalMes = delMes.reduce((acc, p) => acc + p.monto, 0);

  const filtrados = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return pagos.filter((p) => {
      if (medio !== "todos" && p.medio !== medio) return false;
      if (!q) return true;
      return sinTildes(
        `${p.socioNombre} ${p.socioRut ?? ""} ${p.referencia ?? ""} ${formatearPeriodo(p.periodo)}`
      ).includes(q);
    });
  }, [pagos, busqueda, medio]);

  const totalFiltrado = filtrados.reduce((acc, p) => acc + p.monto, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight">Pagos</h1>
          <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
            Todo lo que han pagado tus socios, con su comprobante.
          </p>
        </div>
        <Button onClick={() => setRegistrando(true)}>
          <Plus />
          Registrar pago
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {[
          { etiqueta: "Recaudado este mes", valor: clp.format(totalMes) },
          { etiqueta: "Pagos este mes", valor: String(delMes.length) },
        ].map((k) => (
          <div key={k.etiqueta} className="rounded-xl border border-border bg-card p-4">
            <div className="text-[0.8rem] text-muted-foreground">{k.etiqueta}</div>
            <div className="mt-1 text-[1.4rem] font-semibold tabular-nums">{k.valor}</div>
          </div>
        ))}
      </div>

      {pagos.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted">
            <Wallet className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-[1rem] font-semibold">Aún no hay pagos registrados</h2>
          <p className="mt-2 max-w-[48ch] text-[0.92rem] leading-relaxed text-muted-foreground">
            Cuando un socio pague, toca “Registrar pago”, busca al socio y elige su
            boleta. Aquí quedará el historial y el comprobante para enviarle.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center gap-3 p-3 sm:p-5">
            <div className="relative w-full sm:min-w-60 sm:flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setVisibles(POR_PAGINA);
                }}
                placeholder="Buscar por socio, RUT, período o N.º de operación…"
                aria-label="Buscar pagos"
                className="h-10 border-transparent bg-muted/60 pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[{ valor: "todos", texto: "Todos" }, ...MEDIOS_PAGO].map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  onClick={() => {
                    setMedio(m.valor);
                    setVisibles(POR_PAGINA);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[0.8rem] font-medium transition-colors",
                    medio === m.valor
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m.texto}
                </button>
              ))}
            </div>
          </div>

          {filtrados.length === 0 ? (
            <p className="border-t border-border/60 px-5 py-10 text-center text-[0.9rem] text-muted-foreground">
              No hay pagos con ese filtro.
            </p>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-border/60 border-t border-border/60">
                {filtrados.slice(0, visibles).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-3 py-3.5 sm:px-5"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.socioNombre}</div>
                      <div className="truncate text-[0.8rem] text-muted-foreground">
                        {fechaLarga.format(new Date(p.fecha))} · {textoMedioPago(p.medio)} ·{" "}
                        {formatearPeriodo(p.periodo)}
                        {p.socioRut ? ` · ${formatearRut(p.socioRut)}` : ""}
                        {p.referencia ? ` · Op. ${p.referencia}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-[0.95rem] font-semibold text-forest tabular-nums">
                        {clp.format(p.monto)}
                      </span>
                      <a
                        href={p.comprobanteUrl}
                        target="_blank"
                        rel="noopener"
                        aria-label={`Comprobante de ${p.socioNombre}`}
                        title="Ver comprobante"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <FileDown className="size-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-3 py-3 text-[0.82rem] text-muted-foreground sm:px-5">
                <span>
                  {filtrados.length} pago{filtrados.length === 1 ? "" : "s"} ·{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {clp.format(totalFiltrado)}
                  </span>
                </span>
                {visibles < filtrados.length && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibles((v) => v + POR_PAGINA)}
                  >
                    Ver más
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {registrando && (
        <NuevoPagoDialog
          socios={socios}
          boletas={boletasPendientes}
          comite={comite}
          onCerrar={() => setRegistrando(false)}
        />
      )}
    </div>
  );
}
