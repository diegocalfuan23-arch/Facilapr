"use client";

import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { SitioApr, type AvisoSitio, type DatosSitio } from "@/components/sitio/sitio-apr";
import type { ImagenesDelSitio } from "@/lib/sitio-imagenes-comun";

/** El ancho con que se dibuja el sitio antes de achicarlo: el de un computador. */
const ANCHO_SITIO = 1180;

/** El sitio público dibujado en chico, con lo que se va escribiendo. No es interactivo. */
export function SitioVistaPrevia({ apr, avisos, imagenes }: { apr: DatosSitio; avisos: AvisoSitio[]; imagenes: ImagenesDelSitio }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const contenido = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.4);
  const [alto, setAlto] = useState(600);

  useEffect(() => {
    const caja = contenedor.current;
    const interior = contenido.current;
    if (!caja || !interior) return;
    const medir = () => {
      setEscala(caja.clientWidth / ANCHO_SITIO);
      setAlto(interior.scrollHeight);
    };
    medir();
    const o = new ResizeObserver(medir);
    o.observe(caja);
    o.observe(interior);
    return () => o.disconnect();
  }, []);

  return (
    <section className="lg:sticky lg:top-4">
      <div className="mb-2 flex items-center gap-2 text-[0.8rem] font-medium text-muted-foreground">
        <Eye className="size-4" />
        Así se ve tu sitio
      </div>
      <div ref={contenedor} className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div style={{ height: Math.min(alto * escala, 720), overflow: "hidden" }}>
          <div
            ref={contenido}
            inert
            aria-hidden
            style={{ width: ANCHO_SITIO, transform: `scale(${escala})`, transformOrigin: "top left" }}
          >
            <SitioApr apr={apr} avisos={avisos} imagenes={imagenes} vistaPrevia />
          </div>
        </div>
      </div>
    </section>
  );
}
