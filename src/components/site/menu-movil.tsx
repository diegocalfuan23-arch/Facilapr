"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Enlace = { href: string; label: string; title: string };

/**
 * Menú del encabezado en el celular. Ahí no caben los enlaces de la barra, y sin
 * este menú no había forma de llegar al acceso ni al registro. Al tocar un enlace
 * se cierra, para que los que van a una sección de la misma página no la tapen.
 */
export function MenuMovil({ enlaces }: { enlaces: Enlace[] }) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => setAbierto(false);

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" aria-label="Abrir menú" className="sm:hidden" />}
      >
        <Menu />
      </SheetTrigger>

      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Menú</SheetTitle>
        </SheetHeader>

        <nav aria-label="Menú principal" className="flex flex-col gap-8 px-4 pb-6">
          <div className="flex flex-col">
            {enlaces.map((enlace) => (
              <a
                key={enlace.href}
                href={enlace.href}
                title={enlace.title}
                onClick={cerrar}
                className="py-2 text-base text-foreground"
              >
                {enlace.label}
              </a>
            ))}
            <Link
              href="/socios"
              onClick={cerrar}
              className="py-2 text-base font-medium text-foreground"
            >
              Soy socio · Paga tu boleta
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            <Link
              href="/registro"
              onClick={cerrar}
              className={cn(buttonVariants({ size: "lg" }), "justify-center")}
            >
              Crear cuenta
            </Link>
            <Link
              href="/login"
              onClick={cerrar}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "justify-center")}
            >
              Acceso APR
            </Link>
            <a
              href="#contacto"
              onClick={cerrar}
              className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "justify-center")}
            >
              Solicitar una demo
            </a>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
