"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { guardarLogo, quitarLogo } from "@/app/panel/configuracion/logo-actions";
import { Button } from "@/components/ui/button";
import { LOGO_MAX_BYTES } from "@/lib/logo";

/** Lados a los que se intenta achicar: el primero que quede liviano se usa. */
const LADOS = [320, 220, 150, 120, 96];

/**
 * Un SVG como imagen lista para dibujar. Muchos no traen ancho ni alto (solo viewBox), así que se les pone
 * el tamaño más grande que se va a usar. Cargado como imagen, el SVG no ejecuta código.
 */
async function leerSvg(archivo: File): Promise<HTMLImageElement | null> {
  const doc = new DOMParser().parseFromString(await archivo.text(), "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName !== "svg") return null;

  const caja = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const medida = (nombre: string) => {
    const v = svg.getAttribute(nombre);
    return v && !v.endsWith("%") ? parseFloat(v) : 0;
  };
  const ancho = caja?.[2] || medida("width");
  const alto = caja?.[3] || medida("height");
  if (ancho > 0 && alto > 0) {
    if (!caja) svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);
    const k = LADOS[0] / Math.max(ancho, alto);
    svg.setAttribute("width", String(Math.round(ancho * k)));
    svg.setAttribute("height", String(Math.round(alto * k)));
  }

  const imagen = new Image();
  imagen.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(doc))}`;
  return imagen.decode().then(
    () => imagen,
    () => null
  );
}

/**
 * Achica la imagen en el navegador a un PNG chico (conserva la transparencia).
 * Así el comité puede subir la foto del logo tal cual la tiene, sin saber de tamaños.
 */
async function achicar(archivo: File): Promise<string | null> {
  const esSvg = archivo.type === "image/svg+xml" || /\.svg$/i.test(archivo.name);
  const bitmap = esSvg ? await leerSvg(archivo) : await createImageBitmap(archivo).catch(() => null);
  if (!bitmap) return null;

  for (const lado of LADOS) {
    const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(bitmap.width * escala));
    lienzo.height = Math.max(1, Math.round(bitmap.height * escala));
    lienzo.getContext("2d")?.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);

    const url = lienzo.toDataURL("image/png");
    // El base64 pesa un tercio más que los bytes que representa.
    if ((url.length * 3) / 4 <= LOGO_MAX_BYTES) return url;
  }
  return null;
}

/**
 * El logo del comité en Configuración: se sube, se ve y se quita. Aparece en los
 * recibos y comprobantes. Guarda al elegir el archivo, sin otro botón.
 */
export function LogoComite({ logoUrl }: { logoUrl: string | null }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [pendiente, iniciar] = useTransition();
  const [vista, setVista] = useState(logoUrl);

  function elegido(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    iniciar(async () => {
      const url = await achicar(archivo);
      if (!url) {
        toast.error("No pudimos leer esa imagen. Prueba con un PNG, JPG o SVG más simple.");
        return;
      }
      const r = await guardarLogo(url);
      if (r.ok) {
        setVista(url);
        toast.success("Logo guardado");
      } else {
        toast.error(r.error);
      }
    });
  }

  function quitar() {
    iniciar(async () => {
      const r = await quitarLogo();
      if (r.ok) {
        setVista(null);
        toast.success("Logo quitado");
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
        {vista ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vista} alt="Logo del comité" className="max-h-full max-w-full object-contain" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[0.9rem] font-medium">Logo del comité</div>
        <p className="text-[0.8rem] text-muted-foreground">
          Sale en tus recibos y comprobantes. PNG, JPG o SVG.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pendiente} onClick={() => entrada.current?.click()}>
            {pendiente ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {vista ? "Cambiar" : "Subir logo"}
          </Button>
          {vista && (
            <Button type="button" variant="ghost" size="sm" disabled={pendiente} onClick={quitar}>
              <Trash2 />
              Quitar
            </Button>
          )}
        </div>
        <input
          ref={entrada}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,.svg"
          className="hidden"
          onChange={elegido}
        />
      </div>
    </div>
  );
}
