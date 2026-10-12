"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, Receipt, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { id: "resumen", texto: "Resumen", Icono: LayoutDashboard },
  { id: "boletas", texto: "Boletas", Icono: Receipt },
  { id: "pagos", texto: "Pagos", Icono: Wallet },
] as const;

/**
 * Menú del portal en escritorio. Resalta la sección que se está viendo y al
 * tocar un ítem baja suavemente hasta ella.
 */
export function PortalNav() {
  const [activo, setActivo] = useState<string>("resumen");

  useEffect(() => {
    const secciones = ITEMS.map((i) => document.getElementById(i.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (secciones.length === 0) return;

    // Cuenta como «la que se está viendo» la última sección cuyo borde superior
    // ya pasó el tercio superior de la pantalla.
    const calcular = () => {
      const linea = window.innerHeight * 0.33;
      let actual = secciones[0].id;
      for (const el of secciones) {
        if (el.getBoundingClientRect().top <= linea) actual = el.id;
      }
      // Al fondo de la página, la última sección gana aunque sea corta.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        actual = secciones[secciones.length - 1].id;
      }
      setActivo(actual);
    };

    calcular();
    window.addEventListener("scroll", calcular, { passive: true });
    window.addEventListener("resize", calcular);
    return () => {
      window.removeEventListener("scroll", calcular);
      window.removeEventListener("resize", calcular);
    };
  }, []);

  return (
    <nav className="flex flex-col gap-1 p-3 text-[0.92rem]">
      {ITEMS.map(({ id, texto, Icono }) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={activo === id ? "true" : undefined}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            setActivo(id);
          }}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium transition-colors",
            activo === id
              ? "bg-primary/10 text-primary"
              : "text-foreground/75 hover:bg-muted hover:text-foreground"
          )}
        >
          <Icono className="size-[18px]" />
          {texto}
        </a>
      ))}
    </nav>
  );
}
