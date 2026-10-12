"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearRut } from "@/lib/formato";
import { cn } from "@/lib/utils";

export type OpcionSocio = {
  id: string;
  nombre: string;
  rut: string | null;
  numeroCliente?: string | null;
  tipo?: "SOCIO" | "USUARIO";
  /** Para qué se usa el agua: de ahí sale la tarifa que se le aplica. */
  uso?: "RESIDENCIAL" | "COMERCIAL";
  /** Su ultima lectura aprobada, si la pantalla la necesita (p. ej. nueva boleta). */
  ultimaLectura?: number | null;
};

const sinTildes = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** "6.688.154-7 · N.º 3 · Usuario": lo que distingue a un arranque de otro. */
function detalle(s: OpcionSocio) {
  return [
    s.rut ? formatearRut(s.rut) : "Sin RUT",
    s.numeroCliente ? `N.º ${s.numeroCliente}` : null,
    s.tipo === "USUARIO" ? "Usuario" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Elegir un socio escribiendo: con cientos de arranques, una lista desplegable
 * es inmanejable. Busca por nombre, RUT (con o sin puntos) o N.º de arranque.
 * Escribe el id elegido en un campo oculto `name`, así funciona dentro de un
 * <form> igual que un <select>. La lista se despliega en el flujo (no flotando)
 * para que no la recorte un diálogo.
 */
export function SocioBuscador({
  socios,
  name = "socioId",
  label = "Socio",
  defaultId,
  onElegir,
  className,
}: {
  socios: OpcionSocio[];
  name?: string;
  label?: string;
  /** Socio ya elegido al abrir (al editar una boleta). */
  defaultId?: string;
  onElegir?: (socio: OpcionSocio | null) => void;
  /** Clases del campo de texto (p. ej. más alto en el teléfono). */
  className?: string;
}) {
  const idCampo = useId();
  const campo = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [elegido, setElegido] = useState<OpcionSocio | null>(
    () => socios.find((s) => s.id === defaultId) ?? null
  );
  const [abierto, setAbierto] = useState(false);

  const resultados = useMemo(() => {
    const t = sinTildes(texto.trim());
    if (!t) return socios.slice(0, 50);
    return socios
      .filter((s) =>
        sinTildes(
          `${s.nombre} ${s.rut ?? ""} ${s.rut ? formatearRut(s.rut) : ""} ${s.numeroCliente ?? ""}`
        ).includes(t)
      )
      .slice(0, 50);
  }, [socios, texto]);

  // Avisa si se intenta enviar sin haber elegido de la lista.
  useEffect(() => {
    campo.current?.setCustomValidity(elegido ? "" : "Elige un socio de la lista.");
  }, [elegido, texto]);

  function elegir(s: OpcionSocio | null) {
    setElegido(s);
    onElegir?.(s);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={idCampo}>{label}</Label>
      <input type="hidden" name={name} value={elegido?.id ?? ""} />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={campo}
          id={idCampo}
          value={elegido ? elegido.nombre : texto}
          onChange={(e) => {
            elegir(null);
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          // Con retraso, para que el toque en un resultado llegue antes de cerrar.
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder="Busca por nombre, RUT o N.º…"
          autoComplete="off"
          required
          className={cn("pl-9", className)}
        />
        {elegido && (
          <button
            type="button"
            aria-label="Quitar el socio elegido"
            onClick={() => {
              elegir(null);
              setTexto("");
              setAbierto(true);
              campo.current?.focus();
            }}
            className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {elegido && (
        <p className="text-[0.8rem] text-muted-foreground">{detalle(elegido)}</p>
      )}

      {abierto && !elegido && (
        <ul className="max-h-56 overflow-y-auto rounded-lg border border-border bg-popover">
          {resultados.length === 0 ? (
            <li className="px-3 py-2.5 text-[0.88rem] text-muted-foreground">
              {socios.length === 0
                ? "Aún no hay socios cargados."
                : "Ningún socio coincide."}
            </li>
          ) : (
            resultados.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    elegir(s);
                    setAbierto(false);
                  }}
                  className="flex min-h-11 w-full flex-col items-start justify-center border-b border-border/50 px-3 py-1.5 text-left last:border-b-0 hover:bg-muted active:bg-muted"
                >
                  <span className="text-[0.9rem] font-medium">{s.nombre}</span>
                  <span className="text-[0.76rem] text-muted-foreground">
                    {detalle(s)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
