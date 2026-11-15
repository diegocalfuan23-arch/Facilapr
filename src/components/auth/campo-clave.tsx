"use client";

import { useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generarClave } from "@/lib/clave";

/**
 * Campo de contraseña con ayuda: ver/ocultar y "Sugerir una clave segura".
 * Al sugerir, la clave se escribe en el campo (y en el de confirmación, si hay),
 * se muestra y se puede copiar: es la única vez que se ve completa.
 */
export function CampoClave({
  id,
  name,
  label,
  ayuda,
  confirmarId,
  className,
  inputClassName,
  labelClassName,
}: {
  id: string;
  name: string;
  label: string;
  /** Texto de ayuda bajo el campo; por defecto, el mínimo de caracteres. */
  ayuda?: string;
  /** id del campo "repite la contraseña", para rellenarlo igual. */
  confirmarId?: string;
  className?: string;
  /** Estilo del campo y de la etiqueta, para los formularios de acceso (mismo aspecto que el login). */
  inputClassName?: string;
  labelClassName?: string;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [mostrar, setMostrar] = useState(false);
  const [sugerida, setSugerida] = useState(false);
  const [copiada, setCopiada] = useState(false);

  function sugerir() {
    const clave = generarClave();
    if (campo.current) campo.current.value = clave;
    if (confirmarId) {
      const otro = document.getElementById(confirmarId) as HTMLInputElement | null;
      if (otro) otro.value = clave;
    }
    setMostrar(true);
    setSugerida(true);
    setCopiada(false);
  }

  async function copiar() {
    const clave = campo.current?.value ?? "";
    try {
      await navigator.clipboard.writeText(clave);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      // Sin permiso para el portapapeles: la clave queda visible para copiarla a mano.
    }
  }

  return (
    <div className={className ?? "flex flex-col gap-1.5"}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className={labelClassName}>{label}</Label>
        <button
          type="button"
          onClick={sugerir}
          className="inline-flex items-center gap-1 text-[0.8rem] font-medium text-primary hover:underline"
        >
          <Sparkles className="size-3.5" />
          Sugerir una clave segura
        </button>
      </div>

      <div className="relative">
        <Input
          ref={campo}
          id={id}
          name={name}
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          minLength={8}
          className={inputClassName ?? "h-10 pr-20"}
          required
        />
        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
          {sugerida && (
            <button
              type="button"
              onClick={copiar}
              aria-label="Copiar la clave"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              {copiada ? <Check className="size-4 text-forest" /> : <Copy className="size-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            aria-label={mostrar ? "Ocultar la contraseña" : "Mostrar la contraseña"}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <span className="text-[0.8rem] text-muted-foreground">
        {sugerida
          ? "Guárdala en un lugar seguro: no podremos mostrártela de nuevo."
          : (ayuda ?? "Mínimo 8 caracteres.")}
      </span>
    </div>
  );
}
