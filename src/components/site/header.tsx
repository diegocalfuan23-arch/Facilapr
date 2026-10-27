import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const enlaces = [
  { href: "#boleta", label: "Boletas", title: "Emisión de boletas y pagos online para tu APR" },
  { href: "#panel", label: "Gestión de socios", title: "Gestión de socios, lecturas y morosidad para tu APR" },
  { href: "#como-funciona", label: "Cómo funciona", title: "Cómo funciona el software de gestión APR" },
  { href: "#planes", label: "Planes", title: "Planes y precios para comités de Agua Potable Rural" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md">
      <div className="mx-auto max-w-[1180px] px-7">
        <nav
          aria-label="Navegación principal — software de gestión APR, boletas y pagos online"
          className="flex items-center gap-2 py-3.5"
        >
          <Link
            href="#"
            title="Facilapr — Software de gestión APR"
            className="mr-1.5 flex items-center gap-2 text-base font-semibold"
          >
            <Logo className="size-6.5" />
            Facilapr
          </Link>

          <div className="hidden flex-1 gap-5.5 text-sm text-muted-foreground sm:flex">
            {enlaces.map((enlace) => (
              <a
                key={enlace.href}
                href={enlace.href}
                title={enlace.title}
                className="transition-colors hover:text-foreground"
              >
                {enlace.label}
              </a>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3.5">
            <Link
              href="/socios"
              title="Socios: encuentra tu comité de agua potable rural y paga tu boleta"
              className="hidden text-sm font-medium whitespace-nowrap text-primary transition-colors hover:underline sm:inline"
            >
              Soy socio · Paga tu boleta
            </Link>
            <Link
              href="/login"
              title="Acceso para directivas de comités APR y SSR"
              className="hidden text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Acceso APR
            </Link>
            <a
              href="#contacto"
              title="Solicitar una demo del software de gestión APR"
              className={cn(
                buttonVariants(),
                "rounded-full bg-forest text-forest-foreground hover:bg-forest/90"
              )}
            >
              Solicitar una demo
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
