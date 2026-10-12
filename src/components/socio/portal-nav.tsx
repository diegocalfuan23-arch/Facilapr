"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { LayoutDashboard, LifeBuoy, Receipt, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { clave: "resumen", sufijo: "", texto: "Resumen", Icono: LayoutDashboard },
  { clave: "boletas", sufijo: "/boletas", texto: "Boletas", Icono: Receipt },
  { clave: "pagos", sufijo: "/pagos", texto: "Pagos", Icono: Wallet },
  { clave: "solicitudes", sufijo: "/solicitudes", texto: "Solicitudes", Icono: LifeBuoy },
] as const;

/**
 * Menú del portal: cada ítem es una pantalla. En escritorio va en vertical
 * dentro del menú lateral; en el celular, como pestañas bajo el encabezado.
 * La pantalla activa se reconoce por el final de la dirección, que es igual
 * con o sin subdominio (/cuenta/boletas o /quema/cuenta/boletas).
 */
const CLAVE_VISTO = "facilapr-solicitudes-vistas";
const EVENTO_VISTO = "facilapr-solicitudes-vistas-cambio";

/** Cuándo el socio miró por última vez sus solicitudes. Vive en este navegador: no hace falta guardarlo en la base. */
function useVisto() {
  return useSyncExternalStore(
    (avisar) => {
      window.addEventListener("storage", avisar);
      window.addEventListener(EVENTO_VISTO, avisar);
      return () => {
        window.removeEventListener("storage", avisar);
        window.removeEventListener(EVENTO_VISTO, avisar);
      };
    },
    () => {
      try {
        return localStorage.getItem(CLAVE_VISTO) ?? "";
      } catch {
        return "";
      }
    },
    () => ""
  );
}

export function PortalNav({
  base,
  horizontal = false,
  novedad = null,
}: {
  base: string;
  horizontal?: boolean;
  /** Cuándo cambió por última vez algo en sus solicitudes (ISO); null si no hay. */
  novedad?: string | null;
}) {
  const visto = useVisto();
  const ruta = usePathname().replace(/\/+$/, "");
  const activa = ruta.endsWith("/boletas")
    ? "boletas"
    : ruta.endsWith("/pagos")
      ? "pagos"
      : ruta.endsWith("/solicitudes")
        ? "solicitudes"
        : "resumen";

  // Al abrir Solicitudes se marca todo como visto; en las demás pantallas, un punto avisa de lo nuevo.
  const hayNovedad = Boolean(novedad) && activa !== "solicitudes" && (visto === "" || novedad! > visto);
  useEffect(() => {
    if (activa !== "solicitudes" || !novedad || visto >= novedad) return;
    try {
      localStorage.setItem(CLAVE_VISTO, novedad);
      window.dispatchEvent(new Event(EVENTO_VISTO));
    } catch {
      // Sin almacenamiento, el punto seguirá apareciendo.
    }
  }, [activa, novedad, visto]);

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
          {clave === "solicitudes" && hayNovedad && (
            <span aria-label="Hay novedades" className="size-2 rounded-full bg-primary" />
          )}
        </Link>
      ))}
    </nav>
  );
}
