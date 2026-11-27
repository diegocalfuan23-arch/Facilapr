"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { consultarFicha } from "@/app/panel/socios/consulta-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatearPeriodo } from "@/lib/boletas";
import type { FichaSocio } from "@/lib/ficha-socio";
import { formatearRut } from "@/lib/formato";
import { cn } from "@/lib/utils";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const dia = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" });
const mesCorto = (periodo: string) => formatearPeriodo(periodo).slice(0, 3);

type Pestana = "boletas" | "pagos" | "solicitudes";

/** La ficha de una persona: cuánto debe, cuánto consume y lo que ha pagado y pedido. */
export function FichaSocioDialog({
  socio,
  onCerrar,
}: {
  socio: { id: string; nombre: string; rut: string | null };
  onCerrar: () => void;
}) {
  const { data, isPending, isError } = useQuery({ queryKey: ["ficha-socio", socio.id], queryFn: () => consultarFicha(socio.id) });

  const numeros = data?.arranques.map((a) => a.numero).filter(Boolean) ?? [];
  const detalle = [
    socio.rut ? formatearRut(socio.rut) : null,
    data && data.arranques.length > 1 ? `${data.arranques.length} arranques` : numeros[0] ? `Arranque ${numeros[0]}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] gap-6 overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="pr-8">{socio.nombre}</DialogTitle>
          {detalle && <p className="text-sm text-muted-foreground tabular-nums">{detalle}</p>}
        </DialogHeader>

        {isPending ? (
          <Loader2 className="mx-auto my-8 size-6 animate-spin text-muted-foreground" aria-label="Cargando" />
        ) : isError || !data ? (
          <p role="alert" className="py-8 text-center text-sm text-destructive">
            No se pudo abrir la ficha.
          </p>
        ) : (
          <Contenido ficha={data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Contenido({ ficha }: { ficha: FichaSocio }) {
  const [pestana, setPestana] = useState<Pestana>("boletas");
  const varios = ficha.arranques.length > 1;
  const maximo = Math.max(1, ...ficha.consumo.map((c) => c.m3));

  const pestanas: [Pestana, string][] = [
    ["boletas", "Boletas"],
    ["pagos", "Pagos"],
    ["solicitudes", "Solicitudes"],
  ];

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-[32px] leading-none font-bold tabular-nums">{ficha.deuda > 0 ? clp.format(ficha.deuda) : "Al día"}</p>
        {ficha.deuda > 0 && (
          <p className="text-sm text-muted-foreground">
            debe en {ficha.boletasPendientes} {ficha.boletasPendientes === 1 ? "boleta" : "boletas"}
          </p>
        )}
      </div>

      {ficha.consumo.length > 0 && (
        <figure>
          <figcaption className="mb-2 text-sm font-medium">Consumo (m³)</figcaption>
          <ul className="flex items-end gap-1">
            {ficha.consumo.map((c) => (
              <li key={c.periodo} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${formatearPeriodo(c.periodo)}: ${c.m3} m³`}>
                <span className="text-[11px] text-muted-foreground tabular-nums">{c.m3}</span>
                <span className="flex h-16 w-full max-w-8 items-end">
                  <span className="w-full rounded-t bg-primary" style={{ height: `${Math.max((c.m3 / maximo) * 100, 3)}%` }} />
                </span>
                <span className="text-[11px] text-muted-foreground">{mesCorto(c.periodo)}</span>
              </li>
            ))}
          </ul>
        </figure>
      )}

      <div>
        <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1">
          {pestanas.map(([id, texto]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pestana === id}
              onClick={() => setPestana(id)}
              className={cn("h-8 flex-1 rounded-md text-sm font-medium", pestana === id ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              {texto}
            </button>
          ))}
        </div>

        {pestana === "boletas" && (
          <Lista
            vacia="Sin boletas"
            filas={ficha.boletas.map((b) => ({
              id: b.id,
              titulo: formatearPeriodo(b.periodo),
              detalle: [varios ? b.arranque : null, b.m3 !== null ? `${b.m3} m³` : null].filter(Boolean).join(" · "),
              valor: clp.format(b.total),
              estado: b.saldo === 0 ? "Pagada" : b.saldo < b.total ? `Debe ${clp.format(b.saldo)}` : "Pendiente",
              pendiente: b.saldo > 0,
            }))}
          />
        )}
        {pestana === "pagos" && (
          <Lista
            vacia="Sin pagos"
            filas={ficha.pagos.map((p) => ({ id: p.id, titulo: p.que, detalle: `${dia.format(new Date(p.fecha))} · ${p.medio}`, valor: clp.format(p.monto) }))}
          />
        )}
        {pestana === "solicitudes" && (
          <Lista
            vacia="Sin solicitudes"
            filas={ficha.solicitudes.map((s) => ({
              id: s.id,
              titulo: s.tipo,
              detalle: [dia.format(new Date(s.fecha)), varios ? s.arranque : null].filter(Boolean).join(" · "),
              valor: s.estado,
            }))}
          />
        )}
      </div>
    </>
  );
}

function Lista({
  filas,
  vacia,
}: {
  filas: { id: string; titulo: string; detalle: string; valor: string; estado?: string; pendiente?: boolean }[];
  vacia: string;
}) {
  if (filas.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{vacia}</p>;
  return (
    <ul className="mt-2 divide-y divide-border/60">
      {filas.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-4 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{f.titulo}</p>
            {f.detalle && <p className="truncate text-xs text-muted-foreground tabular-nums">{f.detalle}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm tabular-nums">{f.valor}</p>
            {f.estado && <p className={cn("text-xs", f.pendiente ? "font-medium text-destructive" : "text-muted-foreground")}>{f.estado}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
