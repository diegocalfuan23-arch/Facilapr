import Link from "next/link";
import { MenuMovil } from "@/components/site/menu-movil";

const enlaces = [
  { href: "#boleta", label: "Boletas", title: "Emisión de boletas y pagos online para tu APR" },
  { href: "#panel", label: "Gestión de socios", title: "Gestión de socios, lecturas y morosidad para tu APR" },
  { href: "#como-funciona", label: "Cómo funciona", title: "Cómo funciona el software de gestión APR" },
  { href: "#planes", label: "Planes", title: "Planes y precios para comités de Agua Potable Rural" },
];

/** Barra flotante en forma de píldora, sobre la portada oscura. */
export function Header() {
  return (
    <header className="fixed inset-x-0 top-3 z-40 px-4 sm:px-8">
      <nav
        aria-label="Navegación principal — software de gestión APR, boletas y pagos online"
        className="mx-auto flex h-14 max-w-[1180px] items-center gap-6 rounded-full border border-white/10 bg-[#0B0A1F]/75 pr-2 pl-5 text-white shadow-[0_8px_30px_rgba(11,10,31,0.25)] backdrop-blur-xl"
      >
        <Link href="#inicio" title="Facilapr — Software de gestión APR" className="text-lg font-semibold tracking-tight">
          facilapr
        </Link>

        <div className="hidden flex-1 items-center gap-6 md:flex">
          {enlaces.map((enlace) => (
            <a key={enlace.href} href={enlace.href} title={enlace.title} className="text-sm text-white/80 transition-colors hover:text-white">
              {enlace.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-4">
          <Link
            href="/socios"
            title="Socios: encuentra tu comité de agua potable rural y paga tu boleta"
            className="hidden text-sm font-medium whitespace-nowrap text-white/90 transition-colors hover:text-white lg:inline"
          >
            Soy socio · Paga tu boleta
          </Link>
          <Link href="/login" title="Acceso para directivas de comités APR y SSR" className="hidden text-sm whitespace-nowrap text-white/80 transition-colors hover:text-white md:inline">
            Acceso APR
          </Link>
          {/* En celular el acceso queda a un toque y el resto va en el menú. */}
          <Link href="/login" className="text-sm font-medium whitespace-nowrap text-white md:hidden">
            Ingresar
          </Link>
          <a
            href="#contacto"
            title="Solicitar una demo del software de gestión APR"
            className="hidden min-h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#15132B] transition-colors hover:bg-[#ECE8FD] md:inline-flex"
          >
            Solicitar una demo
          </a>
          <MenuMovil enlaces={enlaces} />
        </div>
      </nav>
    </header>
  );
}
