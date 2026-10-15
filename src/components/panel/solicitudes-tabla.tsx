"use client";

import { toast } from "sonner";
import { useState, useTransition } from "react";
import { Check, Loader2, Trash2, UserCheck, X } from "lucide-react";
import {
  aprobarSolicitud,
  eliminarSolicitud,
  rechazarSolicitud,
} from "@/app/panel/socios/solicitudes/actions";
import { formatearRut, iniciales, tiempoRelativo } from "@/lib/formato";
import { SolicitudesClave, type SolicitudClaveFila } from "@/components/panel/solicitudes-clave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Estado = "PENDIENTE" | "APROBADA" | "RECHAZADA";

type Solicitud = {
  id: string;
  nombre: string;
  rut: string | null;
  estado: Estado;
  motivoRechazo: string | null;
  createdAt: Date;
};

const ESTADO_ESTILO: Record<Estado, { texto: string; clase: string }> = {
  PENDIENTE: { texto: "Pendiente", clase: "bg-tertiary/15 text-tertiary-foreground" },
  APROBADA: { texto: "Aprobada", clase: "bg-forest/15 text-forest" },
  RECHAZADA: { texto: "Rechazada", clase: "bg-destructive/15 text-destructive" },
};

function AccionesSolicitud({
  solicitud,
  onCambio,
  onEliminada,
}: {
  solicitud: Solicitud;
  onCambio: (id: string, cambios: Partial<Solicitud>) => void;
  onEliminada: (id: string) => void;
}) {
  const [aprobando, iniciarAprobar] = useTransition();
  const [rechazando, iniciarRechazar] = useTransition();
  const [eliminando, iniciarEliminar] = useTransition();
  const [dialogo, setDialogo] = useState<"rechazar" | "eliminar" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ocupada = aprobando || rechazando || eliminando;
  const pendiente = solicitud.estado === "PENDIENTE";

  function aprobar() {
    setError(null);
    iniciarAprobar(async () => {
      const r = await aprobarSolicitud(solicitud.id);
      if (r.ok) {
        onCambio(solicitud.id, { estado: "APROBADA" });
        toast.success(`Acceso aprobado para ${solicitud.nombre}`);
      } else {
        setError(r.error);
        toast.error(r.error);
      }
    });
  }

  function rechazar() {
    setError(null);
    iniciarRechazar(async () => {
      const r = await rechazarSolicitud(solicitud.id, motivo.trim());
      if (r.ok) {
        setDialogo(null);
        toast.success(`Solicitud de ${solicitud.nombre} rechazada`);
        onCambio(solicitud.id, {
          estado: "RECHAZADA",
          motivoRechazo: motivo.trim() || null,
        });
      } else {
        setError(r.error);
      }
    });
  }

  function eliminar() {
    setError(null);
    iniciarEliminar(async () => {
      const r = await eliminarSolicitud(solicitud.id);
      if (r.ok) {
        setDialogo(null);
        toast.success("Solicitud eliminada");
        onEliminada(solicitud.id);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <>
        <div data-tour="sol-acciones" className="flex items-center justify-end gap-2">
          {error && (
            <p className="max-w-[22ch] text-right text-[0.78rem] text-destructive">
              {error}
            </p>
          )}
          {pendiente && (
            <>
              <Button
                type="button"
                size="sm"
                disabled={ocupada}
                onClick={aprobar}
              >
                {aprobando ? <Loader2 className="animate-spin" /> : <Check />}
                Aprobar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ocupada}
                onClick={() => setDialogo("rechazar")}
              >
                <X className="size-4" />
                Rechazar
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={ocupada}
            onClick={() => setDialogo("eliminar")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Eliminar
          </Button>
        </div>

        <Dialog
          open={dialogo === "rechazar"}
          onOpenChange={(v) => !v && setDialogo(null)}
        >
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Rechazar solicitud</DialogTitle>
              <DialogDescription>
                {solicitud.nombre} no podrá entrar a su panel. Puedes explicarle
                el motivo, o dejarlo en blanco.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`motivo-${solicitud.id}`}>Motivo (opcional)</Label>
              <Input
                id={`motivo-${solicitud.id}`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: este RUT ya no pertenece al comité"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogo(null)}
                disabled={rechazando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={rechazar}
                disabled={rechazando}
              >
                {rechazando && <Loader2 className="animate-spin" />}
                Rechazar solicitud
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={dialogo === "eliminar"}
          onOpenChange={(v) => !v && setDialogo(null)}
        >
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Eliminar solicitud</DialogTitle>
              <DialogDescription>
                Se borra el registro de la solicitud de {solicitud.nombre}.
                {solicitud.estado === "APROBADA"
                  ? " Su cuenta de socio sigue activa."
                  : " Podrá volver a pedir acceso cuando quiera."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogo(null)}
                disabled={eliminando}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={eliminar}
                disabled={eliminando}
              >
                {eliminando && <Loader2 className="animate-spin" />}
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  );
}

function EstadoSolicitud({ solicitud }: { solicitud: Solicitud }) {
  const estilo = ESTADO_ESTILO[solicitud.estado];
  return (
    <span
      title={solicitud.motivoRechazo ?? undefined}
      className={`inline-flex rounded-full px-2.5 py-1 text-[0.78rem] font-medium whitespace-nowrap ${estilo.clase}`}
    >
      {estilo.texto}
    </span>
  );
}

type PropsFila = {
  solicitud: Solicitud;
  onCambio: (id: string, cambios: Partial<Solicitud>) => void;
  onEliminada: (id: string) => void;
};

function FilaSolicitud({ solicitud, onCambio, onEliminada }: PropsFila) {
  return (
    <TableRow>
      <TableCell className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[0.7rem] font-semibold text-muted-foreground">
            {iniciales(solicitud.nombre)}
          </span>
          <span className="font-medium">{solicitud.nombre}</span>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3.5 font-mono text-[0.85rem] tabular-nums whitespace-nowrap text-muted-foreground">
        {formatearRut(solicitud.rut)}
      </TableCell>
      <TableCell className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
        {tiempoRelativo(solicitud.createdAt)}
      </TableCell>
      <TableCell className="px-4 py-3.5">
        <EstadoSolicitud solicitud={solicitud} />
      </TableCell>
      <TableCell className="px-4 py-3.5">
        <AccionesSolicitud
          solicitud={solicitud}
          onCambio={onCambio}
          onEliminada={onEliminada}
        />
      </TableCell>
    </TableRow>
  );
}

/** La misma solicitud como tarjeta, para pantallas angostas. */
function TarjetaSolicitud({ solicitud, onCambio, onEliminada }: PropsFila) {
  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[0.72rem] font-semibold text-muted-foreground">
            {iniciales(solicitud.nombre)}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{solicitud.nombre}</div>
            <div className="truncate font-mono text-[0.8rem] tabular-nums text-muted-foreground">
              {formatearRut(solicitud.rut)} · {tiempoRelativo(solicitud.createdAt)}
            </div>
          </div>
        </div>
        <EstadoSolicitud solicitud={solicitud} />
      </div>
      <AccionesSolicitud
        solicitud={solicitud}
        onCambio={onCambio}
        onEliminada={onEliminada}
      />
    </li>
  );
}


export function SolicitudesTabla({
  solicitudes,
  clavesPedidas,
  comite,
}: {
  solicitudes: Solicitud[];
  /** Socios que no pueden entrar y piden una clave nueva. */
  clavesPedidas: SolicitudClaveFila[];
  comite: { nombre: string };
}) {
  const [lista, setLista] = useState(solicitudes);

  function onCambio(id: string, cambios: Partial<Solicitud>) {
    setLista((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)));
  }

  function onEliminada(id: string) {
    setLista((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[1.4rem] font-semibold">Solicitudes de acceso</h1>
      <p className="mt-1 text-[0.9rem] text-muted-foreground">
        Aprueba solo si reconoces el RUT como parte del comité.
      </p>

      <SolicitudesClave solicitudes={clavesPedidas} comite={comite} />

      {lista.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted">
            <UserCheck className="size-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 text-[1rem] font-semibold">
            No hay solicitudes
          </h2>
          <p className="mt-2 max-w-[46ch] text-[0.92rem] leading-relaxed text-muted-foreground">
            Cuando un socio pida acceso a su panel, aparecerá aquí.
          </p>
        </div>
      ) : (
        <>
        <ul className="mt-6 flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:hidden">
          {lista.map((s) => (
            <TarjetaSolicitud
              key={s.id}
              solicitud={s}
              onCambio={onCambio}
              onEliminada={onEliminada}
            />
          ))}
        </ul>
        <div data-tour="sol-tabla" className="mt-6 hidden overflow-x-auto rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-11 px-4">Socio</TableHead>
                <TableHead className="h-11 px-4">RUT</TableHead>
                <TableHead className="h-11 px-4">Solicitada</TableHead>
                <TableHead className="h-11 px-4">Estado</TableHead>
                <TableHead className="h-11 px-4 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((s) => (
                <FilaSolicitud
                  key={s.id}
                  solicitud={s}
                  onCambio={onCambio}
                  onEliminada={onEliminada}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}
    </div>
  );
}
