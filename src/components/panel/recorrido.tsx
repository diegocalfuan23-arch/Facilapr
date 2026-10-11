"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useSidebar } from "@/components/ui/sidebar";
import {
  marcarRecorridoVisto,
  recorridoYaVisto,
} from "@/app/panel/recorrido-actions";
import { progresoPrimerosPasos } from "@/app/panel/primeros-pasos-actions";
import {
  recorridoPorId,
  type PasoRecorrido,
  type Recorrido as DatosRecorrido,
} from "@/lib/recorridos";
import { cn } from "@/lib/utils";

const EVENTO = "facilapr:recorrido";

/** Pide un recorrido desde cualquier parte; si está en otra pantalla, se navega primero. */
export function lanzarRecorrido(id: string) {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: id }));
}

/** Botón que lanza un recorrido. */
export function BotonGuia({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => lanzarRecorrido(id)}
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.85rem] font-medium text-primary hover:underline",
        className
      )}
    >
      {children}
    </button>
  );
}

const pulsar = (selector: string) =>
  (document.querySelector(selector) as HTMLElement | null)?.click();

const esperar = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/**
 * Motor de los recorridos guiados (ver lib/recorridos.ts). Va montado una vez
 * en el panel de la directiva:
 *  - escucha los pedidos de recorrido (botones «Guíame», «Ayuda»),
 *  - si el recorrido es de otra pantalla, navega y lo arranca al llegar,
 *  - lanza solo el recorrido general la primera vez que alguien entra.
 */
export function Recorrido({ usuarioId }: { usuarioId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpen, isMobile } = useSidebar();
  const activo = useRef<ReturnType<typeof driver> | null>(null);
  const rutaActual = useRef(pathname);
  // El general conserva la clave de siempre; cada pantalla tiene la suya.
  const claveVisto = useCallback(
    (id: string) =>
      id === "resumen"
        ? `facilapr-recorrido-visto-${usuarioId}`
        : `facilapr-recorrido-visto-${usuarioId}-${id}`,
    [usuarioId]
  );
  useEffect(() => {
    rutaActual.current = pathname;
  }, [pathname]);

  const empezar = useCallback(
    async (r: DatosRecorrido) => {
      if (activo.current?.isActive()) activo.current.destroy();

      // El menú colapsado no tiene los ítems a la vista: se abre primero.
      if (!isMobile) setOpen(true);

      // Esperar a que la pantalla tenga lo que el primer paso necesita.
      const primero = r.pasos.find((p) => p.selector || p.clic);
      const clave = primero?.clic ?? primero?.selector;
      for (let i = 0; clave && i < 30; i++) {
        if (document.querySelector(clave)) break;
        await esperar(150);
      }
      await esperar(350);

      // Un elemento oculto (por ejemplo la tabla en el celular) no se puede
      // resaltar: ese paso se omite.
      const visible = (selector: string) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        return Boolean(el && el.getClientRects().length > 0);
      };
      const pasos: PasoRecorrido[] = r.pasos.filter(
        (p) => !p.selector || p.clic || visible(p.selector)
      );
      if (pasos.length === 0) return;

      try {
        localStorage.setItem(claveVisto(r.id), "1");
      } catch {
        // Sin almacenamiento, podría volver a salir: no es grave.
      }

      const steps: DriveStep[] = pasos.map((p, i) => ({
        element: p.selector,
        popover: {
          title: p.titulo,
          description: p.texto,
          side: p.lado ?? "right",
          align: "start",
          // Cambiar de pestaña antes de mostrar el paso, en los dos sentidos.
          onNextClick: async () => {
            const sig = pasos[i + 1];
            if (!sig) return activo.current?.destroy();
            if (sig.clic) {
              pulsar(sig.clic);
              await esperar(300);
            }
            activo.current?.moveNext();
          },
          onPrevClick: async () => {
            const ant = pasos[i - 1];
            if (!ant) return;
            if (ant.clic) {
              pulsar(ant.clic);
              await esperar(300);
            }
            activo.current?.movePrevious();
          },
        },
      }));

      const recorrido = driver({
        steps,
        showProgress: true,
        progressText: "{{current}} de {{total}}",
        nextBtnText: "Siguiente",
        prevBtnText: "Atrás",
        doneBtnText: "Listo",
        popoverClass: "facilapr-tour",
        overlayOpacity: 0.55,
        stagePadding: 6,
        stageRadius: 10,
        allowClose: true,
      });
      activo.current = recorrido;

      if (pasos[0].clic) {
        pulsar(pasos[0].clic);
        await esperar(300);
      }
      recorrido.drive();
    },
    [isMobile, setOpen, claveVisto]
  );

  // Pedidos de recorrido desde botones.
  useEffect(() => {
    const alPedirlo = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const r = recorridoPorId(id);
      if (!r) return;
      if (rutaActual.current !== r.ruta) {
        router.push(`${r.ruta}?recorrido=${id}`);
      } else {
        void empezar(r);
      }
    };
    window.addEventListener(EVENTO, alPedirlo);
    return () => window.removeEventListener(EVENTO, alPedirlo);
  }, [empezar, router]);

  // Llegada desde otra pantalla: la dirección trae ?recorrido=<id>.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("recorrido");
    if (!id) return;
    const r = recorridoPorId(id);
    // Se limpia la dirección para que recargar no repita el recorrido.
    window.history.replaceState(null, "", window.location.pathname);
    if (r && r.ruta === pathname) void empezar(r);
  }, [pathname, empezar]);

  // Primera vez: solo en el resumen y solo si la guía de primeros pasos sigue
  // a la vista (un comité que ya terminó no necesita el recorrido). Se recuerda
  // en la base, por usuario (así no se repite en otro equipo); el navegador es
  // el respaldo mientras la columna no exista o no haya conexión.
  useEffect(() => {
    if (pathname !== "/panel") return;

    const clave = `facilapr-recorrido-visto-${usuarioId}`;
    let visto = false;
    try {
      visto = Boolean(localStorage.getItem(clave));
    } catch {
      // Sin almacenamiento local se decide solo con lo que diga la base.
    }
    if (visto) return;

    let cancelado = false;
    const espera = window.setTimeout(async () => {
      // Un comité que ya terminó lo esencial no necesita el recorrido.
      const progreso = await progresoPrimerosPasos().catch(() => null);
      if (!progreso || cancelado) return;

      const enBase = await recorridoYaVisto().catch(() => null);
      if (cancelado) return;

      try {
        localStorage.setItem(clave, "1");
      } catch {
        // Si no se puede guardar, saldrá otra vez en la próxima visita.
      }
      if (enBase === true) return;

      void marcarRecorridoVisto().catch(() => undefined);
      const general = recorridoPorId("resumen");
      if (general) void empezar(general);
    }, 900);

    return () => {
      cancelado = true;
      window.clearTimeout(espera);
    };
  }, [pathname, usuarioId, empezar]);

  return null;
}
