import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Acceso APR — Facilapr",
  description:
    "Ingresa al panel de Facilapr para administrar los socios y boletas de tu APR o SSR.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string }>;
}) {
  const { cuenta } = await searchParams;

  return (
    <div className="w-full max-w-[420px]">
      <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.035em] md:text-[44px]">Acceso para tu APR</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-[#5B5970]">Entra con la cuenta de tu comité para administrar socios y boletas.</p>

      {cuenta === "desactivada" && (
        <p role="alert" className="mt-6 flex items-start gap-2 rounded-xl bg-[#FDECEC] px-3 py-2.5 text-sm font-medium text-[#A32020]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Tu acceso fue desactivado por la directiva del comité. Si crees que es un error, habla con ellos.
        </p>
      )}

      <LoginForm />

      <p className="mt-7 text-center text-[15px] text-[#5B5970]">
        ¿Tu comité no tiene cuenta?{" "}
        <Link href="/registro" className="font-semibold text-[#3A0CE3] hover:underline">
          Registrar mi APR
        </Link>
      </p>
      <p className="mt-1 text-center text-[15px] text-[#5B5970]">
        ¿Eres socio?{" "}
        <Link href="/socios" className="font-semibold text-[#3A0CE3] hover:underline">
          Busca tu comité
        </Link>
      </p>
    </div>
  );
}
