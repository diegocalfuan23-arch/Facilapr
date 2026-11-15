"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { signUp } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { CampoClave } from "@/components/auth/campo-clave";
import { CARGOS } from "@/lib/cargos";
import { origenGuardado } from "@/lib/origen";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const cargos = CARGOS;

// Mismo aspecto que el acceso (login-form): campo alto, borde suave y foco en el color de la marca.
const CAMPO =
  "mt-1.5 h-12 rounded-xl border-[#E4E1F0] bg-white text-[15px] text-[#15132B] shadow-none transition-colors focus-visible:border-[#3A0CE3] focus-visible:ring-2 focus-visible:ring-[#3A0CE3]/20 dark:bg-white [&:-webkit-autofill]:shadow-[inset_0_0_0_40px_#fff]";
const ETIQUETA = "text-sm font-medium";

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

    // El WhatsApp sirve para ayudarles a empezar: se pide un número real (al menos 8 dígitos).
    const telefono = String(datos.get("telefono") ?? "").trim();
    if (telefono.replace(/\D/g, "").length < 8) {
      setError("Escribe un WhatsApp o teléfono de contacto, con al menos 8 dígitos.");
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
      telefono,
      origen: origenGuardado(),
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
    <form onSubmit={handleSubmit} className="mt-8 grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="apr" className={ETIQUETA}>
          Nombre del APR o SSR
        </label>
        <Input id="apr" name="apr" placeholder="Ej: APR Pitrelahué" required autoFocus className={CAMPO} />
      </div>

      <div>
        <label htmlFor="rutComite" className={ETIQUETA}>
          RUT del comité
        </label>
        <Input id="rutComite" name="rutComite" placeholder="76.543.210-9" required className={CAMPO} />
      </div>

      <div>
        <label htmlFor="comuna" className={ETIQUETA}>
          Comuna
        </label>
        <Input id="comuna" name="comuna" placeholder="Ej: Freire" required className={CAMPO} />
      </div>

      <div>
        <label htmlFor="responsable" className={ETIQUETA}>
          Nombre del responsable
        </label>
        <Input id="responsable" name="responsable" placeholder="Nombre y apellido" required className={CAMPO} />
      </div>

      <div>
        <label htmlFor="cargo" className={ETIQUETA}>
          Cargo en el comité
        </label>
        <Select items={cargos} value={cargo} onValueChange={(value) => setCargo(value ?? "")}>
          <SelectTrigger
            id="cargo"
            className="mt-1.5 h-12 w-full rounded-xl border-[#E4E1F0] bg-white px-3 text-[15px] text-[#15132B] shadow-none focus-visible:border-[#3A0CE3] focus-visible:ring-2 focus-visible:ring-[#3A0CE3]/20 dark:bg-white"
          >
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

      <div className="sm:col-span-2">
        <label htmlFor="email" className={ETIQUETA}>
          Correo del comité
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="tesoreria@apr-ejemplo.cl"
          required
          className={CAMPO}
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="telefono" className={ETIQUETA}>
          WhatsApp o teléfono de contacto
        </label>
        <Input
          id="telefono"
          name="telefono"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+56 9 1234 5678"
          required
          className={CAMPO}
        />
      </div>

      <CampoClave
        id="password"
        name="password"
        label="Contraseña"
        className="sm:col-span-2"
        labelClassName={ETIQUETA}
        inputClassName={`${CAMPO} pr-20`}
      />

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#FDECEC] px-3 py-2.5 text-sm font-medium text-[#A32020] sm:col-span-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#3A0CE3] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#2A07A8] focus-visible:ring-2 focus-visible:ring-[#3A0CE3] focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70 sm:col-span-2"
      >
        {enviando ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Creando cuenta
          </>
        ) : (
          <>
            Crear cuenta del comité
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </button>

      <p className="text-center text-[13px] leading-relaxed text-[#5B5970] sm:col-span-2">
        Al crear la cuenta aceptas los{" "}
        <Link href="/terminos" className="font-medium text-[#3A0CE3] hover:underline">
          términos de uso
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="font-medium text-[#3A0CE3] hover:underline">
          política de privacidad
        </Link>
        .
      </p>
    </form>
  );
}
