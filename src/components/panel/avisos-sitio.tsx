"use client";

import { useActionState, useState, useTransition } from "react";
import { AlertTriangle, Droplets, Eye, EyeOff, Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { crearAviso, eliminarAviso, type ResultadoAccion } from "@/app/panel/sitio/actions";
import { alternarAviso } from "@/app/panel/sitio/administrar/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type AvisoEditor = {
  id: string;
  tipo: "CORTE" | "MANTENCION" | "NOTICIA";
  titulo: string;
  cuerpo: string | null;
  sectores: string | null;
  inicia: Date | null;
  termina: Date | null;
  publicado: boolean;
};

const ETIQUETA_TIPO = {
  CORTE: { texto: "Corte", icono: AlertTriangle, color: "text-destructive" },
  MANTENCION: { texto: "Mantención", icono: Wrench, color: "text-tertiary" },
  NOTICIA: { texto: "Noticia", icono: Droplets, color: "text-primary" },
} as const;

const fechaCorta = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Los avisos del sitio: cortes, mantenciones y noticias. Se pueden ocultar sin borrarlos. */
export function AvisosSeccion({ avisos }: { avisos: AvisoEditor[] }) {
  const [nuevo, setNuevo] = useState(false);

  return (
    <section className="rounded-xl border border-border/60 bg-card p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[1.05rem] font-semibold">Anuncios y avisos</h2>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">Cortes, mantenciones y noticias. Los más nuevos aparecen primero en tu sitio.</p>
        </div>
        <Button className="h-10 rounded-full px-4 text-[0.9rem]" onClick={() => setNuevo(true)}>
          <Plus />
          Nuevo aviso
        </Button>
      </div>

      <div className="mt-4">
        {avisos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[0.9rem] text-muted-foreground">Todavía no has publicado avisos.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border/60">
            {avisos.map((aviso) => {
              const meta = ETIQUETA_TIPO[aviso.tipo];
              const Icono = meta.icono;
              return (
                <div key={aviso.id} className={cn("flex items-center gap-3 py-3 first:pt-0 last:pb-0", !aviso.publicado && "opacity-60")}>
                  <Icono className={cn("size-4 shrink-0", meta.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.92rem] font-medium">{aviso.titulo}</div>
                    <div className="truncate text-[0.8rem] text-muted-foreground">
                      {meta.texto}
                      {aviso.inicia && ` · ${fechaCorta.format(aviso.inicia)}`}
                      {aviso.sectores && ` · ${aviso.sectores}`}
                      {!aviso.publicado && " · Oculto"}
                    </div>
                  </div>
                  <BotonesAviso aviso={aviso} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AvisoDialog abierto={nuevo} onAbiertoChange={setNuevo} />
    </section>
  );
}

function BotonesAviso({ aviso }: { aviso: AvisoEditor }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pendiente}
        aria-label={aviso.publicado ? `Ocultar aviso ${aviso.titulo}` : `Mostrar aviso ${aviso.titulo}`}
        title={aviso.publicado ? "Ocultar del sitio" : "Mostrar en el sitio"}
        onClick={() => iniciar(async () => void (await alternarAviso(aviso.id, !aviso.publicado)))}
      >
        {aviso.publicado ? <Eye /> : <EyeOff />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pendiente}
        aria-label={`Eliminar aviso ${aviso.titulo}`}
        onClick={() => {
          if (!window.confirm(`¿Borrar «${aviso.titulo}»?`)) return;
          iniciar(async () => void (await eliminarAviso(aviso.id)));
        }}
      >
        {pendiente ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </div>
  );
}

function AvisoDialog({
  abierto,
  onAbiertoChange,
}: {
  abierto: boolean;
  onAbiertoChange: (v: boolean) => void;
}) {
  const [estado, accion, pendiente] = useActionState<
    ResultadoAccion | null,
    FormData
  >(async (prev, formData) => {
    const r = await crearAviso(prev, formData);
    if (r.ok) onAbiertoChange(false);
    return r;
  }, null);

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nuevo aviso</DialogTitle>
          <DialogDescription>
            Se publica de inmediato en tu sitio.
          </DialogDescription>
        </DialogHeader>

        <form action={accion} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <select
              id="tipo"
              name="tipo"
              defaultValue="CORTE"
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="CORTE">Corte de agua</option>
              <option value="MANTENCION">Mantención</option>
              <option value="NOTICIA">Noticia</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              name="titulo"
              required
              maxLength={160}
              placeholder="Corte programado por reparación de matriz"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sectores">Sectores afectados</Label>
            <Input
              id="sectores"
              name="sectores"
              maxLength={300}
              placeholder="Sector norte, camino a Pitrelahué"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inicia">Comienza</Label>
              <Input id="inicia" name="inicia" type="datetime-local" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="termina">Termina</Label>
              <Input id="termina" name="termina" type="datetime-local" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cuerpo">Detalle</Label>
            <Textarea
              id="cuerpo"
              name="cuerpo"
              rows={3}
              maxLength={1000}
              placeholder="Recomendamos almacenar agua durante la mañana."
            />
          </div>

          {estado && !estado.ok && (
            <p className="text-[0.88rem] text-destructive">{estado.error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onAbiertoChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente && <Loader2 className="animate-spin" />}
              Publicar aviso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
