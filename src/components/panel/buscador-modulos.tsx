"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { destinosExtra, gruposDelMenu, PALABRAS_CLAVE, type Enlace, type RolMenu } from "@/lib/menu-panel";
import { cn } from "@/lib/utils";

type Resultado = Enlace & { grupo: string };

/** Sin tildes ni mayúsculas: «invent» encuentra «Inventario» y «configuracion» encuentra «Configuración». */
const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Buscador de módulos del encabezado (plan Grande). Se abre con el botón o con Ctrl + K (⌘ + K en
 * Mac), se escribe, se elige con las flechas y se entra con Enter. Muestra solo lo que este
 * comité puede ver, con la misma lista que el menú lateral.
 */
export function BuscadorModulos({
  rol,
  chat,
  conFinanzas,
}: {
  rol: RolMenu;
  chat: boolean;
  conFinanzas: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [activo, setActivo] = useState(0);
  const [esMac, setEsMac] = useState(false);
  const lista = useRef<HTMLUListElement>(null);

  const todos = useMemo<Resultado[]>(() => {
    const delMenu = gruposDelMenu({ rol, chat, conFinanzas }).flatMap((g) => g.enlaces.map((e) => ({ ...e, grupo: g.titulo })));
    return [...delMenu, ...destinosExtra({ rol, conFinanzas })];
  }, [rol, chat, conFinanzas]);

  const resultados = useMemo(() => {
    const q = normalizar(consulta.trim());
    if (!q) return todos;
    // Cada palabra escrita tiene que aparecer en el nombre, el grupo o las palabras clave del módulo.
    const palabras = q.split(/\s+/);
    return todos.filter((r) => {
      const texto = normalizar(`${r.label} ${r.grupo} ${PALABRAS_CLAVE[r.href] ?? ""}`);
      return palabras.every((p) => texto.includes(p));
    });
  }, [todos, consulta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEsMac(/Mac|iPhone|iPad/i.test(navigator.platform));
  }, []);

  // Ctrl + K (o ⌘ + K) abre y cierra el buscador desde cualquier pantalla del panel.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((v) => !v);
      }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);

  // El elegido con las flechas siempre queda a la vista.
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activo, resultados]);

  function cambiarApertura(v: boolean) {
    setAbierto(v);
    if (v) {
      setConsulta("");
      setActivo(0);
    }
  }

  function ir(r: Resultado | undefined) {
    if (!r) return;
    setAbierto(false);
    router.push(r.href);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((a) => (resultados.length ? (a + 1) % resultados.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => (resultados.length ? (a - 1 + resultados.length) % resultados.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      ir(resultados[activo]);
    }
  }

  const atajo = esMac ? "⌘K" : "Ctrl K";

  return (
    <>
      <button
        type="button"
        onClick={() => cambiarApertura(true)}
        aria-label="Buscar módulo"
        className="hidden h-9 w-64 items-center gap-2 rounded-full border border-border bg-background/60 px-3 text-[0.85rem] text-muted-foreground transition-colors hover:bg-muted sm:flex"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left">Buscar módulo…</span>
        <kbd className="rounded-md border border-border px-1.5 py-0.5 font-sans text-[0.7rem] leading-none">{atajo}</kbd>
      </button>
      <button
        type="button"
        onClick={() => cambiarApertura(true)}
        aria-label="Buscar módulo"
        className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted sm:hidden"
      >
        <Search className="size-4" />
      </button>

      <Dialog open={abierto} onOpenChange={cambiarApertura}>
        <DialogContent showCloseButton={false} className="top-[16%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg sm:p-0">
          <DialogTitle className="sr-only">Buscar módulo</DialogTitle>

          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={consulta}
              onChange={(e) => {
                setConsulta(e.target.value);
                setActivo(0);
              }}
              onKeyDown={alTeclear}
              placeholder="¿A dónde quieres ir? Ej.: caja, bodega, proveedores…"
              aria-label="Buscar módulo"
              autoFocus
              autoComplete="off"
              className="h-12 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul ref={lista} role="listbox" aria-label="Módulos" className="scroll-fino max-h-80 overflow-y-auto p-2">
            {resultados.length === 0 ? (
              <li className="px-3 py-8 text-center text-[0.9rem] text-muted-foreground">
                Nada coincide con «{consulta}». Prueba con otra palabra.
              </li>
            ) : (
              resultados.map((r, i) => {
                const Icono = r.icon;
                const esActivo = i === activo;
                return (
                  <li key={`${r.grupo}-${r.href}`} role="option" aria-selected={esActivo}>
                    <button
                      type="button"
                      onClick={() => ir(r)}
                      onMouseMove={() => setActivo(i)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[0.92rem] transition-colors",
                        esActivo ? "bg-muted" : "hover:bg-muted/60"
                      )}
                    >
                      <Icono className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{r.label}</span>
                      <span className="shrink-0 text-[0.78rem] text-muted-foreground">{r.grupo}</span>
                      {esActivo && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="hidden items-center gap-4 border-t border-border px-4 py-2.5 text-[0.75rem] text-muted-foreground sm:flex">
            <span>↑↓ para moverte</span>
            <span>Enter para abrir</span>
            <span>Esc para cerrar</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
