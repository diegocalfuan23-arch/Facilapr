"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { avisarNoPuedoEntrar } from "@/app/socio/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** El socio que no puede entrar escribe su RUT y su comité recibe el aviso. */
export function NoPuedoEntrarForm({ slug }: { slug: string }) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const rut = String(new FormData(e.currentTarget).get("rut") ?? "");
    const r = await avisarNoPuedoEntrar(slug, rut);
    setEnviando(false);
    if (r.ok) setEnviado(true);
    else setError("Escribe tu RUT completo, por ejemplo 12345678-9.");
  }

  if (enviado) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-forest/30 bg-forest/5 p-6 text-center">
        <Check className="size-8 text-forest" />
        <p className="text-[0.95rem] font-medium">Avisamos a tu comité</p>
        <p className="text-[0.88rem] text-muted-foreground">
          Si ese RUT está registrado con una cuenta, te llegará un enlace por WhatsApp al teléfono que el comité tiene
          anotado. Puede tardar un poco: depende de cuándo lo revisen.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rut">Tu RUT</Label>
        <Input id="rut" name="rut" placeholder="12345678-9" autoComplete="username" className="h-10" required />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[0.88rem] text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={enviando} className="mt-2 h-10 w-full">
        {enviando && <Loader2 className="animate-spin" />}
        {enviando ? "Enviando…" : "Avisar a mi comité"}
      </Button>
    </form>
  );
}
