"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImageIcon, LayoutGrid, Loader2, MousePointerClick, Pencil, Plus, Trash2, Type, X } from "lucide-react";
import { alternarSeccion, eliminarSeccion, guardarSeccion, moverSeccion } from "@/app/panel/sitio/administrar/secciones-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { REGLAS_IMAGEN, urlImagenSitio } from "@/lib/sitio-imagenes-comun";
import { MAX_SECCIONES, MAX_TARJETAS, TIPOS_SECCION, textoTipoSeccion, type SeccionSitio, type TarjetaSeccion, type TipoSeccion } from "@/lib/sitio-secciones-comun";
import { cn } from "@/lib/utils";

const ICONO_TIPO = { TEXTO: Type, IMAGEN: ImageIcon, BOTON: MousePointerClick, TARJETAS: LayoutGrid } as const;
const campo = "h-10 px-3 text-[0.95rem]";

function resumen(s: SeccionSitio) {
  if (s.titulo) return s.titulo;
  if (s.texto) return s.texto.slice(0, 60);
  if (s.tipo === "TARJETAS") return `${s.tarjetas.length} cuadros`;
  return textoTipoSeccion(s.tipo);
}

export function SeccionesAdmin({ secciones }: { secciones: SeccionSitio[] }) {
  const [editando, setEditando] = useState<SeccionSitio | "nueva" | null>(null);
  const [pendiente, iniciar] = useTransition();

  function accion(fn: () => Promise<{ ok: boolean; error?: string }>) {
    iniciar(async () => {
      const r = await fn();
      if (!r.ok && r.error) toast.error(r.error);
    });
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[1.05rem] font-semibold">Secciones de tu sitio</h2>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">Agrega textos, imágenes, botones o cuadros. Se muestran en este orden, antes del contacto.</p>
        </div>
        <Button className="h-10 rounded-full px-4 text-[0.9rem]" disabled={secciones.length >= MAX_SECCIONES} onClick={() => setEditando("nueva")}>
          <Plus />
          Agregar sección
        </Button>
      </div>

      <div className="mt-4">
        {secciones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[0.9rem] text-muted-foreground">Todavía no agregas secciones.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border/60">
            {secciones.map((s, i) => {
              const Icono = ICONO_TIPO[s.tipo];
              return (
                <div key={s.id} className={cn("flex items-center gap-3 py-3 first:pt-0 last:pb-0", !s.visible && "opacity-60")}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icono className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.92rem] font-medium">{resumen(s)}</div>
                    <div className="text-[0.8rem] text-muted-foreground">
                      {textoTipoSeccion(s.tipo)}
                      {!s.visible && " · Oculta"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Subir" disabled={pendiente || i === 0} onClick={() => accion(() => moverSeccion(s.id, "ARRIBA"))}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Bajar" disabled={pendiente || i === secciones.length - 1} onClick={() => accion(() => moverSeccion(s.id, "ABAJO"))}>
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={s.visible ? "Ocultar" : "Mostrar"}
                      title={s.visible ? "Ocultar del sitio" : "Mostrar en el sitio"}
                      disabled={pendiente}
                      onClick={() => accion(() => alternarSeccion(s.id, !s.visible))}
                    >
                      {s.visible ? <Eye /> : <EyeOff />}
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setEditando(s)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Borrar"
                      disabled={pendiente}
                      onClick={() => {
                        if (!window.confirm("¿Borrar esta sección del sitio?")) return;
                        accion(() => eliminarSeccion(s.id));
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editando && <SeccionDialog key={editando === "nueva" ? "nueva" : editando.id} seccion={editando === "nueva" ? null : editando} onCerrar={() => setEditando(null)} />}
    </section>
  );
}

function SeccionDialog({ seccion, onCerrar }: { seccion: SeccionSitio | null; onCerrar: () => void }) {
  const editando = seccion !== null;
  const [tipo, setTipo] = useState<TipoSeccion | null>(seccion?.tipo ?? null);
  const [titulo, setTitulo] = useState(seccion?.titulo ?? "");
  const [texto, setTexto] = useState(seccion?.texto ?? "");
  const [botonTexto, setBotonTexto] = useState(seccion?.botonTexto ?? "");
  const [botonUrl, setBotonUrl] = useState(seccion?.botonUrl ?? "");
  const [tarjetas, setTarjetas] = useState<TarjetaSeccion[]>(seccion?.tarjetas.length ? seccion.tarjetas : [{ titulo: "", texto: "" }, { titulo: "", texto: "" }]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  function elegirArchivo(f: File | undefined) {
    if (!f) return;
    setArchivo(f);
    setVista((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return URL.createObjectURL(f);
    });
  }

  function guardar() {
    if (!tipo) return;
    setError(null);
    iniciar(async () => {
      try {
        const datos = new FormData();
        if (seccion) datos.set("id", seccion.id);
        datos.set("tipo", tipo);
        datos.set("titulo", titulo);
        datos.set("texto", texto);
        if (tipo === "BOTON") {
          datos.set("botonTexto", botonTexto);
          datos.set("botonUrl", botonUrl);
        }
        if (tipo === "TARJETAS") datos.set("tarjetas", JSON.stringify(tarjetas));
        if (tipo === "IMAGEN" && archivo) datos.set("archivo", await comprimirImagen(archivo, REGLAS_IMAGEN.SECCION.lado));
        const r = await guardarSeccion(datos);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        toast.success(editando ? "Sección actualizada" : "Sección agregada");
        onCerrar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos guardar la sección.");
      }
    });
  }

  const imagenActual = vista ?? (seccion?.imagenId ? urlImagenSitio(seccion.imagenId) : null);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-6 sm:max-w-xl sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">{editando ? "Editar sección" : "Agregar sección"}</DialogTitle>
          <DialogDescription className="text-[0.9rem]">{tipo ? textoTipoSeccion(tipo) : "¿Qué quieres agregar a tu sitio?"}</DialogDescription>
        </DialogHeader>

        {!tipo ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {TIPOS_SECCION.map((t) => {
              const Icono = ICONO_TIPO[t.valor];
              return (
                <button
                  key={t.valor}
                  type="button"
                  onClick={() => setTipo(t.valor)}
                  className="flex flex-col gap-2 rounded-xl border border-border p-4 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40"
                >
                  <Icono className="size-5 text-primary" />
                  <span className="text-[0.95rem] font-medium">{t.titulo}</span>
                  <span className="text-[0.8rem] text-muted-foreground">{t.ayuda}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sec-titulo" className="text-[0.8rem] font-medium">
                Título {tipo === "TARJETAS" || tipo === "BOTON" ? "(opcional)" : ""}
              </Label>
              <Input id="sec-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} className={campo} autoFocus />
            </div>

            {tipo === "IMAGEN" && (
              <div className="flex flex-col gap-2">
                <Label className="text-[0.8rem] font-medium">Imagen</Label>
                {imagenActual && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagenActual} alt="" className="aspect-[4/3] w-full max-w-xs rounded-xl border border-border object-cover" />
                )}
                <label className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border border-border px-4 text-[0.9rem] font-medium transition-colors hover:bg-muted">
                  <ImageIcon className="size-4" />
                  {imagenActual ? "Cambiar imagen" : "Elegir imagen"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => elegirArchivo(e.target.files?.[0])} />
                </label>
              </div>
            )}

            {tipo !== "TARJETAS" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="sec-texto" className="text-[0.8rem] font-medium">
                  Texto {tipo === "BOTON" ? "(opcional)" : ""}
                </Label>
                <Textarea id="sec-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={1500} />
              </div>
            )}

            {tipo === "BOTON" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sec-btn" className="text-[0.8rem] font-medium">
                    Lo que dice el botón
                  </Label>
                  <Input id="sec-btn" value={botonTexto} onChange={(e) => setBotonTexto(e.target.value)} placeholder="Escríbenos por WhatsApp" maxLength={40} className={campo} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sec-url" className="text-[0.8rem] font-medium">
                    A dónde lleva
                  </Label>
                  <Input id="sec-url" value={botonUrl} onChange={(e) => setBotonUrl(e.target.value)} placeholder="https://… o +56 9 1234 5678" maxLength={500} className={campo} />
                  <p className="text-[0.75rem] text-muted-foreground">Una página web, un correo o un número (abre WhatsApp).</p>
                </div>
              </div>
            )}

            {tipo === "TARJETAS" && (
              <div className="flex flex-col gap-3">
                {tarjetas.map((t, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`Título del cuadro ${i + 1}`}
                        value={t.titulo}
                        onChange={(e) => setTarjetas((ts) => ts.map((x, k) => (k === i ? { ...x, titulo: e.target.value } : x)))}
                        placeholder={`Cuadro ${i + 1}: título`}
                        maxLength={80}
                        className={campo}
                      />
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar cuadro" disabled={tarjetas.length <= 2} onClick={() => setTarjetas((ts) => ts.filter((_, k) => k !== i))}>
                        <X />
                      </Button>
                    </div>
                    <Textarea
                      aria-label={`Texto del cuadro ${i + 1}`}
                      value={t.texto}
                      onChange={(e) => setTarjetas((ts) => ts.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)))}
                      rows={2}
                      maxLength={300}
                      placeholder="Texto"
                    />
                  </div>
                ))}
                {tarjetas.length < MAX_TARJETAS && (
                  <Button type="button" variant="outline" className="h-9 w-fit px-4 text-[0.85rem]" onClick={() => setTarjetas((ts) => [...ts, { titulo: "", texto: "" }])}>
                    <Plus />
                    Agregar cuadro
                  </Button>
                )}
              </div>
            )}

            {error && (
              <p className="text-[0.85rem] text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              {!editando ? (
                <Button type="button" variant="ghost" className="h-10 px-4 text-[0.95rem]" onClick={() => setTipo(null)} disabled={guardando}>
                  Cambiar tipo
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="h-10 px-4 text-[0.95rem]" onClick={onCerrar}>
                  Cancelar
                </Button>
                <Button type="button" className="h-10 rounded-full px-5 text-[0.95rem]" disabled={guardando} onClick={guardar}>
                  {guardando && <Loader2 className="animate-spin" />}
                  {editando ? "Guardar cambios" : "Agregar sección"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
