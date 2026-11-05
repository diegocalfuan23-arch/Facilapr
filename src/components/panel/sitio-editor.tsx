"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Globe, Loader2, Sparkles } from "lucide-react";
import { alternarPublicado, generarSitioIA, guardarSitio, type ResultadoAccion } from "@/app/panel/sitio/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SitioVistaPrevia } from "@/components/panel/sitio-vista-previa";
import type { AvisoSitio, DatosSitio } from "@/components/sitio/sitio-apr";
import type { ImagenesDelSitio } from "@/lib/sitio-imagenes-comun";
import type { SeccionSitio } from "@/lib/sitio-secciones-comun";
import { cn } from "@/lib/utils";

export type DatosEditor = {
  slug: string | null;
  sitioPublicado: boolean;
  sitioDescripcion: string | null;
  horarioAtencion: string | null;
  tarifaCargoFijo: number | null;
  tarifaMetroCubico: number | null;
  infoPago: string | null;
};

const campoClase = "h-10 px-3 text-[0.95rem]";

function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-[0.8rem] font-medium">
        {etiqueta}
      </Label>
      {children}
      {ayuda && <p className="text-[0.75rem] text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

export function SitioEditor({
  datos,
  sitio,
  avisos,
  imagenes,
  secciones,
  dominioRaiz,
  sugerenciaSlug,
}: {
  datos: DatosEditor;
  /** Los datos del comité tal como los ve el sitio público (nombre, comuna, contacto). */
  sitio: DatosSitio;
  avisos: AvisoSitio[];
  imagenes: ImagenesDelSitio;
  secciones: SeccionSitio[];
  dominioRaiz: string;
  sugerenciaSlug: string;
}) {
  const [estado, accion, pendiente] = useActionState<
    ResultadoAccion | null,
    FormData
  >(guardarSitio, null);

  const [slug, setSlug] = useState(datos.slug ?? sugerenciaSlug);
  const [copiado, setCopiado] = useState(false);
  const [cargoFijo, setCargoFijo] = useState(datos.tarifaCargoFijo === null ? "" : String(datos.tarifaCargoFijo));
  const [valorM3, setValorM3] = useState(datos.tarifaMetroCubico === null ? "" : String(datos.tarifaMetroCubico));
  const [publicando, iniciarPublicar] = useTransition();
  const [errorPublicar, setErrorPublicar] = useState<string | null>(null);

  const [sitioDescripcion, setSitioDescripcion] = useState(
    datos.sitioDescripcion ?? ""
  );
  const [horarioAtencion, setHorarioAtencion] = useState(
    datos.horarioAtencion ?? ""
  );
  const [infoPago, setInfoPago] = useState(datos.infoPago ?? "");

  const [iaAbierta, setIaAbierta] = useState(false);
  const [textoIA, setTextoIA] = useState("");
  const [generandoIA, iniciarGenerarIA] = useTransition();
  const [errorIA, setErrorIA] = useState<string | null>(null);

  function generarConIA() {
    setErrorIA(null);
    iniciarGenerarIA(async () => {
      const r = await generarSitioIA(textoIA);
      if (!r.ok) {
        setErrorIA(r.error);
        return;
      }
      setSitioDescripcion(r.datos.sitioDescripcion);
      setHorarioAtencion(r.datos.horarioAtencion);
      setInfoPago(r.datos.infoPago);
      setIaAbierta(false);
    });
  }

  const url = `https://${slug || sugerenciaSlug}.${dominioRaiz}`;
  // «Ver sitio» abre la dirección GUARDADA: si se escribió otra y no se guardó, esa aún no existe.
  const urlGuardada = datos.slug ? `https://${datos.slug}.${dominioRaiz}` : null;
  const direccionSinGuardar = !datos.slug || slug !== datos.slug;

  async function copiar() {
    await navigator.clipboard.writeText(urlGuardada ?? url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight">
            Sitio público
          </h1>
          <p className="mt-1 text-[0.9rem] text-muted-foreground">
            La página web de tu comité, armada con los datos que ya tienes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[0.85rem] font-medium",
              datos.sitioPublicado
                ? "border-forest/30 bg-forest/5 text-forest"
                : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                datos.sitioPublicado ? "bg-forest" : "bg-muted-foreground/50"
              )}
            />
            {datos.sitioPublicado ? "Publicado" : "Sin publicar"}
          </span>
          {datos.sitioPublicado && urlGuardada && (
            <a
              href={urlGuardada}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-[0.9rem] font-medium transition-colors hover:bg-muted"
            >
              <ExternalLink className="size-4" />
              Ver sitio
            </a>
          )}
          <Button
            variant={datos.sitioPublicado ? "outline" : "default"}
            className="h-10 px-4 text-[0.9rem]"
            disabled={publicando}
            onClick={() =>
              iniciarPublicar(async () => {
                const r = await alternarPublicado(!datos.sitioPublicado);
                setErrorPublicar(r.ok ? null : r.error);
              })
            }
          >
            {publicando && <Loader2 className="animate-spin" />}
            {datos.sitioPublicado ? "Despublicar" : "Publicar sitio"}
          </Button>
        </div>
      </div>

      {errorPublicar && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[0.88rem] text-destructive">
          {errorPublicar}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form
          action={accion}
          className="rounded-xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div className="flex flex-col gap-4 p-6">
            <Campo
              id="slug"
              etiqueta="Dirección web"
              ayuda={
                direccionSinGuardar
                  ? "Esta dirección todavía no está guardada: guarda los cambios para que funcione."
                  : undefined
              }
            >
              <div className="flex gap-2">
                <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <Globe className="ml-3 size-4 shrink-0 text-muted-foreground" />
                  <Input
                    id="slug"
                    name="slug"
                    value={slug}
                    onChange={(e) =>
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-")
                          .slice(0, 40)
                      )
                    }
                    required
                    className={cn(
                      campoClase,
                      "border-0 focus-visible:ring-0 focus-visible:border-transparent"
                    )}
                  />
                  <span className="shrink-0 border-l border-input bg-muted px-3 py-2.5 text-[0.85rem] text-muted-foreground">
                    .{dominioRaiz}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-3 text-[0.9rem]"
                  onClick={copiar}
                  aria-label="Copiar dirección"
                  disabled={!urlGuardada}
                >
                  {copiado ? <Check className="text-forest" /> : <Copy />}
                  <span className="hidden sm:inline">
                    {copiado ? "Copiado" : "Copiar"}
                  </span>
                </Button>
              </div>
            </Campo>
          </div>

          <div className="flex flex-col gap-4 border-t border-border/60 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[0.95rem] font-semibold">Presentación</h2>
              <Button
                type="button"
                variant="ghost"
                className="h-8 gap-2 px-3 text-[0.8rem] text-primary"
                onClick={() => setIaAbierta((v) => !v)}
              >
                <Sparkles className="size-4" />
                Redactar con IA
              </Button>
            </div>

            {iaAbierta && (
              <div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/3 p-4">
                <p className="text-[0.8rem] text-muted-foreground">
                  Cuéntanos de tu comité en un par de frases y completamos la
                  descripción, el horario y la forma de pago. Revisa el
                  resultado antes de guardar.
                </p>
                <Textarea
                  rows={2}
                  maxLength={800}
                  value={textoIA}
                  onChange={(e) => setTextoIA(e.target.value)}
                  placeholder="Somos APR Pitrelahué, atendemos martes y jueves de 9 a 13, cobramos 8000 de cargo fijo más 500 el m³, se paga en efectivo o por transferencia."
                  className="bg-card"
                />
                {errorIA && (
                  <p className="text-[0.8rem] text-destructive">{errorIA}</p>
                )}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-primary/30 px-4 text-[0.85rem]"
                    disabled={generandoIA || textoIA.trim().length < 10}
                    onClick={generarConIA}
                  >
                    {generandoIA ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Sparkles />
                    )}
                    {generandoIA ? "Redactando…" : "Completar campos"}
                  </Button>
                </div>
              </div>
            )}

            <Campo
              id="sitioDescripcion"
              etiqueta="Descripción"
              ayuda="Si la dejas vacía usamos un texto por defecto con el nombre de tu comuna."
            >
              <Textarea
                id="sitioDescripcion"
                name="sitioDescripcion"
                rows={2}
                maxLength={500}
                value={sitioDescripcion}
                onChange={(e) => setSitioDescripcion(e.target.value)}
                placeholder="Somos el comité de agua potable rural que abastece a las familias de…"
              />
            </Campo>

            <Campo id="horarioAtencion" etiqueta="Horario de atención">
              <Textarea
                id="horarioAtencion"
                name="horarioAtencion"
                rows={2}
                maxLength={300}
                value={horarioAtencion}
                onChange={(e) => setHorarioAtencion(e.target.value)}
                placeholder={"Lunes a viernes, 9:00 a 14:00\nSábados, 9:00 a 12:00"}
              />
            </Campo>
          </div>

          <div className="flex flex-col gap-4 border-t border-border/60 p-6">
            <h2 className="text-[0.95rem] font-semibold">Tarifas y pago</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="tarifaCargoFijo" etiqueta="Cargo fijo">
                <Input
                  id="tarifaCargoFijo"
                  name="tarifaCargoFijo"
                  inputMode="numeric"
                  value={cargoFijo}
                  onChange={(e) => setCargoFijo(e.target.value)}
                  placeholder="2500"
                  className={campoClase}
                />
              </Campo>
              <Campo id="tarifaMetroCubico" etiqueta="Valor del m³">
                <Input
                  id="tarifaMetroCubico"
                  name="tarifaMetroCubico"
                  inputMode="numeric"
                  value={valorM3}
                  onChange={(e) => setValorM3(e.target.value)}
                  placeholder="450"
                  className={campoClase}
                />
              </Campo>
            </div>
            <Campo id="infoPago" etiqueta="Cómo y dónde pagar">
              <Textarea
                id="infoPago"
                name="infoPago"
                rows={2}
                maxLength={1000}
                value={infoPago}
                onChange={(e) => setInfoPago(e.target.value)}
                placeholder={"En la oficina del comité, en efectivo.\nTransferencia: Cuenta Vista 1234567, Banco Estado."}
              />
            </Campo>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 bg-muted/30 px-6 py-4">
            <div className="min-h-5 text-[0.85rem]">
              {estado && !estado.ok && (
                <span className="text-destructive" role="alert">
                  {estado.error}
                </span>
              )}
              {estado?.ok && (
                <span className="inline-flex items-center gap-2 text-forest">
                  <Check className="size-4" />
                  Guardado
                </span>
              )}
            </div>
            <Button
              type="submit"
              className="h-10 rounded-full px-6 text-[0.95rem]"
              disabled={pendiente}
            >
              {pendiente && <Loader2 className="animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </form>

        <SitioVistaPrevia
          apr={{
            ...sitio,
            sitioDescripcion: sitioDescripcion.trim() || null,
            horarioAtencion: horarioAtencion.trim() || null,
            infoPago: infoPago.trim() || null,
            tarifaCargoFijo: cargoFijo.replace(/\D/g, "") === "" ? null : Number(cargoFijo.replace(/\D/g, "")),
            tarifaMetroCubico: valorM3.replace(/\D/g, "") === "" ? null : Number(valorM3.replace(/\D/g, "")),
          }}
          avisos={avisos}
          imagenes={imagenes}
          secciones={secciones}
        />
      </div>
    </>
  );
}
