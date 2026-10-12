"use client";

import { useState } from "react";
import { Camera, ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIPOS_ORDEN } from "@/lib/ordenes";
import type { OrdenFila } from "@/lib/ordenes-datos";
import { EvidenciaDialog } from "@/components/panel/evidencia-dialog";
import { NuevaOrdenDialog } from "@/components/panel/nueva-orden-dialog";
import type { OpcionSocio } from "@/components/panel/socio-buscador";

const fecha = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });

/**
 * Lo que el técnico tiene que hacer en terreno (o el presidente, si sale él):
 * cada orden aprobada por la directiva, con el botón para subir la foto. Desde
 * aquí también se puede pedir una reposición o una reparación, que la directiva
 * aprueba antes de que alguien vaya.
 */
export function OrdenesTecnico({
  pendientes,
  esperandoAlta,
  socios,
}: {
  pendientes: OrdenFila[];
  esperandoAlta: number;
  socios: OpcionSocio[];
}) {
  const [ejecutando, setEjecutando] = useState<OrdenFila | null>(null);
  const [pidiendo, setPidiendo] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight">Órdenes</h1>
          <p className="mt-0.5 text-[0.9rem] text-muted-foreground">
            Lo que la directiva te pidió hacer en terreno.
          </p>
        </div>
        <Button variant="outline" onClick={() => setPidiendo(true)}>
          <Plus />
          Pedir reposición o reparación
        </Button>
      </div>

      {esperandoAlta > 0 && (
        <p className="rounded-lg bg-forest/10 px-3.5 py-2.5 text-[0.86rem] text-forest">
          {esperandoAlta} {esperandoAlta === 1 ? "orden ya tiene" : "órdenes ya tienen"} tu foto y espera que la directiva la dé de alta.
        </p>
      )}

      {pendientes.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-[1rem] font-semibold">No tienes órdenes pendientes</h2>
          <p className="mt-2 max-w-[44ch] text-[0.9rem] leading-relaxed text-muted-foreground">
            Cuando la directiva ordene un corte, una reposición o una reparación, aparecerá aquí.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {pendientes.map((o) => (
            <li key={o.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{o.socioNombre}</div>
                  {o.socioDireccion && (
                    <div className="text-[0.84rem] text-muted-foreground">{o.socioDireccion}</div>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[0.76rem] font-semibold text-primary">
                  {TIPOS_ORDEN[o.tipo].texto}
                </span>
              </div>
              {o.detalle && <p className="text-[0.86rem] text-muted-foreground">{o.detalle}</p>}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.76rem] text-muted-foreground">
                  Pedida el {fecha.format(new Date(o.creada))}
                </span>
                <Button onClick={() => setEjecutando(o)}>
                  <Camera />
                  Subir evidencia
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pidiendo && (
        <NuevaOrdenDialog
          socios={socios}
          tipos={["REPOSICION", "REPARACION"]}
          titulo="Pedir a la directiva"
          descripcion="La directiva la revisa y, si la aprueba, vuelve aquí como orden."
          onCerrar={() => setPidiendo(false)}
        />
      )}

      {ejecutando && (
        <EvidenciaDialog
          orden={{ id: ejecutando.id, tipo: ejecutando.tipo, socioNombre: ejecutando.socioNombre, direccion: ejecutando.socioDireccion }}
          onCerrar={() => setEjecutando(null)}
        />
      )}
    </div>
  );
}
