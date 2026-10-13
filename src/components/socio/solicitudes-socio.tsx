"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { crearSolicitudSocio } from "@/app/socio/[slug]/solicitudes-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ESTADOS_ORDEN, TIPOS_ORDEN, type EstadoOrden, type TipoOrden } from "@/lib/ordenes";

export type SolicitudSocio = {
  id: string;
  tipo: TipoOrden;
  estado: EstadoOrden;
  detalle: string | null;
  respuesta: string | null;
  /** ISO. */
  creada: string;
  arranque: string;
};

export type ArranqueSocio = {
  id: string;
  nombre: string;
  direccion: string | null;
  cortado: boolean;
  /** Falso si el arranque está dado de baja. */
  activo: boolean;
};

const fecha = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long" });

const OPCIONES: { tipo: TipoOrden; titulo: string; ayuda: string; placeholder: string }[] = [
  { tipo: "RECLAMO", titulo: "Reclamo", ayuda: "Algo que no está bien: un cobro, una boleta, el servicio.", placeholder: "Cuéntanos qué pasó." },
  { tipo: "REPARACION", titulo: "Reparación", ayuda: "Fuga, medidor dañado, falta de agua en tu casa.", placeholder: "Ej: Hay una fuga en el empalme, frente a la casa." },
  { tipo: "REPOSICION", titulo: "Reponer el servicio", ayuda: "Si te lo cortaron y ya regularizaste.", placeholder: "Ej: Ya pagué la deuda el lunes." },
  { tipo: "REANUDACION", titulo: "Reanudar el servicio", ayuda: "Si diste de baja este arranque y quieres volver a tenerlo.", placeholder: "Cuéntanos desde cuándo lo necesitas (opcional)." },
  { tipo: "BAJA", titulo: "Dar de baja el servicio", ayuda: "Dejar de ser usuario o socio de este arranque.", placeholder: "Cuéntanos el motivo (opcional)." },
];

const ESTILO_ESTADO: Record<EstadoOrden, string> = {
  SOLICITADA: "bg-tertiary/15 text-tertiary-foreground",
  EN_TRAMITE: "bg-primary/10 text-primary",
  POR_CONFIRMAR: "bg-primary/10 text-primary",
  COMPLETADA: "bg-forest/15 text-forest",
  RECHAZADA: "bg-destructive/15 text-destructive",
  CANCELADA: "bg-muted text-muted-foreground",
};

/** Qué muestra el socio de cada estado: lo interno de «por dar de alta» no le dice nada. */
function textoEstado(e: EstadoOrden) {
  return e === "POR_CONFIRMAR" ? ESTADOS_ORDEN.EN_TRAMITE : ESTADOS_ORDEN[e];
}

/** Reclamos, pedidos de reposición o reparación y baja del servicio, con su estado y la respuesta del comité. */
export function SolicitudesSocio({
  slug,
  arranques,
  solicitudes,
}: {
  slug: string;
  arranques: ArranqueSocio[];
  solicitudes: SolicitudSocio[];
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <div className="mb-5 flex justify-end">
        <Button onClick={() => setAbierto(true)}>
          <Plus />
          Nueva solicitud
        </Button>
      </div>

      {solicitudes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[0.9rem] text-muted-foreground">
          Todavía no has hecho ninguna solicitud.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
          {solicitudes.map((s) => (
            <li key={s.id} className="flex flex-col gap-1.5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">
                    {TIPOS_ORDEN[s.tipo].texto}
                    {arranques.length > 1 && (
                      <span className="font-normal text-muted-foreground"> · {s.arranque}</span>
                    )}
                  </div>
                  <div className="text-[0.8rem] text-muted-foreground">
                    {fecha.format(new Date(s.creada))}
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-medium", ESTILO_ESTADO[s.estado])}>
                  {textoEstado(s.estado)}
                </span>
              </div>
              {s.detalle && <p className="text-[0.88rem] text-foreground/80">{s.detalle}</p>}
              {s.respuesta && (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-[0.86rem]">
                  <span className="font-medium">Respuesta del comité: </span>
                  {s.respuesta}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {abierto && <NuevaSolicitud slug={slug} arranques={arranques} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

function NuevaSolicitud({
  slug,
  arranques,
  onCerrar,
}: {
  slug: string;
  arranques: ArranqueSocio[];
  onCerrar: () => void;
}) {
  const [arranqueId, setArranqueId] = useState(arranques[0]?.id ?? "");
  const [tipo, setTipo] = useState<TipoOrden>("RECLAMO");
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const arranque = arranques.find((a) => a.id === arranqueId);
  const opcion = OPCIONES.find((o) => o.tipo === tipo)!;
  // La reposición se ofrece siempre: un corte anterior a Facilapr no figura en el sistema.
  // Las otras aparecen solo cuando tienen sentido para ese arranque.
  const opciones = OPCIONES.filter((o) => {
    if (o.tipo === "REANUDACION") return arranque && !arranque.activo;
    if (o.tipo === "BAJA") return arranque?.activo;
    return true;
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Nueva solicitud</DialogTitle>
          <DialogDescription>El comité la revisa y te responde aquí mismo.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {arranques.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label>Arranque</Label>
              <div className="flex flex-wrap gap-2">
                {arranques.map((a) => (
                  <Button
                    key={a.id}
                    type="button"
                    size="sm"
                    variant={a.id === arranqueId ? "default" : "outline"}
                    onClick={() => {
                      setArranqueId(a.id);
                      setTipo("RECLAMO");
                    }}
                  >
                    {a.nombre}
                    {a.direccion ? ` · ${a.direccion}` : ""}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>¿Qué necesitas?</Label>
            <div className="grid gap-2">
              {opciones.map((o) => (
                <button
                  key={o.tipo}
                  type="button"
                  onClick={() => setTipo(o.tipo)}
                  aria-pressed={tipo === o.tipo}
                  className={cn(
                    "rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                    tipo === o.tipo ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="text-[0.9rem] font-medium">{o.titulo}</div>
                  <div className="text-[0.78rem] text-muted-foreground">{o.ayuda}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="detalle-solicitud">Detalle</Label>
            <Textarea
              id="detalle-solicitud"
              rows={4}
              maxLength={500}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder={opcion.placeholder}
            />
          </div>

          {tipo === "BAJA" && (
            <p className="rounded-lg bg-tertiary/15 px-3.5 py-2.5 text-[0.82rem] leading-relaxed text-tertiary-foreground">
              Dar de baja el servicio no borra lo que se deba hasta hoy: el comité lo revisa contigo.
            </p>
          )}

          {error && <p className="text-[0.88rem] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={pendiente || !arranqueId}
            onClick={() =>
              iniciar(async () => {
                setError(null);
                const r = await crearSolicitudSocio(slug, arranqueId, tipo, detalle);
                if (r.ok) {
                  toast.success("Solicitud enviada");
                  onCerrar();
                } else {
                  setError(r.error);
                  toast.error(r.error);
                }
              })
            }
          >
            {pendiente && <Loader2 className="animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
