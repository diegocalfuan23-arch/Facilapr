"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import {
  aceptarInvitacion,
  restablecerClaveConEnlace,
} from "@/app/socio/[slug]/actions";
import { CampoClave } from "@/components/auth/campo-clave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** El socio elige su clave con el enlace de invitación y entra a su cuenta. */
export function AceptarInvitacionForm({
  slug,
  codigo,
  base,
  modo = "invitacion",
}: {
  slug: string;
  codigo: string;
  /** Invitación nueva, o enlace para cambiar la clave de una cuenta que ya existe. */
  modo?: "invitacion" | "restablecer";
  /** Prefijo del portal (ver lib/portal-socio.ts): el panel es la base misma. */
  base: string;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const datos = new FormData(e.currentTarget);
    const clave = String(datos.get("clave") ?? "");
    if (clave !== String(datos.get("confirmacion") ?? "")) {
      setError("Las claves no coinciden.");
      return;
    }

    setEnviando(true);
    const r =
      modo === "restablecer"
        ? await restablecerClaveConEnlace(slug, codigo, clave)
        : await aceptarInvitacion(slug, codigo, clave);
    if (!r.ok) {
      setEnviando(false);
      setError(r.error);
      return;
    }

    const { error: errorLogin } = await signIn.email({ email: r.email, password: clave });
    if (errorLogin) {
      // La cuenta quedó creada: basta con entrar a mano.
      router.push(`${base}/entrar`);
      return;
    }
    router.push(base);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
      <CampoClave id="clave" name="clave" label={modo === "restablecer" ? "Elige tu clave nueva" : "Elige tu clave"} confirmarId="confirmacion" />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmacion">Repite tu clave</Label>
        <Input
          id="confirmacion"
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          minLength={8}
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

      <Button type="submit" disabled={enviando} className="mt-2 h-10 w-full">
        {enviando && <Loader2 className="animate-spin" />}
        {enviando
          ? modo === "restablecer"
            ? "Guardando…"
            : "Creando tu cuenta…"
          : modo === "restablecer"
            ? "Guardar mi clave y entrar"
            : "Crear mi cuenta y entrar"}
      </Button>
    </form>
  );
}
