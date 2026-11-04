"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { guardarLogo, quitarLogo } from "@/app/panel/configuracion/logo-actions";
import { Button } from "@/components/ui/button";
import { LOGO_MAX_BYTES } from "@/lib/logo";

/** Lados a los que se intenta achicar: el primero que quede liviano se usa. */
const LADOS = [320, 220, 150];

/**
 * Achica la imagen en el navegador a un PNG chico (conserva la transparencia).
 * Así el comité puede subir la foto del logo tal cual la tiene, sin saber de tamaños.
 */
async function achicar(archivo: File): Promise<string | null> {
  const bitmap = await createImageBitmap(archivo).catch(() => null);
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
        toast.error("No pudimos leer esa imagen. Prueba con un PNG o JPG más simple.");
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
          Sale en tus recibos y comprobantes. Sube un PNG o JPG; si tiene fondo transparente, mejor.
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
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={elegido}
        />
      </div>
    </div>
  );
}
