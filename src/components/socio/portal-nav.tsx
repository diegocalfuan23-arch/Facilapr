"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { FileText, Home, LifeBuoy, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { clave: "resumen", sufijo: "", texto: "Inicio", Icono: Home },
  { clave: "boletas", sufijo: "/boletas", texto: "Boletas", Icono: FileText },
  { clave: "pagos", sufijo: "/pagos", texto: "Pagos", Icono: Wallet },
  { clave: "solicitudes", sufijo: "/solicitudes", texto: "Solicitudes", Icono: LifeBuoy },
] as const;

/**
 * Menú del portal: cada ítem es una pantalla. En escritorio va en vertical dentro del menú lateral; en el celular, como
 * barra de pestañas abajo. La pantalla activa se reconoce por el final de la dirección, que es igual con o sin subdominio
 * (/cuenta/boletas o /quema/cuenta/boletas).
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
  variante = "lateral",
  novedad = null,
  pendientes = 0,
}: {
  base: string;
  variante?: "lateral" | "inferior";
  /** Cuándo cambió por última vez algo en sus solicitudes (ISO); null si no hay. */
  novedad?: string | null;
  /** Cuántas boletas tiene por pagar: se marca junto a «Boletas». */
  pendientes?: number;
}) {
  const visto = useVisto();
  const ruta = usePathname().replace(/\/+$/, "");
  const activa = ruta.endsWith("/boletas") ? "boletas" : ruta.endsWith("/pagos") ? "pagos" : ruta.endsWith("/solicitudes") ? "solicitudes" : "resumen";

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

  if (variante === "inferior") {
    return (
      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#E9E6F3] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {ITEMS.map(({ clave, sufijo, texto, Icono }) => (
          <Link
            key={clave}
            href={`${base}${sufijo}`}
            aria-current={activa === clave ? "page" : undefined}
            className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", activa === clave ? "text-[#2A07A8]" : "text-[#6E6B82]")}
          >
            {activa === clave ? <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-[#3A0CE3]" /> : null}
            <span className="relative">
              <Icono className="size-5" aria-hidden />
              {clave === "boletas" && pendientes > 0 ? <span aria-label={`${pendientes} por pagar`} className="absolute -top-1 -right-2 size-2 rounded-full bg-[#F0A23C] ring-2 ring-white" /> : null}
              {clave === "solicitudes" && hayNovedad ? <span aria-label="Hay novedades" className="absolute -top-1 -right-2 size-2 rounded-full bg-[#3A0CE3] ring-2 ring-white" /> : null}
            </span>
            {texto}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Secciones" className="mt-8 flex flex-col gap-1">
      {ITEMS.map(({ clave, sufijo, texto, Icono }) => (
        <Link
          key={clave}
          href={`${base}${sufijo}`}
          aria-current={activa === clave ? "page" : undefined}
          className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors", activa === clave ? "bg-[#ECE8FD] text-[#2A07A8]" : "text-[#3F3C55] hover:bg-[#F4F3F9]")}
        >
          <Icono className="size-[18px]" aria-hidden />
          {texto}
          {clave === "boletas" && pendientes > 0 ? <span aria-label={`${pendientes} por pagar`} className="ml-auto flex size-5 items-center justify-center rounded-full bg-[#FFE7C2] text-[11px] font-bold text-[#8A4B00]">{pendientes}</span> : null}
          {clave === "solicitudes" && hayNovedad ? <span aria-label="Hay novedades" className="ml-auto size-2 rounded-full bg-[#3A0CE3]" /> : null}
        </Link>
      ))}
    </nav>
  );
}
