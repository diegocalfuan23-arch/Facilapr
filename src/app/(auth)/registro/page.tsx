import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  alternates: { canonical: "/registro" },
  title: "Registrar mi APR — Facilapr",
  description:
    "Crea la cuenta de tu APR o SSR en Facilapr y dale a cada socio su propio panel para consultar su deuda.",
};

export default function RegistroPage() {
  return (
    <div className="w-full max-w-[540px]">
      <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.035em] md:text-[44px]">Registra tu comité</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-[#5B5970]">Crea la cuenta de tu APR o SSR y carga tus socios desde el panel.</p>

      <RegisterForm />

      <p className="mt-7 text-center text-[15px] text-[#5B5970]">
        ¿Tu comité ya tiene cuenta?{" "}
        <Link href="/login" className="font-semibold text-[#3A0CE3] hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
