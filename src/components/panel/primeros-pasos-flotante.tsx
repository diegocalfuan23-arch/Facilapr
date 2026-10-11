"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Check, Compass, Rocket, X } from "lucide-react";
import {
  progresoPrimerosPasos,
  type ProgresoPrimerosPasos,
} from "@/app/panel/primeros-pasos-actions";
import { lanzarRecorrido } from "@/components/panel/recorrido";
import { RECORRIDOS } from "@/lib/recorridos";
import { cn } from "@/lib/utils";

const RADIO = 22;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

/**
 * Ayuda flotante del panel, abajo a la derecha, en todas las pantallas.
 *
 *  - Botón principal: tus primeros pasos (con anillo de avance) y el recorrido
 *    por el menú. Cuando lo esencial ya está hecho, queda como brújula, solo
 *    para repasar el menú.
 *  - Botón «?»: aparece en las pantallas que tienen recorrido propio y explica,
 *    parte por parte, qué muestra esa pantalla.
 */
export function PrimerosPasosFlotante() {
  const pathname = usePathname();
  const [datos, setDatos] = useState<ProgresoPrimerosPasos | null>(null);
  const [cargado, setCargado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [vistas, setVistas] = useState<Set<string>>(new Set());
  const caja = useRef<HTMLDivElement>(null);

  // El avance se vuelve a leer al cambiar de pantalla: hacer un paso lo marca.
  useEffect(() => {
    let vivo = true;
    progresoPrimerosPasos()
      .then((d) => {
        if (!vivo) return;
        setDatos(d);
        setCargado(true);
      })
      .catch(() => vivo && setCargado(true));
    return () => {
      vivo = false;
    };
  }, [pathname]);

  // Cerrar al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", afuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", afuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  // Qué pantallas ya usaron el «?», para quitarle el destello.
  useEffect(() => {
    try {
      const guardadas = localStorage.getItem("facilapr-ayuda-pantallas");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (guardadas) setVistas(new Set(JSON.parse(guardadas) as string[]));
    } catch {
      // Sin almacenamiento, el destello vuelve a salir: no es grave.
    }
  }, []);

  if (!cargado) return null;

  const recorridoDePantalla = RECORRIDOS.find(
    (r) => r.ruta === pathname && r.id !== "resumen"
  );

  function explicarPantalla() {
    if (!recorridoDePantalla) return;
    lanzarRecorrido(recorridoDePantalla.id);
    const sig = new Set(vistas).add(recorridoDePantalla.id);
    setVistas(sig);
    try {
      localStorage.setItem("facilapr-ayuda-pantallas", JSON.stringify([...sig]));
    } catch {
      // Da igual.
    }
  }

  const pasos = datos?.pasos ?? [];
  const hechos = datos?.hechos ?? 0;
  const total = datos?.total ?? 0;
  const siguiente = pasos.find((p) => !p.hecho && !p.opcional);
  const porcentaje = total > 0 ? hechos / total : 1;
  const nuevaAqui = recorridoDePantalla && !vistas.has(recorridoDePantalla.id);

  return (
    <div
      ref={caja}
      className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3"
    >
      {abierto && (
        <section
          aria-label="Ayuda del panel"
          className="w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-border bg-card p-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {datos ? <Rocket className="size-4" /> : <Compass className="size-4" />}
              </span>
              <div>
                <h2 className="text-[0.98rem] leading-tight font-semibold">
                  {datos ? "Empieza a usar Facilapr" : "Ayuda"}
                </h2>
                {datos && (
                  <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
                    {hechos} de {total} pasos listos
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              lanzarRecorrido("resumen");
            }}
            className="mt-3 flex w-full items-center gap-2.5 rounded-lg border border-primary/25 bg-primary/[0.05] px-3 py-2.5 text-left hover:bg-primary/[0.09]"
          >
            <Compass className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.86rem] font-medium">
                Conocer el menú
              </span>
              <span className="block text-[0.76rem] text-muted-foreground">
                Para qué sirve cada sección, en una frase.
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-primary" />
          </button>

          {datos && (
            <>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/15"
                role="progressbar"
                aria-valuenow={Math.round(porcentaje * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${porcentaje * 100}%` }}
                />
              </div>

              <ol className="mt-3 flex max-h-[45vh] flex-col overflow-y-auto">
                {pasos.map((p, i) => {
                  const esSiguiente = p.id === siguiente?.id;
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "flex gap-3 border-b border-border/60 py-3 last:border-0",
                        esSiguiente && "rounded-lg bg-primary/[0.05] px-2"
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[0.72rem] font-semibold",
                          p.hecho
                            ? "bg-forest text-white"
                            : esSiguiente
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {p.hecho ? <Check className="size-3.5" /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "text-[0.88rem] leading-snug font-medium",
                            p.hecho && "text-muted-foreground line-through"
                          )}
                        >
                          {p.titulo}
                          {p.opcional && (
                            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-normal text-muted-foreground no-underline">
                              Opcional
                            </span>
                          )}
                        </div>
                        {!p.hecho && (
                          <>
                            <p className="mt-0.5 text-[0.78rem] leading-relaxed text-muted-foreground">
                              {p.texto}
                            </p>
                            <div className="mt-2">
                              <Link
                                href={p.href}
                                onClick={() => setAbierto(false)}
                                className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[0.78rem] font-medium text-primary-foreground hover:bg-primary/90"
                              >
                                Ir
                                <ArrowRight className="size-3" />
                              </Link>
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}

          <div className="mt-2 flex justify-end border-t border-border/60 pt-3">
            <Link
              href="/panel/ayuda"
              onClick={() => setAbierto(false)}
              className="text-[0.8rem] text-muted-foreground hover:text-foreground hover:underline"
            >
              Todos los recorridos
            </Link>
          </div>
        </section>
      )}

      <div className="flex items-center gap-3">
        {recorridoDePantalla && (
          <button
            type="button"
            data-tour="ayuda-pantalla"
            onClick={explicarPantalla}
            aria-label={`Explicar esta pantalla: ${recorridoDePantalla.titulo}`}
            title="Explicar esta pantalla"
            className="relative flex size-11 items-center justify-center rounded-full border border-border bg-card text-[1.15rem] font-semibold text-primary shadow-lg ring-4 ring-background transition-transform hover:scale-105"
          >
            ?
            {nuevaAqui && (
              <span className="absolute -top-0.5 -right-0.5 flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-3 rounded-full bg-primary" />
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          data-tour="primeros-pasos"
          onClick={() => setAbierto((v) => !v)}
          aria-label={
            datos
              ? `Primeros pasos: ${hechos} de ${total} listos`
              : "Ayuda: conocer el menú"
          }
          aria-expanded={abierto}
          className="relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform hover:scale-105"
        >
          {datos ? (
            <>
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden>
                <circle
                  cx="28"
                  cy="28"
                  r={RADIO}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="3.5"
                />
                <circle
                  cx="28"
                  cy="28"
                  r={RADIO}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUNFERENCIA}
                  strokeDashoffset={CIRCUNFERENCIA * (1 - porcentaje)}
                  className="transition-all"
                />
              </svg>
              <span className="relative text-[0.82rem] font-semibold tabular-nums">
                {hechos}/{total}
              </span>
            </>
          ) : (
            <Compass className="size-6" />
          )}
        </button>
      </div>
    </div>
  );
}
