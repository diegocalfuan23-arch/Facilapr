"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { guardarIaChat } from "@/app/panel/configuracion/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export type IaChatAjustes = {
  /** El plan incluye la IA en el chat (Estándar y Grande). */
  disponible: boolean;
  modo: string;
  instrucciones: string | null;
};

/** Botón de la cabecera de Conversaciones: muestra si la IA está activa y abre sus ajustes. */
export function BotonIaChat({ ajustes }: { ajustes: IaChatAjustes }) {
  const [abierto, setAbierto] = useState(false);
  // Lo guardado, para que el botón refleje el cambio sin recargar la página.
  const [actual, setActual] = useState(ajustes);
  const activa = actual.disponible && actual.modo === "SIEMPRE";

  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)}>
        <Sparkles />
        Asistente IA
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
            activa ? "bg-forest/15 text-forest" : "bg-muted text-muted-foreground"
          )}
        >
          {actual.disponible ? (activa ? "Activo" : "Apagado") : "Desde Estándar"}
        </span>
      </Button>

      {abierto && (
        <IaChatDialog
          ajustes={actual}
          onGuardado={(a) => setActual(a)}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}

function IaChatDialog({
  ajustes,
  onGuardado,
  onCerrar,
}: {
  ajustes: IaChatAjustes;
  onGuardado: (a: IaChatAjustes) => void;
  onCerrar: () => void;
}) {
  const [activa, setActiva] = useState(ajustes.modo === "SIEMPRE");
  const modo = activa ? "SIEMPRE" : "APAGADO";
  const [instrucciones, setInstrucciones] = useState(ajustes.instrucciones ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const datos = new FormData();
      datos.set("iaChatModo", modo);
      datos.set("iaChatInstrucciones", instrucciones);
      const r = await guardarIaChat(null, datos);
      if (r.ok) {
        toast.success(modo === "SIEMPRE" ? "Asistente de IA activado" : "Asistente de IA apagado");
        onGuardado({ disponible: true, modo, instrucciones: instrucciones.trim() || null });
        onCerrar();
      } else {
        setError(r.error);
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Asistente de IA del chat</DialogTitle>
          <DialogDescription>
            Responde a tus socios en segundos y te pasa la conversación cuando hace falta.
          </DialogDescription>
        </DialogHeader>

        {!ajustes.disponible ? (
          <p className="rounded-lg bg-muted/60 px-3.5 py-3 text-[0.9rem] leading-relaxed text-muted-foreground">
            La IA en el chat está disponible desde el plan Estándar. Con ese plan
            podrás activarla aquí mismo y escribirle las reglas de tu comité.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3.5">
              <div className="min-w-0">
                <Label htmlFor="ia-activa" className="text-[0.92rem]">
                  Responder automáticamente
                </Label>
                <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
                  {activa
                    ? "La IA contesta en segundos. Tú sigues cuando quieras."
                    : "Apagada: solo responde la directiva."}
                </p>
              </div>
              <Switch id="ia-activa" checked={activa} onCheckedChange={setActiva} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ia-instrucciones">Instrucciones propias</Label>
              <Textarea
                id="ia-instrucciones"
                rows={5}
                maxLength={1500}
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                placeholder="Ej: Háblales de usted. Si preguntan por cortes, que llamen a la oficina de 9 a 13 h."
              />
              <p className="text-right text-[0.74rem] text-muted-foreground tabular-nums">
                {instrucciones.length}/1500
              </p>
            </div>

            <ul className="flex flex-col gap-1.5 rounded-lg bg-muted/50 px-4 py-3 text-[0.8rem] leading-relaxed text-muted-foreground">
              <li>• Sus mensajes salen marcados como «Asistente del comité · IA».</li>
              <li>• Usa los datos de la cuenta del socio y de tu comité. No promete plazos ni descuentos.</li>
              <li>• Si es un reclamo, un corte o no sabe, marca la conversación como «Necesita respuesta humana».</li>
              <li>• Si escribes tú en una conversación, la IA se pausa 10 minutos ahí y luego vuelve a responder.</li>
            </ul>

            {error && <p className="text-[0.88rem] text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            {ajustes.disponible ? "Cancelar" : "Cerrar"}
          </Button>
          {ajustes.disponible && (
            <Button onClick={guardar} disabled={pendiente}>
              {pendiente && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
