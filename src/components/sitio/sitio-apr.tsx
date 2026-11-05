import {
  AlertTriangle,
  Clock,
  Droplet,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Wrench,
} from "lucide-react";
import { formatearTelefono } from "@/lib/formato";
import { AsistenteComite } from "@/components/sitio/asistente-comite";
import { SeccionesSitio } from "@/components/sitio/secciones-sitio";
import type { SeccionSitio } from "@/lib/sitio-secciones-comun";
import { SIN_IMAGENES, urlImagenSitio, type ImagenesDelSitio } from "@/lib/sitio-imagenes-comun";

/*
  Tercera pasada. Las dos anteriores inventaron un mundo visual propio para
  esta página (primero bloques "señalética vial" rechazados como amateur,
  luego una paleta celeste/serif inspirada en un sitio de APR real que el
  usuario dijo que mejoraba "casi nada"). El usuario pidió inspirarse en la
  landing del software (src/components/site/*), que ya tiene estilo propio
  y probado: badge mono en mayúsculas como eyebrow, monospace para números
  y montos, bordes finos con rounded-2xl (nunca gruesos), objetos reales
  dramatizados (la sección de boleta de la landing) en vez de ilustraciones
  inventadas, bg-muted/40 para alternar secciones. Esta versión hereda ese
  sistema en vez de crear uno nuevo — es la misma marca que ya conocen los
  socios si alguna vez vieron la landing, no una tercera identidad distinta.
*/

export type DatosSitio = {
  id: string;
  nombre: string;
  comuna: string;
  region: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  sitioDescripcion: string | null;
  horarioAtencion: string | null;
  tarifaCargoFijo: number | null;
  tarifaMetroCubico: number | null;
  infoPago: string | null;
};

export type AvisoSitio = {
  id: string;
  tipo: "CORTE" | "MANTENCION" | "NOTICIA";
  titulo: string;
  cuerpo: string | null;
  sectores: string | null;
  inicia: Date | null;
  termina: Date | null;
};

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const fechaHora = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const ESTILO_AVISO = {
  CORTE: {
    icono: AlertTriangle,
    etiqueta: "Corte de agua",
    tono: "bg-destructive/12 text-destructive",
  },
  MANTENCION: {
    icono: Wrench,
    etiqueta: "Mantención",
    tono: "bg-tertiary/20 text-tertiary-foreground",
  },
  NOTICIA: {
    icono: Droplet,
    etiqueta: "Noticia",
    tono: "bg-primary/12 text-primary",
  },
} as const;

function rangoFechas(inicia: Date | null, termina: Date | null) {
  if (!inicia) return null;
  if (!termina) return `Desde el ${fechaHora.format(inicia)}`;
  return `${fechaHora.format(inicia)} — ${fechaHora.format(termina)}`;
}

