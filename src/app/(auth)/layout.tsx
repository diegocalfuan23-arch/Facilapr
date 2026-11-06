import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { Paisaje } from "@/components/marca/paisaje";

/**
 * Acceso y registro en dos columnas: el formulario a la izquierda, sobre blanco, y a la derecha
 * el paisaje del comité con la propuesta de valor.
 *
 * Mobile primero: bajo lg el panel derecho no se renderiza —no se oculta con
 * CSS— y el formulario ocupa toda la pantalla. En un teléfono ese panel sería
 * scroll que estorba antes de llegar al campo de correo.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-full flex-1 bg-[#F6F6FB] text-[#15132B] antialiased lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Columna del formulario */}
      <div className="flex min-h-screen flex-col bg-white px-5 py-6 sm:px-10">
        <Link href="/" className="flex w-fit items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo className="size-8" />
          Facilapr
        </Link>

        {/* Sin límite de ancho aquí: cada página fija el suyo, porque el
            registro tiene más campos que el acceso y necesita más espacio. */}
        <main className="flex flex-1 items-center justify-center py-10">{children}</main>

        <p className="text-[13px] text-[#5B5970]">&copy; 2026 Facilapr · Para comités de agua potable rural de Chile</p>
      </div>

      {/* Panel de marca: solo desde lg. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0B0A1F] text-white lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_75%_30%,rgba(70,90,255,0.55),transparent_70%),radial-gradient(ellipse_55%_45%_at_5%_75%,rgba(58,12,227,0.35),transparent_70%)]"
        />
        <div className="relative px-14 pt-20">
          <p className="text-[48px] leading-[1.05] font-semibold tracking-[-0.035em] [text-wrap:balance]">
            El agua la administra tu comité. <span className="mt-1 block text-[#AEB8FF]">Las respuestas, nosotros.</span>
          </p>
        </div>
        <Paisaje suelo="#2F3AA6" />
      </aside>
    </div>
  );
}
