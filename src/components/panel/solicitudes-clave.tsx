"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, MessageCircle, X } from "lucide-react";
import { resolverSolicitudClave } from "@/app/panel/socios/solicitudes/actions";
import { RestablecerClaveDialog } from "@/components/panel/restablecer-clave-dialog";
import { Button } from "@/components/ui/button";
import { formatearRut, iniciales, tiempoRelativo } from "@/lib/formato";

export type SolicitudClaveFila = {
  id: string;
  socioId: string;
  nombre: string;
  rut: string | null;
  telefono: string | null;
  createdAt: Date;
};

/**
 * Socios que no pueden entrar y pidieron una clave nueva. La directiva les manda
 * el enlace al teléfono que tiene registrado: eso es lo que confirma que es la persona.
 */
export function SolicitudesClave({
  solicitudes,
  comite,
}: {
  solicitudes: SolicitudClaveFila[];
  comite: { nombre: string };
}) {
  const [lista, setLista] = useState(solicitudes);
  const [atendiendo, setAtendiendo] = useState<SolicitudClaveFila | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (lista.length === 0) return null;

  function cerrar(id: string, estado: "ATENDIDA" | "DESCARTADA") {
    iniciar(async () => {
      const r = await resolverSolicitudClave(id, estado);
      if (r.ok) {
        setLista((prev) => prev.filter((s) => s.id !== id));
        toast.success(estado === "ATENDIDA" ? "Solicitud atendida" : "Solicitud descartada");
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="mt-6 flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-[1.05rem] font-semibold">
          <KeyRound className="size-4 text-primary" />
          Piden una clave nueva
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.72rem] font-medium text-primary tabular-nums">
            {lista.length}
          </span>
        </h2>
        <p className="mt-0.5 text-[0.88rem] text-muted-foreground">
          Son socios que no pueden entrar. El enlace se manda al teléfono que tienes anotado de cada uno: así te aseguras
          de que es la persona.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {lista.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[0.72rem] font-semibold text-muted-foreground">
                {iniciales(s.nombre)}
              </span>
              <div className="min-w-0">
                <div className="truncate font-medium">{s.nombre}</div>
                <div className="truncate font-mono text-[0.8rem] tabular-nums text-muted-foreground">
                  {formatearRut(s.rut)} · {tiempoRelativo(s.createdAt)}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" disabled={pendiente} onClick={() => setAtendiendo(s)}>
                <MessageCircle />
                Enviar enlace
              </Button>
              <Button size="sm" variant="outline" disabled={pendiente} onClick={() => cerrar(s.id, "DESCARTADA")}>
                <X className="size-4" />
                Descartar
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {atendiendo && (
        <RestablecerClaveDialog
          socio={{ id: atendiendo.socioId, nombre: atendiendo.nombre, rut: atendiendo.rut, telefono: atendiendo.telefono }}
          comite={comite}
          onEnviado={() => cerrar(atendiendo.id, "ATENDIDA")}
          onCerrar={() => setAtendiendo(null)}
        />
      )}
    </section>
  );
}
