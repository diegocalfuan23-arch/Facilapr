"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/**
 * Video de YouTube que no carga nada hasta que se le da play: así la guía abre
 * rápido y no se instalan cookies de YouTube sin que el usuario lo pida.
 */
export function VideoYoutube({ id, titulo }: { id: string; titulo: string }) {
  const [activo, setActivo] = useState(false);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
      {activo ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={titulo}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActivo(true)}
          aria-label={`Reproducir el video: ${titulo}`}
          className="group absolute inset-0 size-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
            <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-105">
              <Play className="size-7 translate-x-0.5 fill-current" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
