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
      <h1 className="text-[1.6rem] font-semibold tracking-tight">
        Registra tu comité en Facilapr
      </h1>
      <p className="mt-2 text-[0.95rem] text-muted-foreground">
        Creamos la cuenta de tu APR o SSR. Después podrás cargar tus socios y
        boletas desde el panel.
      </p>

      <RegisterForm />

      <p className="mt-6 text-center text-[0.9rem] text-muted-foreground">
        ¿Tu comité ya tiene cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
