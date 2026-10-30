import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/marca/logo";

export const metadata: Metadata = {
  alternates: { canonical: "/eliminar-datos" },
  title: "Eliminar mis datos",
  description:
    "Cómo pedir que Facilapr elimine tus datos personales o los de tu comité de Agua Potable Rural.",
};

/**
 * Página de instrucciones de eliminación de datos. Meta exige una dirección
 * pública para esto antes de publicar la app. Debe decir lo mismo que la
 * política de privacidad (plazos, derivación al comité, contacto): si cambia
 * una, hay que cambiar la otra.
 */
export default function EliminarDatosPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[820px] items-center gap-2 px-7 py-5">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo className="size-6" />
            Facilapr
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-7 py-14">
        <span className="font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
          Legal
        </span>
        <h1 className="mt-3 text-[clamp(1.8rem,3vw,2.4rem)] font-semibold tracking-tight">
          Eliminar mis datos
        </h1>

        <div className="mt-10 flex flex-col gap-9 text-[0.97rem] leading-relaxed">
          <section className="rounded-2xl border border-border bg-muted/40 p-6">
            <p>
              Puedes pedir que eliminemos tus datos personales, o los de tu
              comité de Agua Potable Rural, escribiéndonos por correo. Esta
              página explica cómo y qué pasa después. Complementa nuestra{" "}
              <Link href="/privacidad" className="font-medium text-primary hover:underline">
                política de privacidad
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">Cómo pedirlo</h2>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
              <li>
                Escribe a{" "}
                <a
                  href="mailto:hola@facilapr.cl?subject=Eliminar%20mis%20datos"
                  className="font-medium text-primary hover:underline"
                >
                  hola@facilapr.cl
                </a>{" "}
                con el asunto <strong>«Eliminar mis datos»</strong>.
              </li>
              <li>
                Indica tu nombre, tu RUT y el nombre de tu comité, y si quieres
                eliminar solo tus datos o los de todo el comité.
              </li>
              <li>
                Para proteger tu información, te pediremos confirmar tu
                identidad antes de borrar nada.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">Qué pasa después</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
              <li>
                Respondemos tu solicitud dentro de{" "}
                <strong>30 días corridos</strong>.
              </li>
              <li>
                <strong>Si eres socio o usuario de un comité:</strong> tus datos
                (boletas, pagos, lecturas) pertenecen a tu comité, que decide
                sobre ellos. Si nos escribes a nosotros, derivaremos tu
                solicitud al comité y te lo informaremos.
              </li>
              <li>
                <strong>Si eres administrador de un comité:</strong> podemos
                eliminar tu cuenta y los datos de tu comité. Antes puedes
                exportarlos. Transcurridos 90 días desde el cierre de la cuenta,
                eliminamos todo, salvo lo que la ley obligue a conservar.
              </li>
              <li>
                Lo que la ley nos obliga a conservar (por ejemplo, registros
                contables) se mantiene solo por el tiempo exigido y no se usa
                para nada más.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[1.2rem] font-semibold">Dudas</h2>
            <p className="mt-3">
              Escríbenos a{" "}
              <a
                href="mailto:hola@facilapr.cl"
                className="font-medium text-primary hover:underline"
              >
                hola@facilapr.cl
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <Link
            href="/"
            className="text-[0.9rem] font-medium text-primary hover:underline"
          >
            ← Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
