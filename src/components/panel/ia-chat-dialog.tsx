"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { guardarIaChat } from "@/app/panel/configuracion/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { PACK_TOKENS, type UsoIaChat } from "@/lib/ia-chat-limites";

export type IaChatAjustes = {
  /** El plan incluye la IA en el chat (Estándar y Grande). */
  disponible: boolean;
  modo: string;
  /** Minutos que espera la IA a que responda una persona (modo «si no estoy disponible»). */
  esperaMin: number;
  instrucciones: string | null;
  /** Cuánta IA lleva gastada y cuánta le queda; null si el plan no la incluye. */
  uso: UsoIaChat | null;
};

/** Botón de la cabecera de Conversaciones: muestra si la IA está activa y abre sus ajustes. */
export function BotonIaChat({ ajustes }: { ajustes: IaChatAjustes }) {
  const [abierto, setAbierto] = useState(false);
  // Lo guardado, para que el botón refleje el cambio sin recargar la página.
  const [actual, setActual] = useState(ajustes);
  const activa = actual.disponible && actual.modo !== "APAGADO";

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
          {!actual.disponible
            ? "Desde Estándar"
            : activa && actual.uso && actual.uso.disponible <= 0
              ? "Sin tokens"
              : activa
                ? "Activo"
                : "Apagado"}
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
  const [activa, setActiva] = useState(ajustes.modo !== "APAGADO");
  // Cuando está encendida: contesta enseguida, o espera a que la directiva esté disponible.
  const [inteligente, setInteligente] = useState(ajustes.modo === "SIN_RESPUESTA");
  const [espera, setEspera] = useState(String(ajustes.esperaMin || 5));
  const modo = !activa ? "APAGADO" : inteligente ? "SIN_RESPUESTA" : "SIEMPRE";
  const [instrucciones, setInstrucciones] = useState(ajustes.instrucciones ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const datos = new FormData();
      datos.set("iaChatModo", modo);
      datos.set("iaChatEsperaMin", espera || "5");
      datos.set("iaChatInstrucciones", instrucciones);
      const r = await guardarIaChat(null, datos);
      if (r.ok) {
        toast.success(modo === "SIEMPRE" ? "Asistente de IA activado" : "Asistente de IA apagado");
        onGuardado({
          ...ajustes,
          disponible: true,
          modo,
          esperaMin: Number(espera) || 5,
          instrucciones: instrucciones.trim() || null,
        });
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

            {activa && (
              <div className="flex flex-col gap-2">
                <Label>Cuándo entra la IA</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    {
                      inteligente: true,
                      titulo: "Solo si no estoy disponible",
                      detalle: "Si estás conectado, te deja responder. Si estás en otro chat o no contestas a tiempo, entra ella.",
                    },
                    {
                      inteligente: false,
                      titulo: "Siempre primero",
                      detalle: "Contesta en segundos a todos, y tú sigues cuando quieras.",
                    },
                  ].map((o) => (
                    <button
                      key={o.titulo}
                      type="button"
                      onClick={() => setInteligente(o.inteligente)}
                      aria-pressed={inteligente === o.inteligente}
                      className={cn(
                        "rounded-lg border px-3.5 py-3 text-left transition-colors",
                        inteligente === o.inteligente
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="text-[0.9rem] font-medium">{o.titulo}</div>
                      <div className="mt-0.5 text-[0.78rem] text-muted-foreground">{o.detalle}</div>
                    </button>
                  ))}
                </div>

                {inteligente && (
                  <div className="flex flex-wrap items-center gap-2 text-[0.84rem] text-muted-foreground">
                    <span>Esperar</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={espera}
                      onChange={(e) => setEspera(e.target.value)}
                      aria-label="Minutos de espera"
                      className="h-8 w-16 rounded-md border border-input bg-transparent px-2 text-center text-sm text-foreground tabular-nums"
                    />
                    <span>minutos a que respondas tú antes de que conteste la IA.</span>
                  </div>
                )}
              </div>
            )}

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

            {ajustes.uso && <ConsumoIa uso={ajustes.uso} />}

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

const numero = new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 });
const entero = new Intl.NumberFormat("es-CL");
const diaMes = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", timeZone: "UTC" });

/** Cuota del mes, lo gastado, los packs adicionales y cómo pedir más. */
export function ConsumoIa({ uso }: { uso: UsoIaChat }) {
  const pct = uso.cuotaMes > 0 ? Math.min(100, Math.round((uso.usadoMes / uso.cuotaMes) * 100)) : 100;
  const agotada = uso.disponible <= 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.92rem] font-medium">Tokens de IA</span>
        <span className="text-[0.76rem] text-muted-foreground">
          Se renueva el {diaMes.format(new Date(uso.reinicia))}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Progress value={pct} aria-label="Tokens usados este mes" />
        <div className="flex items-baseline justify-between gap-3 text-[0.8rem] text-muted-foreground">
          <span>
            <span className="font-medium text-foreground tabular-nums">{numero.format(uso.usadoMes)}</span> de{" "}
            <span className="tabular-nums">{numero.format(uso.cuotaMes)}</span> usados este mes
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-[0.8rem]">
        <div>
          <dt className="text-muted-foreground">Disponibles ahora</dt>
          <dd className={cn("mt-0.5 text-[1rem] font-semibold tabular-nums", agotada && "text-destructive")}>
            {entero.format(uso.disponible)}
          </dd>
          <dd className="text-muted-foreground">≈ {entero.format(uso.respuestasDisponibles)} respuestas</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Packs adicionales</dt>
          <dd className="mt-0.5 text-[1rem] font-semibold tabular-nums">{entero.format(uso.extraRestante)}</dd>
          <dd className="text-muted-foreground">no vencen</dd>
        </div>
      </dl>

      {agotada && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-[0.8rem] text-destructive">
          Se acabaron los tokens: la IA no responde y las conversaciones quedan para la directiva.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="text-[0.78rem] text-muted-foreground">
          Pack adicional: +{numero.format(PACK_TOKENS)} tokens (≈ {entero.format(Math.round(PACK_TOKENS / 2000))} respuestas)
        </span>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a
              href={`mailto:hola@facilapr.cl?subject=${encodeURIComponent("Quiero un pack adicional de IA")}&body=${encodeURIComponent("Hola, quiero agregar un pack de +2.000.000 tokens de IA al chat de mi comité.")}`}
            />
          }
        >
          <Plus />
          Pedir pack
        </Button>
      </div>
    </div>
  );
}
