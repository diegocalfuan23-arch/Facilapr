"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { clave: "resumen", sufijo: "", texto: "Resumen", Icono: LayoutDashboard },
  { clave: "boletas", sufijo: "/boletas", texto: "Boletas", Icono: Receipt },
  { clave: "pagos", sufijo: "/pagos", texto: "Pagos", Icono: Wallet },
] as const;

/**
 * Menú del portal: cada ítem es una pantalla. En escritorio va en vertical
 * dentro del menú lateral; en el celular, como pestañas bajo el encabezado.
 * La pantalla activa se reconoce por el final de la dirección, que es igual
 * con o sin subdominio (/cuenta/boletas o /quema/cuenta/boletas).
 */
export function PortalNav({
  base,
  horizontal = false,
}: {
  base: string;
  horizontal?: boolean;
}) {
  const ruta = usePathname().replace(/\/+$/, "");
  const activa = ruta.endsWith("/boletas")
    ? "boletas"
    : ruta.endsWith("/pagos")
      ? "pagos"
      : "resumen";

  return (
    <nav
      className={cn(
        horizontal
          ? "mx-auto flex max-w-[720px] gap-1 px-4 pb-2 text-[0.88rem]"
          : "flex flex-col gap-1 p-3 text-[0.92rem]"
      )}
    >
      {ITEMS.map(({ clave, sufijo, texto, Icono }) => (
        <Link
          key={clave}
          href={`${base}${sufijo}`}
          aria-current={activa === clave ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium transition-colors",
            horizontal && "flex-1 justify-center gap-1.5 px-2 py-2",
            activa === clave
              ? "bg-primary/10 text-primary"
              : "text-foreground/75 hover:bg-muted hover:text-foreground"
          )}
        >
          <Icono className="size-[18px]" />
          {texto}
        </Link>
      ))}
    </nav>
  );
}
