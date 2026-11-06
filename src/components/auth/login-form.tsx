"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";

const CAMPO =
  "mt-1.5 h-12 rounded-xl border-[#E4E1F0] bg-white text-[15px] text-[#15132B] shadow-none transition-colors focus-visible:border-[#3A0CE3] focus-visible:ring-2 focus-visible:ring-[#3A0CE3]/20 dark:bg-white [&:-webkit-autofill]:shadow-[inset_0_0_0_40px_#fff]";

export function LoginForm() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const datos = new FormData(e.currentTarget);

    const { error: errorLogin } = await signIn.email({
      email: String(datos.get("email") ?? "").trim(),
      password: String(datos.get("password") ?? ""),
    });

    if (errorLogin) {
      setEnviando(false);
      setError("El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.");
      return;
    }

    router.push("/panel");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Correo del comité
        </label>
        <Input id="email" name="email" type="email" required autoComplete="username" autoFocus inputMode="email" placeholder="comite@ejemplo.cl" className={CAMPO} />
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <Link href="/olvide-clave" className="text-sm font-medium text-[#3A0CE3] hover:underline">
            ¿La olvidaste?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={mostrar ? "text" : "password"}
            required
            autoComplete="current-password"
            onKeyUp={(e) => setMayusculas(e.getModifierState("CapsLock"))}
            onBlur={() => setMayusculas(false)}
            className={`${CAMPO} pr-12`}
          />
          <button
            type="button"
            aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={mostrar}
            onClick={() => setMostrar((v) => !v)}
            className="absolute top-[calc(50%+3px)] right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#5B5970] hover:text-[#15132B] focus-visible:ring-2 focus-visible:ring-[#3A0CE3] focus-visible:outline-none"
          >
            {mostrar ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>

      {mayusculas && (
        <p role="status" className="-mt-2 flex items-center gap-2 text-sm font-medium text-[#8F4400]">
          <KeyRound className="size-4" aria-hidden />
          Tienes las mayúsculas activadas
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#FDECEC] px-3 py-2.5 text-sm font-medium text-[#A32020]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#3A0CE3] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#2A07A8] focus-visible:ring-2 focus-visible:ring-[#3A0CE3] focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
      >
        {enviando ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Entrando
          </>
        ) : (
          <>
            Entrar al panel
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </button>
    </form>
  );
}
