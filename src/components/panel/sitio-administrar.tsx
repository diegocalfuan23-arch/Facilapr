"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { cambiarPieImagen, eliminarImagen, subirImagen } from "@/app/panel/sitio/administrar/actions";
import { AvisosSeccion, type AvisoEditor } from "@/components/panel/avisos-sitio";
import { SeccionesAdmin } from "@/components/panel/secciones-admin";
import type { SeccionSitio } from "@/lib/sitio-secciones-comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { REGLAS_IMAGEN, urlImagenSitio, type ImagenesDelSitio, type ImagenSitio, type TipoImagenSitio } from "@/lib/sitio-imagenes-comun";

/** Sube una foto: la comprime en el navegador y la manda al servidor. Devuelve si salió bien. */
async function enviarFoto(tipo: TipoImagenSitio, archivo: File, pie?: string) {
  try {
    const comprimida = await comprimirImagen(archivo, REGLAS_IMAGEN[tipo].lado);
    const datos = new FormData();
    datos.set("tipo", tipo);
    datos.set("archivo", comprimida);
    if (pie) datos.set("pie", pie);
    const r = await subirImagen(datos);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "No pudimos subir la imagen.");
    return false;
  }
}

function SubirBoton({ tipo, etiqueta, onTerminado }: { tipo: TipoImagenSitio; etiqueta: string; onTerminado?: () => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, iniciar] = useTransition();

  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = "";
          if (!archivo) return;
          iniciar(async () => {
            if (await enviarFoto(tipo, archivo)) {
              toast.success("Imagen subida");
              onTerminado?.();
            }
          });
        }}
      />
      <Button type="button" variant="outline" className="h-10 px-4 text-[0.9rem]" disabled={subiendo} onClick={() => entrada.current?.click()}>
        {subiendo ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        {subiendo ? "Subiendo…" : etiqueta}
      </Button>
    </>
  );
}

function BotonBorrar({ imagen }: { imagen: ImagenSitio }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={pendiente}
      aria-label="Quitar imagen"
      onClick={() => {
        if (!window.confirm("¿Quitar esta imagen del sitio?")) return;
        iniciar(async () => {
          const r = await eliminarImagen(imagen.id);
          if (!r.ok) toast.error(r.error);
        });
      }}
    >
      {pendiente ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}

function Tarjeta({ titulo, ayuda, accion, children }: { titulo: string; ayuda: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[1.05rem] font-semibold">{titulo}</h2>
          <p className="mt-1 text-[0.85rem] text-muted-foreground">{ayuda}</p>
        </div>
        {accion}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** El pie de una foto de la galería: se guarda al salir del campo. */
function PieFoto({ foto }: { foto: ImagenSitio }) {
  const [valor, setValor] = useState(foto.pie ?? "");
  return (
    <Input
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        if (valor.trim() === (foto.pie ?? "")) return;
        void cambiarPieImagen(foto.id, valor).then((r) => {
          if (!r.ok) toast.error(r.error);
        });
      }}
      placeholder="Texto de la foto (opcional)"
      maxLength={140}
      className="h-9 px-3 text-[0.85rem]"
    />
  );
}

export function SitioAdministrar({ imagenes, avisos, secciones }: { imagenes: ImagenesDelSitio; avisos: AvisoEditor[]; secciones: SeccionSitio[] }) {
  const { logo, portada, galeria } = imagenes;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Tarjeta
          titulo="Logo"
          ayuda="Aparece arriba a la izquierda de tu sitio. Mejor si es cuadrado."
          accion={<SubirBoton tipo="LOGO" etiqueta={logo ? "Cambiar logo" : "Subir logo"} />}
        >
          {logo ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlImagenSitio(logo.id)} alt="Logo del comité" className="size-20 rounded-xl border border-border bg-muted/30 object-contain" />
              <BotonBorrar imagen={logo} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[0.85rem] text-muted-foreground">Sin logo: se usa la gota de Facilapr.</p>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Foto de portada"
          ayuda="Una foto ancha de tu sistema (la captación, el estanque o la sede). Se muestra bajo el título."
          accion={<SubirBoton tipo="PORTADA" etiqueta={portada ? "Cambiar foto" : "Subir foto"} />}
        >
          {portada ? (
            <div className="flex items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlImagenSitio(portada.id)} alt="Portada" className="aspect-[21/9] w-full rounded-xl border border-border object-cover" />
              <BotonBorrar imagen={portada} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[0.85rem] text-muted-foreground">Sin foto de portada.</p>
          )}
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Galería"
        ayuda={`Hasta ${REGLAS_IMAGEN.GALERIA.max} fotos de tu sistema, con un texto corto cada una.`}
        accion={galeria.length < REGLAS_IMAGEN.GALERIA.max ? <SubirBoton tipo="GALERIA" etiqueta="Agregar foto" /> : <span className="text-[0.8rem] text-muted-foreground">Galería completa</span>}
      >
        {galeria.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[0.9rem] text-muted-foreground">Todavía no hay fotos en la galería.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {galeria.map((foto) => (
              <div key={foto.id} className="flex flex-col gap-2">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlImagenSitio(foto.id)} alt={foto.pie ?? ""} className="aspect-[4/3] w-full rounded-xl border border-border object-cover" />
                  <div className="absolute top-2 right-2 rounded-lg bg-background/90 shadow-sm">
                    <BotonBorrar imagen={foto} />
                  </div>
                </div>
                <PieFoto foto={foto} />
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      <SeccionesAdmin secciones={secciones} />

      <AvisosSeccion avisos={avisos} />
    </div>
  );
}