export function SitioApr({
  apr,
  avisos,
  slug,
  dominio,
  imagenes = SIN_IMAGENES,
  secciones = [],
  vistaPrevia = false,
}: {
  apr: DatosSitio;
  avisos: AvisoSitio[];
  slug?: string;
  dominio?: string;
  imagenes?: ImagenesDelSitio;
  /** Las secciones que armó el comité (solo las visibles), en orden. */
  secciones?: SeccionSitio[];
  /** En la vista previa del panel: sin el asistente flotante y sin que los enlaces saquen de la pantalla. */
  vistaPrevia?: boolean;
}) {
  const hayTarifas =
    apr.tarifaCargoFijo !== null || apr.tarifaMetroCubico !== null;
  const hayContacto =
    apr.direccion || apr.telefono || apr.email || apr.horarioAtencion;
  const corteActivo = avisos.find((a) => a.tipo === "CORTE");

  return (
    <div className={vistaPrevia ? "bg-background" : "min-h-screen bg-background"}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-7 py-4">
          {imagenes.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlImagenSitio(imagenes.logo.id)} alt="" className="size-9 shrink-0 rounded-lg object-contain" />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Droplet className="size-4.5 fill-primary text-primary" />
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold">{apr.nombre}</div>
            <div className="text-[0.8rem] text-muted-foreground">
              {apr.comuna}
              {apr.region && `, ${apr.region}`}
            </div>
          </div>
        </div>
      </header>

      <section className="py-16 text-center">
        <div className="mx-auto flex max-w-[680px] flex-col items-center px-7">
          <span
            className={
              corteActivo
                ? "rounded-full bg-destructive/12 px-3.5 py-1.5 font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-destructive uppercase"
                : "rounded-full bg-forest/12 px-3.5 py-1.5 font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-forest uppercase"
            }
          >
            {corteActivo ? "Corte de agua programado" : "Servicio normal"}
          </span>

          <h1 className="mt-5.5 mb-4 text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.1] font-semibold text-balance">
            {apr.nombre}
          </h1>
          <p className="mb-7 max-w-[52ch] text-[1.05rem] leading-relaxed text-muted-foreground">
            {apr.sitioDescripcion ??
              `Comité de Agua Potable Rural de ${apr.comuna}. Aquí encuentras nuestros datos de contacto, avisos de corte y la información de pago.`}
          </p>

          <a
            href="/cuenta/entrar"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[0.95rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <MessageCircle className="size-4" />
            Consulta tu cuenta
          </a>
        </div>
      </section>

      {imagenes.portada && (
        <div className="mx-auto -mt-6 mb-16 max-w-[1180px] px-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urlImagenSitio(imagenes.portada.id)}
            alt={imagenes.portada.pie ?? `Fotografía de ${apr.nombre}`}
            className="aspect-[21/9] w-full rounded-2xl border border-border object-cover"
          />
        </div>
      )}

      {avisos.length > 0 && (
        <section className="border-y border-border bg-muted/40 py-16">
          <div className="mx-auto max-w-[1180px] px-7">
            <span className="font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
              Al día
            </span>
            <h2 className="mt-3 mb-7 text-[clamp(1.5rem,2.5vw,1.9rem)] font-semibold text-balance">
              Avisos vigentes
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {avisos.map((aviso) => {
                const estilo = ESTILO_AVISO[aviso.tipo];
                const Icono = estilo.icono;
                const rango = rangoFechas(aviso.inicia, aviso.termina);

                return (
                  <article
                    key={aviso.id}
                    className="rounded-2xl border border-border bg-card p-6"
                  >
                    <div
                      className={`mb-3.5 flex size-9 items-center justify-center rounded-[10px] ${estilo.tono}`}
                    >
                      <Icono className="size-4.5" />
                    </div>
                    <span className="font-mono text-[0.72rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                      {estilo.etiqueta}
                    </span>
                    <h3 className="mt-1.5 mb-1.5 text-[1.05rem] font-semibold">
                      {aviso.titulo}
                    </h3>
                    {rango && (
                      <p className="text-[0.87rem] font-medium tabular-nums text-muted-foreground">
                        {rango}
                      </p>
                    )}
                    {aviso.sectores && (
                      <p className="mt-0.5 text-[0.87rem] text-muted-foreground">
                        Sectores: {aviso.sectores}
                      </p>
                    )}
                    {aviso.cuerpo && (
                      <p className="mt-2.5 text-[0.9rem] leading-relaxed text-muted-foreground">
                        {aviso.cuerpo}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {(hayTarifas || apr.infoPago) && (
        <section id="tarifas" className="py-16">
          {/* pr-20 en mobile: la boleta tiene fondo sólido de ancho completo
              y, sin ese margen, queda justo debajo del botón flotante del
              asistente mientras se hace scroll. Se anula desde lg, donde la
              boleta ya no ocupa el ancho completo de la sección. */}
          <div className="mx-auto grid max-w-[1180px] gap-14 px-7 pr-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:pr-7">
            <div>
              <span className="font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
                Tarifas y pago
              </span>
              <h2 className="mt-3 text-[clamp(1.6rem,2.8vw,2.1rem)] font-semibold text-balance">
                Lo que cobra tu comité, sin letra chica.
              </h2>
              {apr.infoPago && (
                <p className="mt-4 max-w-[46ch] text-[0.95rem] leading-relaxed whitespace-pre-line text-muted-foreground">
                  {apr.infoPago}
                </p>
              )}
            </div>

            {hayTarifas && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
                <div className="flex items-center gap-2 bg-foreground px-5.5 py-4 text-background">
                  <span className="flex size-6 items-center justify-center rounded-md bg-primary">
                    <Droplet className="size-3.5 fill-white text-white" />
                  </span>
                  <span className="text-[0.95rem] font-semibold">
                    {apr.nombre}
                  </span>
                </div>

                <div className="p-5.5">
                  {apr.tarifaCargoFijo !== null && (
                    <div className="flex justify-between border-b border-dashed border-border py-3.5 text-[0.95rem]">
                      <span className="text-muted-foreground">Cargo fijo</span>
                      <span className="font-mono font-semibold tabular-nums">
                        {clp.format(apr.tarifaCargoFijo)}
                      </span>
                    </div>
                  )}
                  {apr.tarifaMetroCubico !== null && (
                    <div className="flex justify-between py-3.5 text-[0.95rem]">
                      <span className="text-muted-foreground">
                        Valor del m³
                      </span>
                      <span className="font-mono font-semibold tabular-nums">
                        {clp.format(apr.tarifaMetroCubico)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {imagenes.galeria.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-[1180px] px-7">
            <span className="font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
              Galería
            </span>
            <h2 className="mt-3 mb-7 text-[clamp(1.5rem,2.5vw,1.9rem)] font-semibold text-balance">
              Nuestro sistema
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {imagenes.galeria.map((foto) => (
                <figure key={foto.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlImagenSitio(foto.id)} alt={foto.pie ?? ""} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  {foto.pie && <figcaption className="px-4 py-3 text-[0.85rem] text-muted-foreground">{foto.pie}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <SeccionesSitio secciones={secciones} />

      {hayContacto && (
        <section className="border-t border-border bg-muted/40 py-16">
          <div className="mx-auto max-w-[1180px] px-7">
            <span className="font-mono text-[0.72rem] font-semibold tracking-[0.09em] text-primary uppercase">
              Contacto
            </span>
            <h2 className="mt-3 mb-7 text-[clamp(1.5rem,2.5vw,1.9rem)] font-semibold text-balance">
              Dónde encontrarnos
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {apr.direccion && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <MapPin className="size-4.5 text-primary" />
                  <div className="mt-3 text-[0.95rem] font-medium">
                    {apr.direccion}
                  </div>
                </div>
              )}
              {apr.telefono && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <Phone className="size-4.5 text-primary" />
                  <div className="mt-3 font-mono text-[0.95rem] font-medium tabular-nums">
                    {formatearTelefono(apr.telefono)}
                  </div>
                </div>
              )}
              {apr.email && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <Mail className="size-4.5 text-primary" />
                  <div className="mt-3 text-[0.95rem] font-medium break-all">
                    {apr.email}
                  </div>
                </div>
              )}
              {apr.horarioAtencion && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <Clock className="size-4.5 text-primary" />
                  <div className="mt-3 text-[0.95rem] font-medium whitespace-pre-line">
                    {apr.horarioAtencion}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-7 text-[0.85rem] text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10">
              <Droplet className="size-3.5 fill-primary text-primary" />
            </span>
            {apr.nombre}
          </div>
          <span>
            © {new Date().getFullYear()} · Sitio creado con{" "}
            <a
              href="https://facilapr.cl"
              className="font-medium text-primary hover:underline"
            >
              Facilapr
            </a>
          </span>
        </div>
      </footer>

      {!vistaPrevia && (
        <AsistenteComite
          nombreApr={apr.nombre}
          slug={slug}
          dominio={dominio}
        />
      )}
    </div>
  );
}
