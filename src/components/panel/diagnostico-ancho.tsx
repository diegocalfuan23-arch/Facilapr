"use client";

import { useEffect, useState } from "react";

/**
 * Herramienta temporal para encontrar qué elemento hace la página más ancha
 * que la pantalla. Solo se activa con ?diagnostico=1 en la dirección y muestra
 * el ancho de la ventana y los elementos que se pasan del borde derecho.
 */
export function DiagnosticoAncho() {
  const [lineas, setLineas] = useState<string[] | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("diagnostico") !== "1") return;

    const medir = () => {
      const ancho = window.innerWidth;
      const raiz = document.documentElement;
      const salida: string[] = [
        `ventana: ${ancho}px · cliente: ${raiz.clientWidth}px · scroll: ${raiz.scrollWidth}px · zoom: ${window.devicePixelRatio}`,
      ];
      const pasados: { r: number; l: string }[] = [];
      document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
        if (el.closest("[data-diagnostico]")) return;
        const caja = el.getBoundingClientRect();
        if (caja.width === 0 || caja.right <= ancho + 1) return;
        const clase = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 6).join(" ");
        pasados.push({
          r: Math.round(caja.right),
          l: `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} [${clase}] ancho ${Math.round(caja.width)} → borde ${Math.round(caja.right)}`,
        });
      });
      // Los más externos primero: son los que arrastran al resto.
      pasados.sort((a, b) => b.r - a.r);
      salida.push(`elementos que se pasan: ${pasados.length}`);
      pasados.slice(0, 12).forEach((p) => salida.push(p.l));
      setLineas(salida);
    };

    const t = window.setTimeout(medir, 1500);
    return () => window.clearTimeout(t);
  }, []);

  if (!lineas) return null;
  return (
    <pre
      data-diagnostico
      className="fixed inset-x-0 top-0 z-[100] max-h-[60vh] overflow-auto bg-black/90 p-2 text-[10px] leading-tight whitespace-pre-wrap text-green-300"
    >
      {lineas.join("\n")}
    </pre>
  );
}
