"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { solicitarRecuperacion } from "@/app/(auth)/olvide-clave/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OlvideClaveForm() {
  const [enviando, setEnviando] = useState(false);
  // El último correo al que se mandó el enlace; null mientras no se haya mandado ninguno.
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const formulario = e.currentTarget;
    const correo = String(new FormData(formulario).get("email") ?? "").trim();
    const r = await solicitarRecuperacion(correo);

    setEnviando(false);
    if (r.ok) {
      setEnviadoA(correo);
      formulario.reset();
    } else setError(r.error);
  }

  const yaEnviado = enviadoA !== null;

  return (
    <>
      {yaEnviado && (
        <div
          role="status"
          className="mt-7 flex items-start gap-3 rounded-lg bg-forest/10 px-4 py-3.5 text-[0.9rem] text-forest"
        >
          <Check className="mt-0.5 size-4.5 shrink-0" />
          <p>
            Te enviamos un enlace para crear una contraseña nueva a{" "}
            <strong className="break-all font-semibold">{enviadoA}</strong>.
            Revisa también spam.
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={
          yaEnviado
            ? "mt-6 flex flex-col gap-4 border-t border-border pt-6"
            : "mt-7 flex flex-col gap-4"
        }
      >
        {yaEnviado && (
          <p className="text-[0.88rem] text-muted-foreground">
            ¿No llegó o te equivocaste de correo? Prueba con otro.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo del comité</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tesoreria@apr-ejemplo.cl"
            className="h-10"
            required
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[0.88rem] text-destructive"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant={yaEnviado ? "outline" : "default"}
          disabled={enviando}
          className="mt-2 h-10 w-full"
        >
          {enviando && <Loader2 className="animate-spin" />}
          {enviando
            ? "Enviando…"
            : yaEnviado
              ? "Enviar a otro correo"
              : "Enviar enlace de recuperación"}
        </Button>
      </form>
    </>
  );
}
