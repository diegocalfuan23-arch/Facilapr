"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoClave } from "@/components/auth/campo-clave";
import { Label } from "@/components/ui/label";
import { CARGOS } from "@/lib/cargos";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const cargos = CARGOS;

export function RegisterForm() {
  const router = useRouter();
  const [cargo, setCargo] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const datos = new FormData(e.currentTarget);
    const apr = String(datos.get("apr") ?? "");
    const responsable = String(datos.get("responsable") ?? "");

    if (!cargo) {
      setError("Selecciona el cargo que ocupas en el comité.");
      return;
    }

    setEnviando(true);

    const { error: errorRegistro } = await signUp.email({
      email: String(datos.get("email") ?? ""),
      password: String(datos.get("password") ?? ""),
      name: responsable,
      apr,
      rutComite: String(datos.get("rutComite") ?? ""),
      comuna: String(datos.get("comuna") ?? ""),
      cargo,
    });

    if (errorRegistro) {
      setEnviando(false);
      setError(
        errorRegistro.message ??
          "No pudimos crear la cuenta. Revisa los datos e inténtalo otra vez."
      );
      return;
    }

    router.push("/panel");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="apr">Nombre del APR o SSR</Label>
        <Input id="apr" name="apr" placeholder="Ej: APR Pitrelahué" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rutComite">RUT del comité</Label>
        <Input
          id="rutComite"
          name="rutComite"
          placeholder="76.543.210-9"
          className="h-10"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comuna">Comuna</Label>
        <Input id="comuna" name="comuna" placeholder="Ej: Freire" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="responsable">Nombre del responsable</Label>
        <Input
          id="responsable"
          name="responsable"
          placeholder="Nombre y apellido"
          className="h-10"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cargo">Cargo en el comité</Label>
        <Select
          value={cargo}
          onValueChange={(value) => setCargo(value ?? "")}
        >
          <SelectTrigger id="cargo" className="w-full">
            <SelectValue placeholder="Selecciona un cargo" />
          </SelectTrigger>
          <SelectContent>
            {cargos.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
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

      <CampoClave
        id="password"
        name="password"
        label="Contraseña"
        className="flex flex-col gap-1.5 sm:col-span-2"
      />

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[0.88rem] text-destructive sm:col-span-2"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={enviando}
        className="mt-2 h-10 w-full sm:col-span-2"
      >
        {enviando && <Loader2 className="animate-spin" />}
        {enviando ? "Creando cuenta…" : "Crear cuenta del comité"}
      </Button>

      <p className="text-center text-[0.8rem] leading-relaxed text-muted-foreground sm:col-span-2">
        Al crear la cuenta aceptas los{" "}
        <Link href="/terminos" className="text-primary hover:underline">
          términos de uso
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="text-primary hover:underline">
          política de privacidad
        </Link>{" "}
        de Facilapr.
      </p>
    </form>
  );
}
